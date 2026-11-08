// Шаги миграции сохранения (docs/04-data-model.md, «Миграции»; ADR студии 0004): объект схемы N → N+1.
// Каждый шаг — с образцом старого файла в tools/test/fixtures/saves/; забытая миграция стирает прогресс.
// Схема 1 — первая; итоги 0.1 из AsyncStorage переносятся отдельно (src/state/storage.ts, eventsOfResults).

type Raw = Record<string, unknown>;

/** Шаг из схемы `n` в `n + 1`. Пока схема одна — шагов нет. */
const STEPS: Record<number, (v: Raw) => Raw> = {};

/** Последняя схема, которую знает этот код (совпадает с SCHEMA в save.ts — проверяет тест). */
export const LATEST = 1;

/** Объект из файла → объект последней схемы; будущая или чужая схема — `null`. */
export function migrate(v: unknown): Raw | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  let o = v as Raw;
  let n = o.schema;
  if (typeof n !== 'number' || !Number.isInteger(n) || n < 1 || n > LATEST) return null;
  while (n < LATEST) {
    const step = STEPS[n];
    if (!step) return null;
    o = { ...step(o), schema: n + 1 };
    n += 1;
  }
  return o;
}
