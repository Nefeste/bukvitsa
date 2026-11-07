// Настройки игрока (src/state/settings.ts) и итоги задач (src/state/progress.ts).
import { describe, expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { lessMotionOf, parseSettings } from '../../src/state/settings';
import { doneCount, nextOpen, parseResults } from '../../src/state/progress';

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
    expect(parseResults('{"a":{"done":true,"hints":2.7,"mistakes":-1},"b":5,"c":null}')).toEqual({ a: { done: true, hints: 2, mistakes: 0, shown: false } });
    expect(parseResults('{')).toEqual({});
  });
  test('сколько решено и первая нерешённая', () => {
    const rs = parseResults('{"a":{"done":true},"b":{"done":false}}');
    expect(doneCount(rs, ['a', 'b', 'c'])).toBe(1);
    expect(nextOpen(rs, ['a', 'b', 'c'])).toBe('b');
    expect(nextOpen(rs, ['a'])).toBeNull();
  });
});
