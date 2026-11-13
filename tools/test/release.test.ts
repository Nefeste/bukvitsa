// Выпуск (tools/content/release.ts, released.ts): после выпуска запись не меняется без новой version, дата календаря —
// никогда; release.ts дописывает, но не переписывает выпущенное. Проверяется на копии content/ во временной папке,
// где все записи отмечены checked (в настоящем content/ отметку ставит только человек). Ворота выпуска — ADR 0008
// и 0010: в набор идёт сверенное со сканом и отбор редактора (content/known.txt).
import { describe, expect, test } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../content/build';
import { calendarErrors, lockErrors, taskHash } from '../content/released';
import { release } from '../content/release';
import { parse } from 'yaml';
import type { Task } from '../../src/engine/types';

const ROOT = join(import.meta.dir, '../..');
const task: Task = { id: 'proverb-0001', version: 1, kind: 'proverb', prompt: 'Делу ____, потехе час.', answer: 'время', row: ['в', 'р'], text: 'Делу время, потехе час.', about: 'о', source: 'Даль' };

describe('отпечатки', () => {
  test('та же version — тот же отпечаток; любое видимое изменение — ошибка; новая version — можно', () => {
    const lock = { 'proverb-0001': { tag: 'v1.0.0', version: 1, sha256: taskHash(task) } };
    expect(lockErrors([task], lock)).toEqual([]);
    for (const changed of [{ ...task, answer: 'дело' }, { ...task, row: ['р', 'в'] }, { ...task, about: 'иначе' }])
      expect(lockErrors([changed], lock)[0]).toContain('изменилась');
    expect(lockErrors([{ ...task, version: 2, answer: 'дело' }], lock)).toEqual([]);
    expect(lockErrors([{ ...task, version: 0 }], { 'proverb-0001': { ...lock['proverb-0001'], version: 1 } })[0]).toContain('меньше выпущенной');
  });
  test('календарь: выпущенная дата не пропадает и не меняет запись; новые даты — можно', () => {
    const released = { '2026-12-01': 'riddle-0007' };
    expect(calendarErrors({ '2026-12-01': 'riddle-0007', '2026-12-02': 'ending-0001' }, released)).toEqual([]);
    expect(calendarErrors({ '2026-12-01': 'riddle-0008' }, released)).toHaveLength(1);
    expect(calendarErrors({}, released)).toHaveLength(1);
  });
  test('в настоящем content/ выпущенное не тронуто (золотой файл календаря и отпечатки)', () => {
    expect(build(ROOT).errors.filter(e => /выпущен/.test(e))).toEqual([]);
  });
});

describe('release.ts на копии content/', () => {
  test('выпуск записывает версии, отпечатки и даты; после него правка записи без version — ошибка сборки', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'bukvitsa-release-'));
    try {
      cpSync(join(ROOT, 'content'), join(tmp, 'content'), { recursive: true });
      mkdirSync(join(tmp, 'tools', 'test', 'fixtures'), { recursive: true });
      writeFileSync(join(tmp, 'tools', 'test', 'fixtures', 'calendar-released.json'), '{}');
      // только в копии: все записи «сверены», иначе выпускной набор пуст
      for (const dir of readdirSync(join(tmp, 'content')).filter(d => !d.includes('.') && d !== 'sources'))
        for (const f of readdirSync(join(tmp, 'content', dir)).filter(f => f.endsWith('.yaml'))) {
          const p = join(tmp, 'content', dir, f);
          writeFileSync(p, readFileSync(p, 'utf8').replace(/^review: draft$/m, 'review: checked'));
        }
      const r = release(tmp, 'v1.0.0', { today: '2026-12-01' });
      expect(r.ok).toBe(true);
      const released = JSON.parse(readFileSync(join(tmp, 'content', 'released.json'), 'utf8')) as Record<string, number>;
      const days = JSON.parse(readFileSync(join(tmp, 'tools', 'test', 'fixtures', 'calendar-released.json'), 'utf8')) as Record<string, string>;
      expect(Object.keys(released).length).toBeGreaterThan(1000);
      expect(days['2026-12-01']).toBe('riddle-0007');
      // правка выпущенной записи без новой version
      const p = join(tmp, 'content', 'proverbs', '0001.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^about: "/m, 'about: "Правка. '));
      expect(build(tmp).errors.some(e => e.startsWith('proverb-0001: выпущенная в v1.0.0'))).toBe(true);
      expect(release(tmp, 'v1.0.1', { today: '2026-12-01' }).ok).toBe(false);
      // с новой version — выпускается снова
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^version: 1$/m, 'version: 2'));
      const again = release(tmp, 'v1.0.1', { today: '2026-12-01' });
      expect(again.ok && again.bumped).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);
});

