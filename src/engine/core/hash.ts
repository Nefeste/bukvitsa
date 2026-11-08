// из shelter: src/engine/core/hash.ts @ fa04538 (оттуда — из skazy @ 2789f72 и anamnez @ 3d76cf5) — только fnv1a.
// Хеш для детерминизма: имена ветвей генератора (ADR студии 0004).
// Только целочисленная арифметика (Math.imul, сдвиги) — одинаково в Hermes, V8 и Bun.

/** FNV-1a, 32 бита, по кодам символов строки. */
export function fnv1a(text: string, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}
