// Ход решения задачи — чистые функции «состояние → состояние» (docs/08-game-design.md, «Пять видов
// задач», «Подсказки»; docs/specs/2026-10-engine.md: place / unplace / hint). Экран только рисует.
//
// Четыре взаимодействия (ADR 0005): ряд букв (пословица, загадка), выбор из четырёх (старое слово,
// конец пословицы — шестой вид, решение владельца bukvitsa#6),
// найти в строке (лишняя буква), расставить части (по частям); пятое — буква на число («Тайнопись», ADR 0009).
import { cipherKey, cipherSize } from './cipher';
import { norm } from './words';
import type { Kind, Result, Task } from './types';

export interface Play {
  result: Result;
  /** ряд букв: в каком месте какая буква ряда (номер в `row`), `null` — пусто */
  slots: (number | null)[];
  /** ряд букв: места, открытые подсказкой «Открыть букву», — их не убрать */
  locked: boolean[];
  /** ряд букв: место, выбранное игроком, — туда встанет следующая буква и его откроет «Открыть букву»; `null` — первое свободное */
  at: number | null;
  /** ряд букв: лишние буквы, погашенные подсказкой «Убрать лишние» */
  hidden: number[];
  /** выбор из четырёх: погашенные варианты (неверные и погашенные подсказкой) */
  dimmed: number[];
  /** выбор из четырёх: начало ответа — подсказка «Открыть букву» (у конца пословицы — первое слово) */
  first: string | null;
  /** найти в строке: раскрытое слово */
  open: number | null;
  /** найти в строке: слово, подсвеченное подсказкой */
  marked: number | null;
  /** найти в строке: неверные буквы «слово:позиция» */
  missed: string[];
  /** по частям: части в ответе по порядку (номера в `parts`) */
  chosen: number[];
  /** по частям: сколько первых частей поставила подсказка */
  fixed: number;
  /** тайнопись: буква каждого числа (номер — число минус один), `null` — пусто */
  marks: (string | null)[];
  /** тайнопись: числа, открытые с начала и подсказкой, — их не изменить */
  pinned: boolean[];
  /** тайнопись: выбранное число */
  sel: number | null;
  /** тайнопись: «Убрать неверные» не нашла неверных */
  clean: boolean;
  /** номер последней взятой подсказки (0–3); третья — «Показать ответ» */
  used: number;
  /** какие подсказки взяты (номера) — у ряда букв и выбора из четырёх первые две берутся в любом порядке */
  did: number[];
  /** сколько подсказок взято, кроме «Показать ответ» — в итог (0–2) */
  taken: number;
  /** последняя проверка неверна — поле встряхивается (отклик на действие игрока) */
  shake: boolean;
}

/** Подсказки вида по порядку (1 — убрать лишние, 2 — открыть букву/часть, 3 — показать ответ). */
export const HINTS: Record<Kind, number[]> = {
  proverb: [1, 2, 3],
  riddle: [1, 2, 3],
  'old-word': [1, 2, 3],
  ending: [1, 2, 3],
  'extra-letter': [1, 3],
  parts: [2, 3],
  cipher: [1, 2, 3],
};

/** После скольких неверных выбор из четырёх и строка считаются подсмотренными (08-game-design.md). */
export const WRONG_LIMIT = 3;

/** Первое слово конца пословицы — подсказка «Открыть первое слово». */
export const firstWord = (s: string) => s.split(/\s+/)[0].replace(/[,;:.!?—]+$/, '');

const letters = (t: Task) => t.answer.replace(/-/g, '').split('');
const usesRow = (t: Task) => t.kind === 'proverb' || t.kind === 'riddle';

function blank(task: Task): Play {
  const n = usesRow(task) ? letters(task).length : 0;
  const m = task.kind === 'cipher' ? cipherSize(task) : 0;
  const key = task.kind === 'cipher' ? cipherKey(task) : [];
  const pinned = Array.from({ length: m }, (_, i) => (task.open ?? []).includes(i + 1));
  const marks = pinned.map((on, i) => (on ? key[i] : null));
  return {
    result: { done: false, tries: 0, hints: 0, peeked: false },
    slots: Array(n).fill(null),
    locked: Array(n).fill(false),
    at: null,
    hidden: [],
    dimmed: [],
    first: null,
    open: null,
    marked: null,
    missed: [],
    chosen: [],
    fixed: 0,
    marks,
    pinned,
    sel: m ? nextEmpty(task, marks, -1) : null,
    clean: false,
    used: 0,
    did: [],
    taken: 0,
    shake: false,
  };
}

