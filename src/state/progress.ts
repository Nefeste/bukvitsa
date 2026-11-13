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

/** Решена начисто: с первой попытки и без подсказок. */
export const isClean = (r: Result | undefined): boolean => !!r && r.done && !r.peeked && r.tries <= 1 && r.hints === 0;

/** Сколько задач из списка решено начисто. */
export const cleanCount = (rs: Results, ids: readonly string[]): number => ids.filter(id => isClean(rs[id])).length;

/** Звания сборника: сколько задач решено — числа из 08-game-design.md, «Сборник»; меняются только вместе с ним. */
export const RANKS = [10, 30, 75, 150, 250] as const;

/** Звание по числу решённых: `rank` — номер достигнутого (−1 — ещё нет), `next` — порог следующего или `null`. */
export function rankOf(solved: number): { rank: number; next: number | null } {
  let rank = -1;
  while (rank + 1 < RANKS.length && solved >= RANKS[rank + 1]) rank++;
  return { rank, next: RANKS[rank + 1] ?? null };
}

/** Всего решено (подсмотренные не в счёт) среди задач набора. */
export const solvedIds = (rs: Results, ids: readonly string[]): string[] => ids.filter(id => rs[id]?.done && !rs[id]?.peeked);

/**
 * «Продолжить»: тетрадь и её следующая открытая нерешённая задача. Сперва тетрадь, где решали последней
 * (`lastId` — последняя решённая задача), потом остальные по порядку; нигде нет — `null`.
 */
export function resume(
  rs: Results,
  books: readonly { key: string; tasks: readonly string[] }[],
  openIn: (key: string) => number,
  lastId?: string,
): { key: string; id: string; index: number } | null {
  const last = lastId ? books.find(b => b.tasks.includes(lastId)) : undefined;
  for (const b of last ? [last, ...books.filter(x => x !== last)] : books) {
    const n = openIn(b.key);
    const index = b.tasks.findIndex((id, i) => i < n && (!rs[id]?.done || rs[id]?.peeked));
    if (index >= 0) return { key: b.key, id: b.tasks[index], index };
  }
  return null;
}
