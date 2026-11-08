// Сохранение игры — схема 1 (docs/04-data-model.md, «Телефон»): список событий, настройки, день установки,
// счётчики. Чистые функции — их проверяют тесты на образцах tools/test/fixtures/saves/; читает и пишет
// src/state/storage.ts. Итоги задач для экранов («12 из 40», значки, архив) выводятся из событий.
import { EMPTY_RESULT, type Result } from '../engine/types';
import { migrate } from './migrations';
import type { Results } from './progress';
import { parseSettings, type Settings } from './settings';

/** Версия схемы. Поднять — только с шагом в migrations.ts и образцом `schema-N.json` (тест не даст иначе). */
export const SCHEMA = 1;

export type Event =
  | { t: 'solved'; id: string; day: string; tries: number; hints: 0 | 1 | 2 }
  | { t: 'peeked'; id: string; day: string }
  | { t: 'shared'; id: string; day: string };

export interface Counters {
  solved: number;
  peeked: number;
  /** дней, в которые решена хоть одна задача */
  days: number;
}

export interface Save {
  schema: typeof SCHEMA;
  events: Event[];
  settings: Settings;
  /** первый запуск — для правила «не в первый день» и для «Об игре» */
  installedOn: string;
  counters: Counters;
  /** форму оценки RuStore уже показывали (08-game-design.md, «Оценка в RuStore») — больше не просить */
  rateAsked?: boolean;
}

export const emptySave = (today: string): Save => ({ schema: SCHEMA, events: [], settings: {}, installedOn: today, counters: { solved: 0, peeked: 0, days: 0 } });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const isId = (v: unknown): v is string => typeof v === 'string' && v.length > 0 && v.length < 64;
const int = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);

/** Одно событие из файла; битое — `null` (отбрасывается, остальные остаются). */
function eventOf(v: unknown): Event | null {
  if (!v || typeof v !== 'object') return null;
  const e = v as Record<string, unknown>;
  if (!isId(e.id) || typeof e.day !== 'string' || !DAY.test(e.day)) return null;
  if (e.t === 'solved') return { t: 'solved', id: e.id, day: e.day, tries: Math.max(1, int(e.tries)), hints: Math.min(2, int(e.hints)) as 0 | 1 | 2 };
  if (e.t === 'peeked' || e.t === 'shared') return { t: e.t, id: e.id, day: e.day };
  return null;
}

/** Итоги задач из событий: о задаче считается последнее событие «решена» или «подсмотрена». */
export function resultsOf(events: readonly Event[]): Results {
  const out: Results = {};
  for (const e of events) {
    if (e.t === 'solved') out[e.id] = { done: true, tries: e.tries, hints: e.hints, peeked: false };
    else if (e.t === 'peeked') out[e.id] = { done: true, tries: 0, hints: 2, peeked: true };
  }
  return out;
}

export function countersOf(events: readonly Event[]): Counters {
  const rs = Object.values(resultsOf(events));
  const days = new Set(events.filter(e => e.t === 'solved').map(e => e.day));
  return { solved: rs.filter(r => !r.peeked).length, peeked: rs.filter(r => r.peeked).length, days: days.size };
}

/** Событие из итога задачи, который вернул движок (решена или подсмотрена). Не закончена — `null`. */
export function eventOfResult(id: string, r: Result, day: string): Event | null {
  if (!r.done) return null;
  if (r.peeked) return { t: 'peeked', id, day };
  return { t: 'solved', id, day, tries: Math.max(1, r.tries), hints: Math.min(2, r.hints) as 0 | 1 | 2 };
}

export function withEvent(s: Save, e: Event): Save {
  const events = [...s.events, e];
  return { ...s, events, counters: countersOf(events) };
}

/**
 * Строка файла → сохранение. `null` — файла нет; `'broken'` — не читается (не JSON, чужая или будущая
 * схема): игра начинает с чистого, а строку откладывает рядом (src/state/storage.ts).
 */
export function parseSave(raw: string | null, today: string): Save | null | 'broken' {
  if (raw == null || raw === '') return null;
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return 'broken';
  }
  const m = migrate(v);
  if (!m) return 'broken';
  const events = (Array.isArray(m.events) ? m.events : []).map(eventOf).filter((e): e is Event => e !== null);
  const installedOn = typeof m.installedOn === 'string' && DAY.test(m.installedOn) ? m.installedOn : today;
  const settings = parseSettings(JSON.stringify(m.settings ?? {}));
  const out: Save = { schema: SCHEMA, events, settings, installedOn, counters: countersOf(events) };
  if (m.rateAsked === true) out.rateAsked = true;
  return out;
}

/** Старые итоги 0.1 (`bukvitsa.results.v1`) → события. Дня решения в них нет — ставится день переноса. */
export function eventsOfResults(rs: Results, day: string): Event[] {
  const out: Event[] = [];
  for (const [id, r] of Object.entries(rs)) {
    const e = eventOfResult(id, { ...EMPTY_RESULT, ...r }, day);
    if (e && isId(id)) out.push(e);
  }
  return out;
}