/** Ответ на поле: ряд заполнен ответом, части стоят, слово раскрыто. */
function filled(task: Task, p: Play): Play {
  if (usesRow(task)) {
    const row = task.row ?? [];
    const taken = new Set<number>();
    const slots = letters(task).map(c => {
      const i = row.findIndex((x, k) => norm(x) === norm(c) && !taken.has(k));
      taken.add(i);
      return i;
    });
    return { ...p, slots, locked: slots.map(() => true), at: null };
  }
  if (task.kind === 'parts') return { ...p, chosen: task.answer.split(',').map(Number) };
  if (task.kind === 'extra-letter') return { ...p, open: Number(task.answer.split(':')[0]) };
  if (task.kind === 'cipher') return { ...p, marks: cipherKey(task), pinned: p.pinned.map(() => true), sel: null };
  return p;
}

/**
 * Начало решения. Решённая задача открывается с ответом и прежним итогом; подсмотренную можно
 * решить заново — она начинается с чистого поля (08-game-design.md, «Подсказки»).
 */
export function startPlay(task: Task, prev?: Result): Play {
  const p = blank(task);
  if (!prev?.done || prev.peeked) return p;
  return { ...filled(task, p), result: { ...prev } };
}

const solved = (p: Play): Play => ({ ...p, shake: false, result: { ...p.result, done: true, tries: p.result.tries + 1, hints: Math.min(p.taken, 2) } });
const wrong = (p: Play, extra: Partial<Play> = {}): Play => ({ ...p, ...extra, shake: true, result: { ...p.result, tries: p.result.tries + 1 } });
const peek = (task: Task, p: Play): Play => ({ ...filled(task, p), shake: false, result: { ...p.result, done: true, peeked: true, hints: Math.min(p.taken, 2) } });

/** Ряд букв: какие буквы ряда стоят на местах. */
export function usedTiles(p: Play): Set<number> {
  return new Set(p.slots.filter((s): s is number => s != null));
}

/** Ряд букв: касание буквы — на выбранное место, не выбрано — на первое свободное; ряд заполнен — проверка сразу. */
export function place(task: Task, p: Play, tile: number): Play {
  if (p.result.done || usedTiles(p).has(tile) || p.hidden.includes(tile)) return p;
  const at = p.at != null && p.slots[p.at] == null ? p.at : p.slots.findIndex(s => s == null);
  if (at < 0) return p;
  const slots = p.slots.slice();
  slots[at] = tile;
  const next = { ...p, slots, at: null, shake: false };
  if (slots.some(s => s == null)) return next;
  const row = task.row ?? [];
  const ok = letters(task).every((c, i) => norm(row[slots[i]!]) === norm(c));
  // неверно — поле встряхивается, буквы остаются: лишнее игрок убирает сам
  return ok ? solved(next) : wrong(next);
}

/** Ряд букв: касание места — буква возвращается в ряд (открытая подсказкой — нет). */
export function unplace(p: Play, slot: number): Play {
  if (p.result.done || p.locked[slot] || p.slots[slot] == null) return p;
  const slots = p.slots.slice();
  slots[slot] = null;
  return { ...p, slots, shake: false };
}

/**
 * Ряд букв: касание места. Пустое — выбирается (второе касание снимает выбор): следующая буква встанет сюда.
 * Занятое — буква возвращается в ряд, место остаётся выбранным. Открытое подсказкой — не трогается.
 */
export function tapSlot(p: Play, slot: number): Play {
  if (p.result.done || p.locked[slot] || slot < 0 || slot >= p.slots.length) return p;
  if (p.slots[slot] == null) return { ...p, at: p.at === slot ? null : slot, shake: false };
  return { ...unplace(p, slot), at: slot };
}

/** Ряд букв: «Очистить» — все буквы игрока возвращаются в ряд; открытые подсказкой остаются. */
export function clearRow(p: Play): Play {
  if (p.result.done || !p.slots.some((s, i) => s != null && !p.locked[i])) return p;
  return { ...p, slots: p.slots.map((s, i) => (p.locked[i] ? s : null)), at: null, shake: false };
}

/** Выбор из четырёх: неверный гаснет; после третьего неверного — задача подсмотрена. */
export function choose(task: Task, p: Play, option: number): Play {
  if (p.result.done || p.dimmed.includes(option)) return p;
  if (norm(task.options?.[option] ?? '') === norm(task.answer)) return solved(p);
  const misses = p.result.tries + 1;
  const next = wrong(p, { dimmed: [...p.dimmed, option] });
  return misses >= WRONG_LIMIT ? peek(task, next) : next;
}

/** Найти в строке: касание слова раскрывает его по буквам. */
export function openWord(p: Play, word: number): Play {
  if (p.result.done) return p;
  return { ...p, open: word, shake: false };
}

