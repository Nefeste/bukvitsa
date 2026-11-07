// Задачи: как пословица превращается в задачу и как проверяется ответ. Всё детерминировано
// идентификатором задачи: у всех игроков один и тот же ряд букв и один порядок вариантов.
import { fnv1a } from './core/hash';
import { Rng } from './core/rng';
import type { Level, Mark, Result, Task, Token } from './types';

import { COMMON, WORD, norm } from './letters';

/** Пословица → слова и промежутки по порядку. */
export function tokens(text: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  let n = 0;
  for (const m of text.matchAll(WORD)) {
    const at = m.index ?? 0;
    if (at > last) out.push({ text: text.slice(last, at), word: false, n: -1 });
    out.push({ text: m[0], word: true, n: n++ });
    last = at + m[0].length;
  }
  if (last < text.length) out.push({ text: text.slice(last), word: false, n: -1 });
  return out;
}

/** Слова пословицы по порядку. */
export function words(text: string): string[] {
  return tokens(text).filter(t => t.word).map(t => t.text);
}

export { norm };

/** Лишних плиток в ряду по сложности (08-game-design.md, «Пропущенное слово»). */
export const EXTRA_TILES: Record<Level, number> = { 1: 2, 2: 3, 3: 4 };

function rngOf(task: Task, branch: string): Rng {
  return Rng.seeded(fnv1a(`${task.id}:${branch}`));
}

function shuffle<T>(items: T[], rng: Rng): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** gap: скрытое слово. */
export function gapAnswer(task: Task): string {
  const w = words(task.text)[task.word ?? 0];
  return w ?? '';
}

/** gap: ряд плиток — буквы ответа и лишние, перемешаны. Буквы — прописные, ё остаётся ё. */
export function gapTiles(task: Task): string[] {
  const answer = gapAnswer(task).replace(/-/g, '').toUpperCase();
  const rng = rngOf(task, 'tiles');
  const extra: string[] = [];
  const need = EXTRA_TILES[task.level];
  let guard = 0;
  while (extra.length < need && guard++ < 200) {
    extra.push(COMMON[rng.int(COMMON.length)]);
  }
  return shuffle([...answer.split(''), ...extra], rng);
}

/** gap: какие места заполнены верно. Длина — длина ответа без дефиса. */
export function gapCheck(task: Task, entered: readonly (string | null)[]): boolean[] {
  const answer = norm(gapAnswer(task).replace(/-/g, ''));
  return answer.split('').map((c, i) => entered[i] != null && norm(entered[i] as string) === c);
}

/**
 * gap: подсказка — следующее место, которое ещё не верно, и буква для него.
 * `null` — подсказывать нечего.
 */
export function gapHint(task: Task, entered: readonly (string | null)[]): { slot: number; letter: string } | null {
  const answer = gapAnswer(task).replace(/-/g, '').toUpperCase();
  const ok = gapCheck(task, entered);
  const slot = ok.findIndex(v => !v);
  return slot < 0 ? null : { slot, letter: answer[slot] };
}

/** ending: начало и верный конец. */
export function endingSplit(task: Task): { head: string; tail: string } {
  const toks = tokens(task.text);
  const cut = task.cut ?? 0;
  const i = toks.findIndex(t => t.word && t.n === cut);
  return { head: toks.slice(0, i).map(t => t.text).join('').trimEnd(), tail: toks.slice(i).map(t => t.text).join('') };
}

/** ending: четыре варианта по порядку, у всех одинаковом; верный — тот, что равен `tail`. */
export function endingChoices(task: Task): string[] {
  const { tail } = endingSplit(task);
  return shuffle([tail, ...(task.wrong ?? [])], rngOf(task, 'choices'));
}

/** ending: подсказка — два неверных варианта, которые можно убрать. */
export function endingHint(task: Task): string[] {
  const { tail } = endingSplit(task);
  return endingChoices(task).filter(c => c !== tail).slice(0, 2);
}

/** parts: части по порядку пословицы. */
export function partsInOrder(task: Task): string[] {
  const toks = tokens(task.text);
  const starts = task.starts ?? [0];
  const out: string[] = [];
  for (let k = 0; k < starts.length; k++) {
    const from = k === 0 ? 0 : toks.findIndex(t => t.word && t.n === starts[k]);
    const to = k + 1 < starts.length ? toks.findIndex(t => t.word && t.n === starts[k + 1]) : toks.length;
    out.push(toks.slice(from, to).map(t => t.text).join('').trim());
  }
  return out;
}

/** parts: части вперемешку, но никогда не в верном порядке. Номера — индексы в `partsInOrder`. */
export function partsShuffled(task: Task): number[] {
  const n = partsInOrder(task).length;
  const order = Array.from({ length: n }, (_, i) => i);
  const rng = rngOf(task, 'parts');
  for (let tries = 0; tries < 20; tries++) {
    const s = shuffle(order, rng);
    if (s.some((v, i) => v !== i)) return s;
  }
  return order.slice().reverse();
}

/** parts: верен ли выбранный порядок частей (части с одинаковым текстом взаимозаменяемы). */
export function partsCheck(task: Task, chosen: readonly number[]): boolean {
  const parts = partsInOrder(task);
  if (chosen.length !== parts.length) return false;
  return chosen.every((p, i) => parts[p] === parts[i]);
}

/** extra: слова пословицы, в одном из которых вставлена лишняя буква. */
export function extraWords(task: Task): string[] {
  const ws = words(task.text);
  const i = task.word ?? 0;
  const w = ws[i] ?? '';
  // буква встаёт внутрь слова, не первой и не последней (сборка ставит так же), строчной
  const at = Math.max(1, Math.min(task.at ?? 1, Math.max(1, w.length - 1)));
  const changed = w.slice(0, at) + (task.letter ?? '').toLowerCase() + w.slice(at);
  return ws.map((x, k) => (k === i ? changed : x));
}

/** extra: пословица с лишней буквой — для показа, промежутки как в источнике. */
export function extraText(task: Task): Token[] {
  const changed = extraWords(task);
  return tokens(task.text).map(t => (t.word ? { ...t, text: changed[t.n] } : t));
}

/** extra: подсказка — половина слов без лишней буквы, которые можно погасить. */
export function extraHint(task: Task): number[] {
  const n = words(task.text).length;
  const others = Array.from({ length: n }, (_, i) => i).filter(i => i !== task.word);
  return shuffle(others, rngOf(task, 'hint')).slice(0, Math.floor(others.length / 2));
}

/** Как решена задача — для итога и «Поделиться». */
export function markOf(r: Result): Mark {
  if (r.shown) return 'shown';
  return r.hints > 0 || r.mistakes > 0 ? 'helped' : 'clean';
}
