// из nardy: tools/sound/synth.ts @ 1d2bdff — свои звуки: верный ответ и подсказка (08-game-design.md, «Вид»).
// Звуки собираются кодом: детерминированно, одинаковые байты на любой машине; тест сверяет их с файлами
// в assets/sounds (пересобрать — bun tools/sound/make.ts). Тихо и коротко: игра о словах, звук — отметка.

export const RATE = 32000;
export type SoundId = 'right' | 'hint';

/** Колокольчик с негармоническими обертонами (как у настоящего металла), мягкая атака. */
function bell(out: Float32Array, at: number, gain: number, freq: number, decay: number): void {
  const start = Math.floor(at * RATE);
  const parts: [number, number, number][] = [[1, 1, 1], [2.0, 0.35, 0.6], [2.76, 0.22, 0.45], [5.4, 0.08, 0.25]];
  for (let i = 0; start + i < out.length; i++) {
    const t = i / RATE;
    if (t > decay * 7) break;
    const atk = Math.min(1, t / 0.006);
    let s = 0;
    for (const [r, a, d] of parts) s += a * Math.sin(2 * Math.PI * freq * r * t) * Math.exp(-t / (decay * d));
    out[start + i] += gain * atk * s;
  }
}

/** Небольшая комната: несколько ранних отражений, каждое глуше и темнее. */
function room(x: Float32Array, wet = 0.22): Float32Array {
  const taps: [number, number][] = [[0.011, 0.55], [0.019, 0.42], [0.029, 0.3], [0.043, 0.2], [0.061, 0.12]];
  const out = new Float32Array(x.length);
  out.set(x);
  for (const [dt, g] of taps) {
    const d = Math.floor(dt * RATE);
    let lp = 0;
    for (let i = d; i < x.length; i++) {
      lp += 0.35 * (x[i - d] - lp);
      out[i] += wet * g * lp;
    }
  }
  return out;
}

/** Мягкий срез верхов по всему звуку: без резкости на маленьких динамиках телефона. */
function soften(x: Float32Array, k = 0.6): Float32Array {
  let lp = 0;
  for (let i = 0; i < x.length; i++) { lp += k * (x[i] - lp); x[i] = lp; }
  return x;
}

/** Затухание последних 20 мс — без щелчка в конце файла. */
function tail(x: Float32Array): Float32Array {
  const n = Math.min(x.length, Math.floor(0.02 * RATE));
  for (let i = 0; i < n; i++) x[x.length - 1 - i] *= i / n;
  return x;
}

export function synth(id: SoundId): Float32Array {
  switch (id) {
    case 'right': {
      // верный ответ: два колокольчика на кварту вверх (ми — ля), без фанфар
      const out = new Float32Array(Math.floor(0.9 * RATE));
      bell(out, 0, 0.22, 659.25, 0.2);
      bell(out, 0.11, 0.24, 880.0, 0.28);
      return tail(soften(room(out, 0.3), 0.5));
    }
    case 'hint': {
      // подсказка: одна низкая мягкая нота (ля малой октавы выше), тише верного ответа
      const out = new Float32Array(Math.floor(0.45 * RATE));
      bell(out, 0, 0.25, 440.0, 0.12);
      return tail(soften(room(out, 0.2), 0.45));
    }
  }
}

/** Пик громкости: верный ответ — 0,6; подсказка — тише. */
export const PEAK = { right: 0.6, hint: 0.4 } as const;
export const peakOf = (id: SoundId) => PEAK[id];

/** 16-битный моно WAV; пик приводится к `peak`, чтобы звуки были ровными по громкости и без перегруза. */
export function wav(samples: Float32Array, peak: number): Uint8Array {
  let max = 0;
  for (const x of samples) max = Math.max(max, Math.abs(x));
  const k = max > 0 ? peak / max : 0;
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); v.setUint32(4, 36 + samples.length * 2, true); str(8, 'WAVE');
  str(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, RATE, true); v.setUint32(28, RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) v.setInt16(44 + 2 * i, Math.round(Math.max(-1, Math.min(1, samples[i] * k)) * 32767), true);
  return new Uint8Array(buf);
}

export const SOUND_IDS: SoundId[] = ['right', 'hint'];
