// Что игрок решил: итог по каждой задаче. Чистые функции — их проверяют тесты; хранит src/state/storage.ts.
import { EMPTY_RESULT, type Result } from '../engine/types';

export type Results = Record<string, Result>;

/** Сохранённая строка → итоги; битое отбрасывается по одной записи. */
export function parseResults(raw: string | null): Results {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : {};
    if (!v || typeof v !== 'object') return {};
    const out: Results = {};
    for (const [id, r] of Object.entries(v as Record<string, unknown>)) {
      if (!r || typeof r !== 'object') continue;
      const x = r as Partial<Result>;
      const num = (n: unknown) => (typeof n === 'number' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0);
      out[id] = { done: x.done === true, hints: num(x.hints), mistakes: num(x.mistakes), shown: x.shown === true };
    }
    return out;
  } catch {
    return {};
  }
}

export function resultOf(rs: Results, id: string): Result {
  return rs[id] ?? EMPTY_RESULT;
}

/** Сколько задач из списка решено. */
export function doneCount(rs: Results, ids: readonly string[]): number {
  return ids.filter(id => rs[id]?.done).length;
}

/** Первая нерешённая задача списка; все решены — `null`. */
export function nextOpen(rs: Results, ids: readonly string[]): string | null {
  return ids.find(id => !rs[id]?.done) ?? null;
}
