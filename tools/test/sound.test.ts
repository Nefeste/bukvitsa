// Звук (src/ui/sound.ts; 08-game-design.md, «Вид»; решение владельца #14): файлы — ровно то, что собирает код
// (tools/sound/synth.ts); проигрыватели заводятся заранее и чинятся после ошибки (src/ui/voices.ts, из «Нард»);
// expo-audio без микрофона и фоновой службы; задача звенит на верный ответ и подсказку.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RATE, SOUND_IDS, peakOf, synth, wav } from '../sound/synth';
import { RETRY_MS, Voices } from '../../src/ui/voices';
import { parseSettings, soundOf } from '../../src/state/settings';

const ROOT = join(import.meta.dir, '..', '..');
const read = (f: string) => readFileSync(join(ROOT, f), 'utf8');

describe('звуки: верный ответ и подсказка', () => {
  test('файлы совпадают с тем, что собирает synth.ts (bun tools/sound/make.ts)', () => {
    for (const id of SOUND_IDS) {
      const file = new Uint8Array(readFileSync(join(ROOT, `assets/sounds/${id}.wav`)));
      expect(Buffer.compare(Buffer.from(file), Buffer.from(wav(synth(id), peakOf(id))))).toBe(0);
    }
  });

  test('WAV 16 бит моно, короткие, пик ровный; подсказка тише и короче', () => {
    const limit = { right: 1, hint: 0.5 } as const;
    for (const id of SOUND_IDS) {
      const b = wav(synth(id), peakOf(id));
      const v = new DataView(b.buffer);
      expect(String.fromCharCode(...b.slice(0, 4), ...b.slice(8, 12))).toBe('RIFFWAVE');
      expect([v.getUint16(22, true), v.getUint32(24, true), v.getUint16(34, true)]).toEqual([1, RATE, 16]);
      const n = v.getUint32(40, true) / 2;
      expect(n / RATE).toBeLessThanOrEqual(limit[id]);
      let peak = 0;
      for (let i = 0; i < n; i++) peak = Math.max(peak, Math.abs(v.getInt16(44 + 2 * i, true)));
      expect(peak / 32767).toBeCloseTo(peakOf(id), 2);
    }
    expect(peakOf('hint')).toBeLessThan(peakOf('right'));
  });
});

describe('проигрыватели (src/ui/voices.ts)', () => {
  type Id = 'right' | 'hint';
  function fake(down: () => boolean = () => false) {
    const log: string[] = [];
    const notes: string[] = [];
    const fails = new Map<string, (why: unknown) => void>();
    let t = 0;
    const voices = new Voices<Id>({ right: 1, hint: 1 }, (id, _k, fail) => {
      if (down()) { log.push(`fail ${id}`); return null; }
      log.push(`make ${id}`);
      fails.set(id, fail);
      return { play: () => log.push(`play ${id}`), reload: () => log.push(`reload ${id}`) };
    }, (key, why) => notes.push(`${key}: ${String(why)}`), () => t);
    return { voices, log, notes, fails, wait: (ms: number) => { t += ms; } };
  }

  test('заводятся заранее, по одному за шаг; первый звук играет готовым', () => {
    const { voices, log } = fake();
    const steps: (() => void)[] = [];
    voices.warm(['right', 'hint'], next => steps.push(next));
    expect(log).toEqual([]);
    while (steps.length) steps.shift()!();
    expect(log).toEqual(['make right', 'make hint']);
    expect(voices.play('right', 0, 1)).toBe(true);
    expect(log[2]).toBe('play right');
  });

  test('после ошибки Android файл открывается заново; в журнал — один раз; не создался — новая попытка через RETRY_MS', () => {
    const { voices, log, notes, fails } = fake();
    voices.play('hint', 0, 1);
    fails.get('hint')!('AudioTrack init failed');
    fails.get('hint')!('AudioTrack init failed');
    voices.play('hint', 0, 1);
    expect(log).toEqual(['make hint', 'play hint', 'reload hint', 'play hint']);
    expect(notes).toEqual(['hint-1: AudioTrack init failed']);

    let down = true;
    const b = fake(() => down);
    expect(b.voices.play('right', 0, 1)).toBe(false);
    down = false;
    b.wait(RETRY_MS - 1);
    expect(b.voices.play('right', 0, 1)).toBe(false);
    b.wait(1);
    expect(b.voices.play('right', 0, 1)).toBe(true);
  });
});

describe('настройка и подключение', () => {
  test('звук по умолчанию включён; выключенный сохраняется', () => {
    expect(soundOf(parseSettings(null))).toBe(true);
    expect(soundOf(parseSettings('{"sound":false}'))).toBe(false);
    expect(parseSettings('{"sound":"нет"}').sound).toBeUndefined();
  });

  test('задача заводит звуки при открытии и звенит на верный ответ (не подсмотренный) и подсказку; в браузере — заглушка', () => {
    const task = read('src/screens/TaskScreen.tsx');
    expect(task).toContain('useEffect(preloadSounds, []);');
    expect(task).toContain("if (!play.result.peeked) cue('right');");
    expect(task).toContain("cue('hint');");
    const web = read('src/ui/sound.web.ts');
    for (const f of ['setSoundOn', 'preloadSounds', 'cue']) expect(web).toContain(`export function ${f}(`);
    expect(web).not.toContain('expo-audio');
    const native = read('src/ui/sound.ts');
    expect(native).toContain("addListener('playbackStatusUpdate'");
    expect(native).toContain('playsInSilentMode: false');
  });

  test('expo-audio без микрофона и фоновой службы; MODIFY_AUDIO_SETTINGS — в белом списке и в анкете', () => {
    const app = JSON.parse(read('app.json')) as {
      expo: { android: { blockedPermissions: string[] }; plugins: (string | [string, Record<string, unknown>])[] };
    };
    const audio = app.expo.plugins.find(p => Array.isArray(p) && p[0] === 'expo-audio') as [string, Record<string, unknown>] | undefined;
    expect(audio?.[1]).toMatchObject({ recordAudioAndroid: false, enableBackgroundPlayback: false, microphonePermission: false });
    for (const p of ['RECORD_AUDIO', 'FOREGROUND_SERVICE', 'FOREGROUND_SERVICE_MEDIA_PLAYBACK']) {
      expect(app.expo.android.blockedPermissions).toContain(`android.permission.${p}`);
    }
    expect(read('.github/apk-permissions.txt').split('\n')).toContain('android.permission.MODIFY_AUDIO_SETTINGS');
    expect(read('store/forms.md')).toContain('`MODIFY_AUDIO_SETTINGS`');
  });
});
