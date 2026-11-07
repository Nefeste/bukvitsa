// Содержание: сборка без ошибок, разбор Даля, запрещённые слова, календарь (docs/09-content.md).
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { build } from '../content/build';
import { clean, mainReading, slugOf, splitLine } from '../content/dal';
import { bannedWord } from '../content/pool';
import { fromRendered } from '../content/fetch';
import { dayNumber } from '../../src/engine';

const ROOT = join(import.meta.dir, '../..');
const { bundle, errors } = build(ROOT);

describe('разбор Даля', () => {
  test('варианты и пояснения в скобках уходят в заметку, ударения — прочь', () => {
    const line = clean("Некстати печальна, не к лицу (<small>или:</small> не к добру) весела.");
    expect(line).toBe('Некстати печальна, не к лицу (или: не к добру) весела.');
    expect(mainReading(line)).toEqual({ text: 'Некстати печальна, не к лицу весела.', note: 'или: не к добру' });
    expect(clean('раскве́лишь')).toBe('расквелишь');
  });
  test('строка — несколько пословиц; одиночная буква с точкой — не граница', () => {
    expect(splitLine('Такой стих нашел. Недобрый на него стих нашел.')).toEqual(['Такой стих нашел.', 'Недобрый на него стих нашел.']);
    expect(splitLine('Где наше не пропадало!')).toEqual(['Где наше не пропадало!']);
  });
  test('идентификатор раздела латиницей', () => {
    expect(slugOf('Счастье — Удача')).toBe('schaste-udacha');
  });
  test('страница скана → строки, без навигации и номеров', () => {
    const out = fromRendered('<p>← Назад Пословицы →</p><p>2. На дворе мороз, а в избе тепло.</p><p>[</p><p>490</p><p>Январь</p>', 'Месяцеслов');
    expect(out).toBe('== Месяцеслов ==\n: На дворе мороз, а в избе тепло.\n');
  });
  test('запрещённые слова: основа — начало слова, «=» — слово целиком', () => {
    expect(bannedWord('Работа не волк.', ['=раб'])).toBeNull();
    expect(bannedWord('Раб не волен.', ['=раб'])).toBe('=раб');
    expect(bannedWord('Пьяному море по колено.', ['пьян'])).toBe('пьян');
    expect(bannedWord('Ворота настежь.', ['=вор'])).toBeNull();
  });
});

describe('сборка содержания', () => {
  test('без ошибок', () => {
    expect(errors).toEqual([]);
  });
  test('тетради полны, в календаре запас дней на сезон', () => {
    for (const b of bundle.notebooks) expect({ b: b.id, n: b.tasks.length }).toEqual({ b: b.id, n: 30 });
    expect(bundle.calendar.days.length).toBeGreaterThanOrEqual(120);
    expect(bundle.calendar.days.every(d => d.length === 5)).toBe(true);
    expect(dayNumber(bundle.calendar.from)).toBeGreaterThan(0);
  });
  test('каждая задача — из источника, с разделом; одна пословица — одна задача', () => {
    const seen = new Set<string>();
    for (const t of Object.values(bundle.tasks)) {
      expect(t.proverb.startsWith('dal.')).toBe(true);
      expect(t.section.length).toBeGreaterThan(0);
      expect(seen.has(t.proverb)).toBe(false);
      seen.add(t.proverb);
    }
  });
  test('все записи — черновики, пока их не проверил человек', () => {
    expect(bundle.draft).toBe(Object.keys(bundle.tasks).length);
  });
});
