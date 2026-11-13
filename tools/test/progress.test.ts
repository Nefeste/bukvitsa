// Сборник и «Продолжить» (08-game-design.md, «Сборник», «Игровой цикл»): начисто, звания, следующая задача.
import { describe, expect, test } from 'bun:test';
import { cleanCount, isClean, rankOf, RANKS, resume, solvedIds, type Results } from '../../src/state/progress';

const ok = (tries = 1, hints = 0) => ({ done: true, tries, hints, peeked: false });
const peek = { done: true, tries: 0, hints: 2, peeked: true };

describe('сборник', () => {
  test('начисто — с первой попытки и без подсказок; подсмотренная в сборник не идёт', () => {
    expect(isClean(ok())).toBe(true);
    expect(isClean(ok(2))).toBe(false);
    expect(isClean(ok(1, 1))).toBe(false);
    expect(isClean(peek)).toBe(false);
    expect(isClean(undefined)).toBe(false);
    const rs: Results = { a: ok(), b: ok(3), c: peek };
    expect(cleanCount(rs, ['a', 'b', 'c', 'd'])).toBe(1);
    expect(solvedIds(rs, ['a', 'b', 'c', 'd'])).toEqual(['a', 'b']);
  });
  test('звания: пороги растут, звание не теряется и даётся ровно на пороге', () => {
    expect([...RANKS]).toEqual([...RANKS].sort((a, b) => a - b));
    expect(rankOf(0)).toEqual({ rank: -1, next: RANKS[0] });
    expect(rankOf(RANKS[0] - 1).rank).toBe(-1);
    expect(rankOf(RANKS[0])).toEqual({ rank: 0, next: RANKS[1] });
    expect(rankOf(RANKS[RANKS.length - 1] + 500)).toEqual({ rank: RANKS.length - 1, next: null });
  });
});

describe('«Продолжить»', () => {
  const books = [
    { key: 'first', tasks: ['a', 'b', 'c'] },
    { key: 'mind', tasks: ['d', 'e', 'f'] },
  ];
  const all = () => 99;
  test('с нуля — первая задача первой тетради; дальше — следующая нерешённая, подсмотренная тоже ждёт', () => {
    expect(resume({}, books, all)).toEqual({ key: 'first', id: 'a', index: 0 });
    expect(resume({ a: ok(), b: peek }, books, all, 'a')).toEqual({ key: 'first', id: 'b', index: 1 });
  });
  test('сперва тетрадь, где решали последней', () => {
    expect(resume({ a: ok(), d: ok() }, books, all, 'd')).toEqual({ key: 'mind', id: 'e', index: 1 });
  });
  test('закрытые задачи не предлагаются: тетрадь кончилась открытой частью — идём в другую; всё решено — null', () => {
    const open = (key: string) => (key === 'mind' ? 1 : 99);
    expect(resume({ d: ok() }, books, open, 'd')).toEqual({ key: 'first', id: 'a', index: 0 });
    expect(resume({ a: ok(), b: ok(), c: ok(), d: ok() }, books, open, 'd')).toBeNull();
  });
});
