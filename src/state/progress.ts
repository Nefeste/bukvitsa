// Что игрок решил: итог по каждой задаче. Чистые функции — их проверяют тесты; хранит src/state/storage.ts.
// Схема 1 в docs/04-data-model.md — список событий в файле; до 0.2 итоги хранятся проще (см. «Что изменилось»).
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
      out[id] = { done: x.done === true, tries: num(x.tries), hints: Math.min(2, num(x.hints)), peeked: x.peeked === true };
    }
    return out;
  } catch {
    return {};
  }
}

export function resultOf(rs: Results, id: string): Result {
  return rs[id] ?? EMPTY_RESULT;
}

/** Сколько задач из списка решено (подсмотренные не считаются) и сколько подсмотрено. */
export function counts(rs: Results, ids: readonly string[]): { done: number; peeked: number } {
  return {
    done: ids.filter(id => rs[id]?.done && !rs[id]?.peeked).length,
    peeked: ids.filter(id => rs[id]?.peeked).length,
  };
}

/** Следующая нерешённая задача списка после `after` (по кругу); все решены — `null`. */
export function nextOpen(rs: Results, ids: readonly string[], after?: string): string | null {
  const start = after ? ids.indexOf(after) + 1 : 0;
  for (let k = 0; k < ids.length; k++) {
    const id = ids[(start + k) % ids.length];
    if (id !== after && (!rs[id]?.done || rs[id]?.peeked)) return id;
  }
  return null;
}
