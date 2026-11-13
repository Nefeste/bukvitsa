// Что выпущено (docs/09-content.md, §5; ADR студии 0004): отпечаток задачи в выпуске. Выпущенная запись не меняет ни
// текста, ни ответа, ни ряда, ни вариантов без новой `version`; выпущенная дата календаря не меняется никогда
// (ADR 0002). Отпечатки пишет tools/content/release.ts, сверяет сборка (build.ts) и тест (tools/test/release.test.ts).
import { createHash } from 'node:crypto';
import type { Task } from '../../src/engine/types';

export interface Lock {
  /** выпуск, в который запись вошла последней версией, — «v1.0.0» */
  tag: string;
  version: number;
  /** sha256 того, что видит игрок: условие, ответ, ряд, варианты, слова, части, текст, о чём, источник */
  sha256: string;
}

/** Отпечаток задачи в выпуске: всё, что видит игрок, в постоянном порядке полей. */
export function taskHash(t: Task): string {
  const seen = [t.kind, t.prompt, t.answer, t.row ?? null, t.options ?? null, t.words ?? null, t.parts ?? null, ...(t.also ? [t.also] : []), t.text, t.about, t.source];
  return createHash('sha256').update(JSON.stringify(seen)).digest('hex');
}

/** Ошибки сверки: выпущенная версия записи изменилась (та же `version`, другой отпечаток) или версия ушла назад. */
export function lockErrors(tasks: readonly Task[], lock: Readonly<Record<string, Lock>>): string[] {
  const out: string[] = [];
  for (const t of tasks) {
    const l = lock[t.id];
    if (!l) continue;
    if (t.version < l.version) out.push(`${t.id}: version ${t.version} меньше выпущенной ${l.version} (${l.tag})`);
    else if (t.version === l.version && taskHash(t) !== l.sha256)
      out.push(`${t.id}: выпущенная в ${l.tag} запись version ${l.version} изменилась — исправление выходит новой version (ADR студии 0004)`);
  }
  return out;
}

/** Ошибки календаря: выпущенная дата пропала или указывает на другую запись. */
export function calendarErrors(days: Readonly<Record<string, string>>, released: Readonly<Record<string, string>>): string[] {
  return Object.entries(released)
    .filter(([d, id]) => days[d] !== id)
    .map(([d, id]) => `календарь, ${d}: выпущена ${id}, а сейчас ${days[d] ?? 'ничего'} — выпущенные даты не меняются (ADR 0002)`);
}
