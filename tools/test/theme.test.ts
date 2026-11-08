// Тема (src/ui/theme.ts): контраст текста не ниже 4,5 : 1 в обеих темах (08-game-design.md, «Вид»);
// «ещё крупнее» — ×1,25.
import { describe, expect, test } from 'bun:test';
import { BIGGER, DARK, LIGHT, type Palette } from '../../src/ui/theme';

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

/** Пары «текст — фон», которые есть на экранах. */
const PAIRS: [keyof Palette, keyof Palette][] = [
  ['ink', 'linen'], ['ink', 'paper'], ['ink', 'cell'], ['inkSoft', 'linen'], ['inkSoft', 'paper'], ['inkSoft', 'cell'],
  ['spruce', 'paper'], ['spruce', 'linen'], ['kumachInk', 'kumach'],
];

describe('тема', () => {
  for (const [name, p] of [['светлая', LIGHT], ['тёмная', DARK]] as const)
    test(`${name}: контраст текста ≥ 4,5 : 1`, () => {
      for (const [fg, bg] of PAIRS) expect({ fg, bg, ok: ratio(p[fg] as string, p[bg] as string) >= 4.5 }).toEqual({ fg, bg, ok: true });
    });
  test('«ещё крупнее» — на четверть', () => expect(BIGGER).toBe(1.25));
});
