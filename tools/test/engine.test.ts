// Движок: слова, задачи четырёх видов, даты календаря, строка итога (docs/06-testing.md).
import { describe, expect, test } from 'bun:test';
import {
  archiveDates,
  calendarIndex,
  cleanCount,
  dailyTasks,
  dateOf,
  dayNumber,
  endingChoices,
  endingSplit,
  extraText,
  extraWords,
  gapAnswer,
  gapCheck,
  gapTiles,
  marksLine,
  partsCheck,
  partsInOrder,
  partsShuffled,
  tokens,
  words,
  type Task,
} from '../../src/engine';

const base = { level: 1 as const, proverb: 'dal.test.1.1', section: 'Проба' };
const gap: Task = { ...base, id: 't.test.1', kind: 'gap', text: 'Тише едешь — дальше будешь.', word: 2 };
const ending: Task = { ...base, id: 't.test.2', kind: 'ending', text: 'Тише едешь — дальше будешь.', cut: 2, wrong: ['не беда платить.', 'и каши не сварить.', 'к оттепели.'] };
const parts: Task = { ...base, id: 't.test.3', kind: 'parts', text: 'Не то хлеб, что в поле, а то, что в сусеке.', starts: [0, 3, 8] };
const extra: Task = { ...base, id: 't.test.4', kind: 'extra', text: 'Тише едешь — дальше будешь.', word: 2, at: 2, letter: 'о' };

describe('слова', () => {
  test('слова и промежутки, дефис внутри слова', () => {
    expect(words('Кое-как, да не так.')).toEqual(['Кое-как', 'да', 'не', 'так']);
    expect(tokens('Тише едешь — дальше будешь.').map(t => t.text).join('')).toBe('Тише едешь — дальше будешь.');
  });
});

describe('пропущенное слово', () => {
  test('ряд: все буквы ответа и две лишние на уровне 1, у всех одинаковый', () => {
    expect(gapAnswer(gap)).toBe('дальше');
    const tiles = gapTiles(gap);
    expect(tiles.length).toBe(6 + 2);
    for (const c of 'ДАЛЬШЕ') expect(tiles).toContain(c);
    expect(gapTiles(gap)).toEqual(tiles);
  });
  test('проверка по местам, ё как е', () => {
    expect(gapCheck(gap, ['Д', 'А', 'Л', 'Ь', 'Ш', 'Е'])).toEqual([true, true, true, true, true, true]);
    expect(gapCheck(gap, ['Д', 'О', 'Л', null, 'Ш', 'Ё'])).toEqual([true, false, true, false, true, true]);
  });
});

describe('конец пословицы', () => {
  test('начало и конец, четыре варианта в одном порядке', () => {
    expect(endingSplit(ending)).toEqual({ head: 'Тише едешь —', tail: 'дальше будешь.' });
    const c = endingChoices(ending);
    expect(c.length).toBe(4);
    expect(c).toContain('дальше будешь.');
    expect(endingChoices(ending)).toEqual(c);
  });
});

describe('по частям', () => {
  test('части по порядку и вперемешку — никогда не в верном порядке', () => {
    expect(partsInOrder(parts)).toEqual(['Не то хлеб,', 'что в поле, а то,', 'что в сусеке.']);
    const s = partsShuffled(parts);
    expect(s.slice().sort()).toEqual([0, 1, 2]);
    expect(s).not.toEqual([0, 1, 2]);
    expect(partsCheck(parts, [0, 1, 2])).toBe(true);
    expect(partsCheck(parts, [1, 0, 2])).toBe(false);
  });
});

describe('лишняя буква', () => {
  test('буква — внутри нужного слова, остальное как в источнике', () => {
    expect(extraWords(extra)).toEqual(['Тише', 'едешь', 'даольше', 'будешь']);
    expect(extraText(extra).map(t => t.text).join('')).toBe('Тише едешь — даольше будешь.');
  });
});

describe('календарь', () => {
  test('даты туда и обратно, високосный год', () => {
    for (const d of ['1970-01-01', '2026-12-01', '2027-02-28', '2028-02-29', '2028-03-01', '2026-12-31']) expect(dateOf(dayNumber(d))).toBe(d);
    expect(dayNumber('2027-01-01') - dayNumber('2026-12-31')).toBe(1);
    expect(dayNumber('2028-03-01') - dayNumber('2028-02-28')).toBe(2);
    expect(() => dayNumber('2026-13-01')).toThrow();
  });
  test('день календаря: до начала — первый, после конца — по кругу; архив — с начала до сегодня', () => {
    const cal = { from: '2026-12-01', days: [['a'], ['b'], ['c']] };
    expect(calendarIndex(cal, '2026-11-20')).toBe(0);
    expect(dailyTasks(cal, '2026-12-02')).toEqual(['b']);
    expect(dailyTasks(cal, '2026-12-04')).toEqual(['a']);
    expect(archiveDates(cal, '2026-12-03')).toEqual(['2026-12-03', '2026-12-02', '2026-12-01']);
    expect(archiveDates(cal, '2026-11-30')).toEqual([]);
  });
  test('строка итога: сами, с помощью, открыт, не решена', () => {
    const r = [
      { done: true, hints: 0, mistakes: 0, shown: false },
      { done: true, hints: 1, mistakes: 0, shown: false },
      { done: true, hints: 0, mistakes: 0, shown: true },
      undefined,
    ];
    expect(marksLine(r)).toBe('●◐○·');
    expect(cleanCount(r)).toBe(1);
  });
});
