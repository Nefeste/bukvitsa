// Настройки игрока (src/state/settings.ts) и итоги задач (src/state/progress.ts).
import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { lessMotionOf, parseSettings } from '../../src/state/settings';
import { counts, nextOpen, parseResults } from '../../src/state/progress';

const SRC = join(import.meta.dir, '../../src');
const all = (readdirSync(SRC, { recursive: true }) as string[]).filter(p => /\.tsx?$/.test(p) && !p.includes('generated'));

describe('настройки', () => {
  test('пусто и мусор — «меньше движения» как в системе; выбор игрока важнее системы', () => {
    for (const raw of [null, '', '{', '[]', '"x"', '{"lessMotion":1}']) {
      const s = parseSettings(raw);
      expect(lessMotionOf(s, false)).toBe(false);
      expect(lessMotionOf(s, true)).toBe(true);
    }
    expect(lessMotionOf(parseSettings('{"lessMotion":false}'), true)).toBe(false);
    expect(lessMotionOf(parseSettings('{"lessMotion":true}'), false)).toBe(true);
  });
  test('вибрации в игре нет — выключатель вибрации не нужен', () => {
    for (const p of all) expect({ p, s: /Vibration|expo-haptics/.test(readFileSync(join(SRC, p), 'utf8')) }).toEqual({ p, s: false });
  });
  test('анимация — только вместе с «меньше движения»', () => {
    for (const p of all) {
      const s = readFileSync(join(SRC, p), 'utf8');
      if (/Animated\.(loop|spring|timing|decay)|LayoutAnimation/.test(s)) expect({ p, ok: s.includes('useLessMotion()') }).toEqual({ p, ok: true });
    }
  });
});

describe('итоги', () => {
  test('битое отбрасывается по записи, числа — целые неотрицательные', () => {
    expect(parseResults('{"a":{"done":true,"hints":5.7,"tries":-1},"b":5,"c":null}')).toEqual({ a: { done: true, tries: 0, hints: 2, peeked: false } });
    expect(parseResults('{')).toEqual({});
  });
  test('сколько решено и подсмотрено; «Ещё» — следующая нерешённая, подсмотренная — тоже', () => {
    const rs = parseResults('{"a":{"done":true},"b":{"done":true,"peeked":true},"c":{"done":false}}');
    expect(counts(rs, ['a', 'b', 'c'])).toEqual({ done: 1, peeked: 1 });
    expect(nextOpen(rs, ['a', 'b', 'c'], 'a')).toBe('b');
    expect(nextOpen(rs, ['a'], 'a')).toBeNull();
  });
});
