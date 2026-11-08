// Контент (09-content.md, specs/2026-10-content-pipeline.md): разбор Даля, отбор, ряд букв и
// перемешивание сборкой, проверки записей, календарь по дням недели.
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { build, toTask } from '../content/build';
import { clean, mainReading, slugOf, splitLine } from '../content/dal';
import { fromRendered } from '../content/fetch';
import { bannedWord } from '../content/pool';
import { extraCount, FREQUENT, letterRow } from '../content/shuffle';
import { WEEK } from '../content/calendar';
import { weekday } from '../../src/engine';
import type { Rec } from '../content/records';

const ROOT = join(import.meta.dir, '../..');
const { pack, errors } = build(ROOT);

describe('разбор Даля', () => {
  test('варианты и пояснения в скобках — в заметку, ударения — прочь', () => {
    const line = clean('Некстати печальна, не к лицу (<small>или:</small> не к добру) весела.');
    expect(mainReading(line)).toEqual({ text: 'Некстати печальна, не к лицу весела.', note: 'или: не к добру' });
    expect(clean('раскве́лишь')).toBe('расквелишь');
  });
  test('строка — несколько пословиц; раздел латиницей; страница скана → строки', () => {
    expect(splitLine('Такой стих нашел. Недобрый на него стих нашел.')).toEqual(['Такой стих нашел.', 'Недобрый на него стих нашел.']);
    expect(slugOf('Счастье — Удача')).toBe('schaste-udacha');
    expect(fromRendered('<p>← Назад →</p><p>2. На дворе мороз, а в избе тепло.</p><p>490</p>', 'Месяцеслов')).toBe('== Месяцеслов ==\n: На дворе мороз, а в избе тепло.\n');
  });
  test('запрещённые слова: основа — начало слова, «=» — слово целиком', () => {
    expect(bannedWord('Работа не волк.', ['=раб'])).toBeNull();
    expect(bannedWord('Пьяному море по колено.', ['пьян'])).toBe('пьян');
  });
});

describe('ряд букв и перемешивание — сборкой (ADR 0005)', () => {
  test('лишних букв 2 / 3 / 4 по длине ответа; их нет в ответе; из частых; одинаково при каждой сборке', () => {
    expect([extraCount(5), extraCount(6), extraCount(8), extraCount(9)]).toEqual([2, 3, 3, 4]);
    const row = letterRow('нечего', 'proverb-0001', 1);
    expect(row.length).toBe(9);
    const extra = row.filter((c, i) => row.indexOf(c) === i && !'нечего'.includes(c));
    for (const c of extra) expect(FREQUENT).toContain(c);
    expect(letterRow('нечего', 'proverb-0001', 1)).toEqual(row);
    expect(letterRow('нечего', 'proverb-0001', 2)).not.toEqual(row);
  });
  test('сломанные записи не проходят', () => {
    const src = { work: 'w', edition: 'e', section: 's', basis: 'общественное достояние', url: 'u', checked_against: 'c' };
    const bad = (r: Partial<Rec>) => {
      const e: string[] = [];
      toTask({ id: 'x', version: 1, review: 'draft', source: src, about: 'a', ...r } as Rec, e);
      return e.length;
    };
    expect(bad({ kind: 'proverb', text: 'Скучен день до вечера, коли делать нечего.', answer: 'нечего', gap: 6 })).toBe(1);
    expect(bad({ kind: 'proverb', text: 'Скучен день до вечера, коли делать нечего.', answer: 'нечего', gap: 7 })).toBe(0);
    expect(bad({ kind: 'riddle', text: 'Загадка', answer: 'ab' })).toBe(1);
    expect(bad({ kind: 'old-word', word: 'буквица', meaning: 'm', options: ['буквица', 'а', 'б'] })).toBe(1);
    expect(bad({ kind: 'parts', text: 'Не то хлеб, что в поле.', parts: ['Не то', 'хлеб,', 'что в огороде.'] })).toBe(1);
    expect(bad({ kind: 'extra-letter', text: 'Не работа сушит, а забота.', word: 2, letter: 'р', position: 1 })).toBe(1);
  });
});

describe('сборка content/', () => {
  test('без ошибок', () => {
    expect(errors).toEqual([]);
  });
  test('задачи — с источником и «Откуда это»; ряд — у пословиц и загадок; части — не в верном порядке', () => {
    for (const t of pack.tasks) {
      expect(t.source.length).toBeGreaterThan(0);
      expect(t.about.length).toBeGreaterThan(0);
      expect(t.about.length).toBeLessThanOrEqual(280);
      if (t.kind === 'proverb' || t.kind === 'riddle') expect(t.row!.length).toBe(t.answer.replace(/-/g, '').length + extraCount(t.answer.replace(/-/g, '').length));
      if (t.kind === 'parts') expect(t.answer).not.toBe(t.parts!.map((_, i) => i).join(','));
    }
  });
  test('календарь: задача дня не в тетради; виды — по дню недели, где есть задачи вида', () => {
    const kinds = new Map(pack.tasks.map(t => [t.id, t.kind]));
    const inBooks = new Set(pack.notebooks.flatMap(b => b.tasks));
    const days = Object.entries(pack.calendar.days);
    expect(days.length).toBeGreaterThanOrEqual(365);
    for (const [, id] of days) expect(inBooks.has(id)).toBe(false);
    // понедельник, пятница, четверг — всегда своего вида: пословиц, частей и букв хватает
    for (const [d, id] of days) if ([0, 3, 4, 5].includes(weekday(d))) expect({ d, k: kinds.get(id) }).toEqual({ d, k: WEEK[weekday(d)] });
  });
  test('первая тетрадь бесплатна и в ней все пять видов', () => {
    const first = pack.notebooks.find(b => b.key === 'first')!;
    expect(first.free).toBe(true);
    const kinds = new Set(first.tasks.map(id => pack.tasks.find(t => t.id === id)!.kind));
    expect([...kinds].sort()).toEqual(['extra-letter', 'old-word', 'parts', 'proverb', 'riddle']);
  });
});
