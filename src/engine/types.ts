// Типы движка (docs/04-data-model.md, «Движок»). Движок чистый (устав, «Код»): без React, Date.now()
// и Math.random(); дата приходит строкой «ГГГГ-ММ-ДД»; ряд букв, варианты и части приходят из
// сборки уже перемешанными (ADR 0005).

export type Kind = 'proverb' | 'riddle' | 'extra-letter' | 'old-word' | 'parts' | 'ending';

/** Задача из встроенного набора. */
export interface Task {
  /** 'proverb-0001' — вечный */
  id: string;
  /** версия записи; прогресс ссылается на id, не на version */
  version: number;
  kind: Kind;
  /** условие как показывается: с пропуском «____», текст загадки, толкование */
  prompt: string;
  /** ответ строчными без знаков (proverb, riddle, old-word); ending — конец пословицы как в источнике; parts — порядок частей '2,0,1'; extra-letter — 'слово:позиция' (с нуля) */
  answer: string;
  /** ряд букв — ответ и лишние, уже перемешан (proverb, riddle) */
  row?: string[];
  /** четыре варианта, перемешаны (old-word, ending) */
  options?: string[];
  /** слова условия плашками (extra-letter), одно — с лишней буквой */
  words?: string[];
  /** части, перемешаны (parts) */
  parts?: string[];
  /** полный текст по источнику — для «Откуда это» */
  text: string;
  /** «Откуда это»: строка о значении по источнику */
  about: string;
  /** одна строка источника */
  source: string;
}

/** Слово или промежуток между словами. */
export interface Token {
  text: string;
  word: boolean;
  /** номер слова среди слов, у промежутка — -1 */
  n: number;
}

/** Итог задачи (04-data-model.md, события `solved` / `peeked`). */
export interface Result {
  done: boolean;
  /** с какой попытки решена (1 — с первой) */
  tries: number;
  /** сколько подсказок взято: 0, 1 или 2 (третья — «Показать ответ») */
  hints: number;
  /** открыт ответ — задача подсмотрена */
  peeked: boolean;
}

export const EMPTY_RESULT: Result = { done: false, tries: 0, hints: 0, peeked: false };
