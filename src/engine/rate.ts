// Когда попросить оценку в RuStore (08-game-design.md, «Оценка в RuStore»): один раз — после второй решённой
// тетради, на экране тетради, а не посреди задачи; отказ — больше не просит. Чистая функция: решённые задачи и
// «уже просили» — аргументы.

/** Решённых тетрадей, после которых просить оценку. */
export const RATE_AFTER_NOTEBOOKS = 2;

/** Пора ли попросить оценку: тетрадь `book` решена целиком, решённых тетрадей — не меньше двух, ещё не просили. */
export function rateDue(notebooks: readonly { key: string; tasks: readonly string[] }[], solved: (id: string) => boolean, book: string, asked: boolean): boolean {
  if (asked) return false;
  const done = notebooks.filter(b => b.tasks.length > 0 && b.tasks.every(solved));
  return done.some(b => b.key === book) && done.length >= RATE_AFTER_NOTEBOOKS;
}