/** Найти в строке: касание буквы раскрытого слова — ответ; после трёх неверных — подсмотрена. */
export function tapLetter(task: Task, p: Play, position: number): Play {
  if (p.result.done || p.open == null) return p;
  const key = `${p.open}:${position}`;
  if (p.missed.includes(key)) return p;
  if (key === task.answer) return solved(p);
  const next = wrong(p, { missed: [...p.missed, key] });
  return next.missed.length >= WRONG_LIMIT ? peek(task, next) : next;
}

/** По частям: касание части переносит её в ответ; собрано всё — проверка; неверно — части возвращаются. */
export function pickPart(task: Task, p: Play, part: number): Play {
  if (p.result.done || p.chosen.includes(part)) return p;
  const chosen = [...p.chosen, part];
  const parts = task.parts ?? [];
  if (chosen.length < parts.length) return { ...p, chosen, shake: false };
  const ok = [task.answer, ...(task.also ?? [])].some(a => {
    const order = a.split(',').map(Number);
    return chosen.every((c, i) => parts[c] === parts[order[i]]);
  });
  return ok ? solved({ ...p, chosen }) : wrong(p, { chosen: p.chosen.slice(0, p.fixed) });
}

/** По частям: касание части в ответе возвращает её (поставленную подсказкой — нет). */
export function unpickPart(p: Play, k: number): Play {
  if (p.result.done || k < p.fixed) return p;
  return { ...p, chosen: p.chosen.filter((_, i) => i !== k), shake: false };
}

/** Тайнопись: число первой после клетки `after` (по тексту, по кругу) пустой клетки; пустых нет — `null`. */
function nextEmpty(task: Task, marks: (string | null)[], after: number): number | null {
  const code = task.code ?? [];
  for (let k = 1; k <= code.length; k++) {
    const c = code[(after + k + code.length) % code.length];
    if (marks[c - 1] == null) return c;
  }
  return null;
}

/** Тайнопись: заполнено ли поле ключом. */
const cipherRight = (task: Task, marks: (string | null)[]) => cipherKey(task).every((c, i) => marks[i] === c);

/** Тайнопись: касание клетки выбирает её число (открытое — нет). */
export function selectCode(p: Play, code: number): Play {
  if (p.result.done || p.pinned[code - 1] !== false) return p;
  return { ...p, sel: code, shake: false };
}

/** Тайнопись: буквы, которые уже не поставить (открытые с начала и подсказкой). */
export function pinnedLetters(p: Play): Set<string> {
  return new Set(p.marks.filter((m, i): m is string => m != null && p.pinned[i]));
}

/**
 * Тайнопись: буква с клавиатуры — во все клетки выбранного числа; одна буква — одно число (с прежнего снимается).
 * Выбор переходит к следующей пустой клетке; заполнено всё — проверка сразу, неверно — буквы остаются.
 */
export function putLetter(task: Task, p: Play, letter: string): Play {
  const L = norm(letter);
  if (p.result.done || p.sel == null || p.pinned[p.sel - 1] || pinnedLetters(p).has(L)) return p;
  const marks = p.marks.map(m => (m === L ? null : m));
  marks[p.sel - 1] = L;
  const at = (task.code ?? []).indexOf(p.sel);
  const sel = nextEmpty(task, marks, at) ?? p.sel;
  const next = { ...p, marks, sel, shake: false, clean: false };
  if (marks.some(m => m == null)) return next;
  return cipherRight(task, marks) ? solved({ ...next, sel: null }) : wrong(next);
}

/** Тайнопись: «Стереть» — снять букву с выбранного числа. */
export function eraseLetter(p: Play): Play {
  if (p.result.done || p.sel == null || p.pinned[p.sel - 1] || p.marks[p.sel - 1] == null) return p;
  const marks = p.marks.slice();
  marks[p.sel - 1] = null;
  return { ...p, marks, shake: false, clean: false };
}

/** Следующая подсказка вида по порядку или `null`, если все взяты. */
export function nextHint(task: Task, p: Play): number | null {
  if (p.result.done) return null;
  return HINTS[task.kind].find(h => !p.did.includes(h)) ?? null;
}

/** Виды, где первые две подсказки игрок берёт в любом порядке (08-game-design.md, «Подсказки»). */
const FREE: Kind[] = ['proverb', 'riddle', 'old-word', 'ending'];

/**
 * Подсказки, которые можно взять сейчас. У ряда букв и выбора из четырёх — обе первые сразу, в любом порядке;
 * «Показать ответ» — когда взяты обе. У остальных видов — одна, по порядку.
 */
export function openHints(task: Task, p: Play): number[] {
  const next = nextHint(task, p);
  if (next == null) return [];
  if (!FREE.includes(task.kind)) return [next];
  const rest = HINTS[task.kind].filter(h => h !== 3 && !p.did.includes(h));
  return rest.length ? rest : [3];
}