describe('выпуск по ADR 0008 и 0010 на копии content/', () => {
  /** Копия content/; `drop` — записи, чьи пословицы убраны из отбора редактора (known.txt). */
  function copy(drop: (r: { id: string; notebooks: string[]; proverb: string }) => boolean = () => false): string {
    const tmp = mkdtempSync(join(tmpdir(), 'bukvitsa-adr10-'));
    cpSync(join(ROOT, 'content'), join(tmp, 'content'), { recursive: true });
    mkdirSync(join(tmp, 'tools', 'test', 'fixtures'), { recursive: true });
    writeFileSync(join(tmp, 'tools', 'test', 'fixtures', 'calendar-released.json'), '{}');
    const gone = new Set<string>();
    for (const dir of readdirSync(join(tmp, 'content')).filter(d => !d.includes('.') && d !== 'sources'))
      for (const f of readdirSync(join(tmp, 'content', dir)).filter(f => f.endsWith('.yaml'))) {
        const r = parse(readFileSync(join(tmp, 'content', dir, f), 'utf8')) as { id: string; notebooks?: string[]; proverb?: string };
        if (r.proverb && drop({ id: r.id, notebooks: r.notebooks ?? [], proverb: r.proverb })) gone.add(r.proverb);
      }
    const known = join(tmp, 'content', 'known.txt');
    writeFileSync(known, readFileSync(known, 'utf8').split('\n').filter(l => !gone.has(l.split('#')[0].trim())).join('\n'));
    return tmp;
  }
  const dayId = (n: number): string => {
    const cal = parse(readFileSync(join(ROOT, 'content', 'calendar.yaml'), 'utf8')) as { days: Record<string, string> };
    return cal.days[Object.keys(cal.days).sort()[n]];
  };

  test('отбор редактора идёт в выпуск без пометки checked: пять тетрадей и 90 дней; дальше календарь не идёт', () => {
    const tmp = copy();
    try {
      const { pack, errors, report } = build(tmp, { release: true, today: '2026-12-01' });
      expect(errors).toEqual([]);
      expect(Object.keys(pack.calendar.days)).toHaveLength(90);
      expect(report.some(l => l.startsWith('выпуск: в календаре 90 готовых дней подряд, с 2027-03-01 — не готово'))).toBe(true);
      expect(pack.notebooks.map(b => b.tasks.length)).toEqual([54, 39, 36, 40, 39]);
      expect(report).toContain('выпуск: тетради first, mind, luck, work, people; остальные — «В следующих версиях»');
      // пометку записи выпуск не трогает: в content/ всё по-прежнему draft
      expect(pack.draft).toBeGreaterThan(1000);
      const r = release(tmp, 'v1.0.0', { today: '2026-12-01' });
      expect(r.ok && r.days).toBe(90);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('в бесплатной тетради запись не из отбора — выпуск красный; сверенная со сканом — снова зелёный', () => {
    let one = '';
    const tmp = copy(r => {
      if (one || !r.notebooks.includes('first')) return false;
      one = r.id;
      return true;
    });
    try {
      expect(build(tmp, { release: true, today: '2026-12-01' }).errors).toContain('тетрадь first: бесплатная, а не готово 1 — в выпуск она идёт целиком');
      const [kind, num] = [one.slice(0, one.lastIndexOf('-')), one.slice(one.lastIndexOf('-') + 1)];
      const dir = { proverb: 'proverbs', riddle: 'riddles', 'extra-letter': 'extra', parts: 'parts', ending: 'endings', cipher: 'ciphers' }[kind]!;
      const p = join(tmp, 'content', dir, `${num}.yaml`);
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^review: draft$/m, 'review: checked'));
      expect(build(tmp, { release: true, today: '2026-12-01' }).errors).toEqual([]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('в платной тетради запись не из отбора — тетрадь «В следующих версиях», остальные идут', () => {
    let one = '';
    const tmp = copy(r => {
      if (one || !r.notebooks.includes('mind')) return false;
      one = r.id;
      return true;
    });
    try {
      const { pack, errors } = build(tmp, { release: true, today: '2026-12-01' });
      expect(errors).toEqual([]);
      expect(pack.notebooks.map(b => b.tasks.length)).toEqual([54, 0, 36, 40, 39]);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('тридцать первый день календаря не из отбора — запаса меньше 60, выпуск красный', () => {
    const id = dayId(30);
    const tmp = copy(r => r.id === id);
    try {
      expect(build(tmp, { release: true, today: '2026-12-01' }).errors.some(e => e.startsWith('календарь: запас меньше 60 дней'))).toBe(true);
      expect(release(tmp, 'v1.0.0', { today: '2026-12-01' }).ok).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);
});
