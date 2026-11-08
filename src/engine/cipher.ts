// «Тайнопись» — буква на число (ADR 0009, specs/2026-11-cipher.md): пословица клетками, под клеткой — число буквы.
// Числа (`task.code`) и открытые с начала буквы (`task.open`) готовит сборка; здесь — только чтение задачи.
import { WORD, norm } from './letters';
import type { Task } from './types';

export { ALPHABET } from './letters';

/** Буквы текста по порядку, прописные, ё как е; дефис — не буква. */
export function textLetters(text: string): string[] {
  return (text.match(WORD) ?? []).join('').replace(/-/g, '').split('').map(norm);
}

/** Ключ задачи: буква каждого числа (номер в массиве — число минус один). */
export function cipherKey(task: Task): string[] {
  const code = task.code ?? [];
  const key: string[] = [];
  textLetters(task.text).forEach((c, i) => {
    key[code[i] - 1] = c;
  });
  return key;
}

/** Сколько разных чисел в задаче. */
export const cipherSize = (task: Task) => Math.max(0, ...(task.code ?? []));
