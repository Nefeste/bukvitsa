// Сохранение схемы 1 (src/state/save.ts, migrations.ts; docs/04-data-model.md, «Телефон»): образцы файлов
// из tools/test/fixtures/saves/ читаются текущим кодом; схему нельзя поднять без образца и шага миграции.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { LATEST, migrate } from '../../src/state/migrations';
import { parseResults } from '../../src/state/progress';
import { countersOf, emptySave, eventOfResult, eventsOfResults, parseSave, resultsOf, SCHEMA, withEvent, type Save } from '../../src/state/save';
import { darkOf, parseSettings } from '../../src/state/settings';

const DIR = join(import.meta.dir, 'fixtures/saves');
const read = (f: string) => readFileSync(join(DIR, f), 'utf8');

describe('образцы сохранения', () => {
  test('для каждой схемы от 1 до текущей есть образец, и он читается', () => {
    expect(LATEST).toBe(SCHEMA);
    const files = readdirSync(DIR).filter(f => /^schema-\d+\.json$/.test(f));
    for (let n = 1; n <= SCHEMA; n++) expect(files).toContain(`schema-${n}.json`);
    for (const f of files) {
      const s = parseSave(read(f), '2027-01-01');
      expect(s && s !== 'broken' && s.schema).toBe(SCHEMA);
    }
  });
  test('схема 1: итоги, счётчики, настройки и отметка оценки', () => {
    const s = parseSave(read('schema-1.json'), '2027-01-01') as Save;
    expect(s.installedOn).toBe('2026-12-01');
    expect(s.events).toHaveLength(5);
    const rs = resultsOf(s.events);
    expect(rs['proverb-0001']).toEqual({ done: true, tries: 1, hints: 0, peeked: false });
    // подсмотренная, потом решённая заново — считается последнее
    expect(rs['riddle-0001']).toEqual({ done: true, tries: 2, hints: 1, peeked: false });
    expect(rs['parts-0001'].peeked).toBe(true);
    expect(s.counters).toEqual({ solved: 2, peeked: 1, days: 2 });
    expect(s.settings).toEqual({ lessMotion: true, adsConsent: 'no', theme: 'dark', bigger: true });
    expect(s.rateAsked).toBe(true);
  });
  test('итоги 0.1 из AsyncStorage → события; незаконченная задача не переносится', () => {
    const legacy = JSON.parse(read('legacy-0.1.json')) as Record<string, string>;
    const ev = eventsOfResults(parseResults(legacy['bukvitsa.results.v1']), '2026-11-20');
    expect(ev).toEqual([
      { t: 'solved', id: 'proverb-0001', day: '2026-11-20', tries: 2, hints: 1 },
      { t: 'peeked', id: 'riddle-0001', day: '2026-11-20' },
    ]);
    expect(parseSettings(legacy['bukvitsa.settings.v1'])).toEqual({ lessMotion: false, adsConsent: 'yes' });
  });
});

describe('нечитаемое', () => {
  test('нет файла — null; не JSON, чужая и будущая схема — broken', () => {
    expect(parseSave(null, '2026-12-01')).toBeNull();
    expect(parseSave('', '2026-12-01')).toBeNull();
    for (const raw of ['{', '[]', '"x"', '{}', '{"schema":0}', '{"schema":2}', '{"schema":"1"}']) expect(parseSave(raw, '2026-12-01')).toBe('broken');
    expect(migrate({ schema: SCHEMA + 1 })).toBeNull();
  });
  test('битые события отбрасываются по одному, остальное остаётся', () => {
    const raw = JSON.stringify({
      schema: 1,
      installedOn: 'вчера',
      events: [null, { t: 'solved', id: 'a', day: '2026-12-01', tries: -3, hints: 9 }, { t: 'zzz', id: 'b', day: '2026-12-01' }, { t: 'peeked', id: '', day: '2026-12-01' }, { t: 'peeked', id: 'c', day: '1.12.2026' }],
      settings: { theme: 'blue', bigger: 'да' },
    });
    const s = parseSave(raw, '2026-12-05') as Save;
    expect(s.events).toEqual([{ t: 'solved', id: 'a', day: '2026-12-01', tries: 1, hints: 2 }]);
    expect(s.installedOn).toBe('2026-12-05');
    expect(s.settings).toEqual({});
  });
});

describe('события', () => {
  test('итог движка → событие; незаконченная — ничего', () => {
    expect(eventOfResult('a', { done: false, tries: 1, hints: 0, peeked: false }, '2026-12-01')).toBeNull();
    expect(eventOfResult('a', { done: true, tries: 3, hints: 1, peeked: false }, '2026-12-01')).toEqual({ t: 'solved', id: 'a', day: '2026-12-01', tries: 3, hints: 1 });
    expect(eventOfResult('a', { done: true, tries: 0, hints: 2, peeked: true }, '2026-12-01')).toEqual({ t: 'peeked', id: 'a', day: '2026-12-01' });
  });
  test('счётчики и «поделиться» не меняют итогов', () => {
    let s = emptySave('2026-12-01');
    s = withEvent(s, { t: 'solved', id: 'a', day: '2026-12-01', tries: 1, hints: 0 });
    s = withEvent(s, { t: 'shared', id: 'a', day: '2026-12-01' });
    s = withEvent(s, { t: 'solved', id: 'b', day: '2026-12-01', tries: 1, hints: 0 });
    expect(s.counters).toEqual({ solved: 2, peeked: 0, days: 1 });
    expect(Object.keys(resultsOf(s.events))).toEqual(['a', 'b']);
    expect(countersOf([])).toEqual({ solved: 0, peeked: 0, days: 0 });
  });
  test('записанное читается обратно тем же', () => {
    const s = parseSave(read('schema-1.json'), '2027-01-01') as Save;
    expect(parseSave(JSON.stringify(s), '2030-01-01')).toEqual(s);
  });
});

describe('тема', () => {
  test('выбор игрока важнее темы телефона', () => {
    expect(darkOf({}, true)).toBe(true);
    expect(darkOf({}, false)).toBe(false);
    expect(darkOf({ theme: 'light' }, true)).toBe(false);
    expect(darkOf({ theme: 'dark' }, false)).toBe(true);
  });
});