/**
 * Подсказка: бесплатна, без счётчика; третья — «Показать ответ» (задача подсмотрена). `which` — какую взять из
 * `openHints`; не названа — следующую по порядку.
 */
export function hint(task: Task, p: Play, which?: number): Play {
  const h = which ?? nextHint(task, p);
  if (h == null || !openHints(task, p).includes(h)) return p;
  const q = { ...p, used: h, did: [...p.did, h], taken: p.taken + (h === 3 ? 0 : 1), shake: false };
  if (h === 3) return peek(task, q);
  if (task.kind === 'cipher') {
    const key = cipherKey(task);
    if (h === 1) {
      // неверные буквы снимаются; неверных нет — игрок узнаёт, что поставленное верно
      const marks = q.marks.map((m, i) => (m != null && !q.pinned[i] && m !== key[i] ? null : m));
      const clean = marks.every((m, i) => m === q.marks[i]);
      return { ...q, marks, clean, sel: q.sel ?? nextEmpty(task, marks, -1) };
    }
    // h === 2: первая по тексту пустая или неверная клетка — её буква во все клетки её числа
    const code = task.code ?? [];
    const at = code.findIndex(c => q.marks[c - 1] !== key[c - 1]);
    if (at < 0) return q;
    const c = code[at];
    const marks = q.marks.map(m => (m === key[c - 1] ? null : m));
    marks[c - 1] = key[c - 1];
    const pinned = q.pinned.slice();
    pinned[c - 1] = true;
    const next = { ...q, marks, pinned, sel: nextEmpty(task, marks, at), clean: false };
    return cipherRight(task, marks) ? solved({ ...next, sel: null }) : next;
  }
  if (usesRow(task)) {
    const row = task.row ?? [];
    if (h === 1) {
      // лишние буквы гаснут: всё, что сверх букв ответа
      // буквы, уже открытые подсказкой, — в счёт ответа: гаснет другая такая же
      const keep = new Set<number>(q.slots.filter((s, i): s is number => s != null && q.locked[i]));
      letters(task).forEach((c, k) => {
        if (q.locked[k]) return;
        const i = row.findIndex((x, j) => norm(x) === norm(c) && !keep.has(j));
        keep.add(i);
      });
      const hidden = row.map((_, i) => i).filter(i => !keep.has(i));
      // погашенные буквы, стоявшие на местах, возвращаются
      return { ...q, hidden, slots: q.slots.map((s, i) => (s != null && hidden.includes(s) && !q.locked[i] ? null : s)) };
    }
    // h === 2: буква ответа встаёт на место — на выбранное игроком, если там ещё не верная; иначе на первое такое
    const ans = letters(task);
    const off = (i: number) => q.slots[i] == null || norm(row[q.slots[i]!]) !== norm(ans[i]);
    const at = q.at != null && !q.locked[q.at] && off(q.at) ? q.at : ans.findIndex((_, i) => off(i));
    if (at < 0) return q;
    const slots = q.slots.slice();
    slots[at] = null;
    const taken = new Set(slots.filter((s): s is number => s != null));
    let tile = row.findIndex((x, k) => norm(x) === norm(ans[at]) && !taken.has(k));
    if (tile < 0) {
      // нужная буква стоит не на своём месте — переносится
      const from = slots.findIndex(s => s != null && norm(row[s]) === norm(ans[at]) && !q.locked[slots.indexOf(s)]);
      tile = from >= 0 ? (slots[from] as number) : -1;
      if (from >= 0) slots[from] = null;
    }
    if (tile < 0) return q;
    slots[at] = tile;
    const locked = q.locked.slice();
    locked[at] = true;
    const next = { ...q, slots, locked, at: null };
    return slots.every(s => s != null) && ans.every((c, i) => norm(row[slots[i]!]) === norm(c)) ? solved(next) : next;
  }
  if (task.kind === 'old-word' || task.kind === 'ending') {
    if (h === 1) {
      const opts = task.options ?? [];
      const wrongs = opts.map((_, i) => i).filter(i => norm(opts[i]) !== norm(task.answer) && !q.dimmed.includes(i));
      const need = Math.max(0, opts.length - 2 - q.dimmed.length);
      return { ...q, dimmed: [...q.dimmed, ...wrongs.slice(0, need)] };
    }
    if (task.kind === 'ending') return { ...q, first: firstWord(task.answer) };
    return { ...q, first: task.answer[0].toUpperCase() };
  }
  if (task.kind === 'extra-letter') {
    const w = Number(task.answer.split(':')[0]);
    return { ...q, marked: w, open: w };
  }
  // parts, h === 2: первая часть встаёт на место
  const first = Number(task.answer.split(',')[0]);
  return { ...q, chosen: [first], fixed: 1 };
}
