// Движок: слова, календарь без Date, задача дня и архив (specs/2026-10-engine.md, 2026-10-daily.md).
import { describe, expect, test } from 'bun:test';
import { archive, daily, dateOf, dayNumber, RATE_AFTER_NOTEBOOKS, rateDue, tokens, weekday, words } from '../../src/engine';

describe('слова', () => {
  test('слова и промежутки, дефис внутри слова', () => {
    expect(words('Кое-как, да не так.')).toEqual(['Кое-как', 'да', 'не', 'так']);
    expect(tokens('Тише едешь — дальше будешь.').map(t => t.text).join('')).toBe('Тише едешь — дальше будешь.');
  });
});

describe('календарь', () => {
  test('даты туда и обратно, високосный год, день недели', () => {
    for (const d of ['1970-01-01', '2026-12-01', '2027-02-28', '2028-02-29', '2028-03-01']) expect(dateOf(dayNumber(d))).toBe(d);
    expect(dayNumber('2028-03-01') - dayNumber('2028-02-28')).toBe(2);
    expect(weekday('2026-12-07')).toBe(0); // понедельник
    expect(weekday('2026-12-13')).toBe(6); // воскресенье
    expect(() => dayNumber('2026-13-01')).toThrow();
  });
  test('задача дня — по дате; архив — от начала до вчера, новые первыми; будущих нет', () => {
    const cal = { from: '2026-12-01', days: { '2026-12-01': 'a', '2026-12-02': 'b', '2026-12-03': 'c' } };
    expect(daily(cal, '2026-12-02')).toBe('b');
    expect(daily(cal, '2026-12-04')).toBeUndefined();
    expect(archive(cal, '2026-12-03')).toEqual(['2026-12-02', '2026-12-01']);
    expect(archive(cal, '2026-12-01')).toEqual([]);
  });
});

describe('оценка в RuStore', () => {
  const books = [
    { key: 'a', tasks: ['a1', 'a2'] },
    { key: 'b', tasks: ['b1'] },
    { key: 'c', tasks: [] },
    { key: 'd', tasks: ['d1'] },
  ];
  const by = (ids: string[]) => (id: string) => ids.includes(id);
  test('после второй решённой тетради, на её экране, один раз', () => {
    expect(rateDue(books, by(['a1', 'a2']), 'a', false)).toBe(false);
    expect(rateDue(books, by(['a1', 'a2', 'b1']), 'b', false)).toBe(true);
    expect(rateDue(books, by(['a1', 'a2', 'b1']), 'a', false)).toBe(true);
    expect(rateDue(books, by(['a1', 'a2', 'b1']), 'd', false)).toBe(false);
    expect(rateDue(books, by(['a1', 'a2', 'b1']), 'b', true)).toBe(false);
  });
  test('пустая тетрадь решённой не считается', () => {
    expect(rateDue(books, by(['b1']), 'b', false)).toBe(false);
    expect(RATE_AFTER_NOTEBOOKS).toBe(2);
  });
});
