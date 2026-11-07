// Ход решения одной задачи — чистые функции «состояние → состояние» (экран только рисует).
// Правила — docs/08-game-design.md, «Как решается задача»: ошибка не наказывает, она считается;
// подсказка бесплатна и тоже считается; «Показать ответ» решает задачу за игрока.
import {
  endingHint,
  endingSplit,
  extraHint,
  gapAnswer,
  gapCheck,
  gapTiles,
  partsCheck,
  partsInOrder,
  partsShuffled,
} from './tasks';
import type { Result, Task } from './types';

export interface Play {
  result: Result;
  /** gap: в каком месте какая плитка (номер в `gapTiles`), `null` — пусто */
  slots: (number | null)[];
  /** gap: места, уже верные, — их нельзя стереть */
  locked: boolean[];
  /** ending: погашенные варианты; extra: погашенные слова (номера) */
  dimmed: string[];
  /** parts: выбранные части по порядку (номера в `partsInOrder`) */
  chosen: number[];
  /** последняя попытка была неверной — экран коротко отвечает на неё (на действие игрока) */
  wrong: boolean;
}

/** Начало решения. Уже решённая задача открывается с ответом на месте и прежним итогом. */
export function startPlay(task: Task, prev?: Result): Play {
  const len = task.kind === 'gap' ? gapAnswer(task).replace(/-/g, '').length : 0;
  const fresh: Play = {
    result: { done: false, hints: 0, mistakes: 0, shown: false },
    slots: Array(len).fill(null),
    locked: Array(len).fill(false),
    dimmed: [],
    chosen: [],
    wrong: false,
  };
  if (!prev?.done) return fresh;
  return { ...showAnswer(task, fresh), result: { ...prev } };
}

const solved = (p: Play, extra: Partial<Play> = {}): Play => ({ ...p, ...extra, wrong: false, result: { ...p.result, done: true } });
const missed = (p: Play, extra: Partial<Play> = {}): Play => ({ ...p, ...extra, wrong: true, result: { ...p.result, mistakes: p.result.mistakes + 1 } });

/** Какие плитки ряда уже стоят на местах. */
export function usedTiles(p: Play): Set<number> {
  return new Set(p.slots.filter((s): s is number => s != null));
}

/** gap: касание плитки ряда — буква встаёт на первое пустое место; все места заняты — проверка. */
export function gapTap(task: Task, p: Play, tile: number): Play {
  if (p.result.done || usedTiles(p).has(tile)) return p;
  const at = p.slots.findIndex(s => s == null);
  if (at < 0) return p;
  const slots = p.slots.slice();
  slots[at] = tile;
  if (slots.some(s => s == null)) return { ...p, slots, wrong: false };
  const tiles = gapTiles(task);
  const ok = gapCheck(task, slots.map(s => (s == null ? null : tiles[s])));
  if (ok.every(Boolean)) return solved(p, { slots, locked: ok });
  // верные буквы остаются и запираются, неверные возвращаются в ряд
  return missed(p, { slots: slots.map((s, i) => (ok[i] ? s : null)), locked: ok });
}

/** gap: касание места — буква возвращается в ряд (запертая — нет). */
export function gapErase(p: Play, slot: number): Play {
  if (p.result.done || p.locked[slot] || p.slots[slot] == null) return p;
  const slots = p.slots.slice();
  slots[slot] = null;
  return { ...p, slots, wrong: false };
}

/** ending: выбор конца. */
export function endingPick(task: Task, p: Play, choice: string): Play {
  if (p.result.done || p.dimmed.includes(choice)) return p;
  if (choice === endingSplit(task).tail) return solved(p);
  return missed(p, { dimmed: [...p.dimmed, choice] });
}

/** parts: следующая часть; неверная не встаёт — считается ошибкой. */
export function partsPick(task: Task, p: Play, part: number): Play {
  if (p.result.done || p.chosen.includes(part)) return p;
  const parts = partsInOrder(task);
  const next = p.chosen.length;
  if (parts[part] !== parts[next]) return missed(p);
  const chosen = [...p.chosen, part];
  return chosen.length === parts.length && partsCheck(task, chosen) ? solved(p, { chosen }) : { ...p, chosen, wrong: false };
}

/** extra: касание слова. */
export function extraPick(task: Task, p: Play, word: number): Play {
  if (p.result.done || p.dimmed.includes(String(word))) return p;
  if (word === task.word) return solved(p);
  return missed(p, { dimmed: [...p.dimmed, String(word)] });
}

/** Подсказка: бесплатна, считается. Ничего не даёт — не считается. */
export function takeHint(task: Task, p: Play): Play {
  if (p.result.done) return p;
  const counted = (next: Play): Play => ({ ...next, wrong: false, result: { ...next.result, hints: next.result.hints + 1 } });
  if (task.kind === 'gap') {
    const tiles = gapTiles(task);
    const answer = gapAnswer(task).replace(/-/g, '').toUpperCase();
    const slot = p.locked.findIndex(l => !l);
    if (slot < 0) return p;
    const slots = p.slots.slice();
    // освободить место и взять свободную плитку с нужной буквой
    slots[slot] = null;
    const taken = new Set(slots.filter((s): s is number => s != null));
    const tile = tiles.findIndex((c, i) => c === answer[slot] && !taken.has(i));
    if (tile < 0) return p;
    slots[slot] = tile;
    const locked = p.locked.slice();
    locked[slot] = true;
    const next = counted({ ...p, slots, locked });
    return locked.every(Boolean) ? solved(next) : next;
  }
  if (task.kind === 'ending') {
    const add = endingHint(task).filter(c => !p.dimmed.includes(c));
    return add.length ? counted({ ...p, dimmed: [...p.dimmed, ...add] }) : p;
  }
  if (task.kind === 'parts') {
    const parts = partsInOrder(task);
    const next = p.chosen.length;
    const part = partsShuffled(task).find(i => !p.chosen.includes(i) && parts[i] === parts[next]);
    if (part == null) return p;
    const chosen = [...p.chosen, part];
    const n = counted({ ...p, chosen });
    return chosen.length === parts.length ? solved(n) : n;
  }
  const add = extraHint(task).map(String).filter(w => !p.dimmed.includes(w));
  return add.length ? counted({ ...p, dimmed: [...p.dimmed, ...add] }) : p;
}

/** «Показать ответ»: задача решена за игрока. */
export function showAnswer(task: Task, p: Play): Play {
  if (p.result.done) return p;
  const result = { ...p.result, done: true, shown: true };
  if (task.kind === 'gap') {
    const tiles = gapTiles(task);
    const answer = gapAnswer(task).replace(/-/g, '').toUpperCase();
    const taken = new Set<number>();
    const slots = answer.split('').map(c => {
      const i = tiles.findIndex((t, k) => t === c && !taken.has(k));
      taken.add(i);
      return i;
    });
    return { ...p, slots, locked: slots.map(() => true), result, wrong: false };
  }
  if (task.kind === 'parts') return { ...p, chosen: partsInOrder(task).map((_, i) => i), result, wrong: false };
  return { ...p, result, wrong: false };
}

