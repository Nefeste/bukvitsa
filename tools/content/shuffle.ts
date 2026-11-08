// Лишние буквы и перемешивание — сборкой, а не телефоном (ADR 0005, docs/09-content.md §4):
// xorshift от sha256(id + ':' + version). Одинаковый вход — одинаковый ряд у всех, байт в байт.
import { createHash } from 'node:crypto';

/** 20 самых частых букв русского текста без ъ, ь, й, ё, щ, ф, э, ц, ю (09-content.md §4). */
export const FREQUENT = 'оеаинтсрвлкмдпуяыгзб';

export class Xorshift {
  private s: number;
  constructor(id: string, version: number) {
    const h = createHash('sha256').update(`${id}:${version}`).digest();
    this.s = h.readUInt32LE(0) || 0x9e3779b9;
  }
  next(): number {
    let x = this.s;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    this.s = x >>> 0;
    return this.s;
  }
  int(n: number): number {
    return this.next() % n;
  }
}

export function shuffle<T>(items: readonly T[], r: Xorshift): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = r.int(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Сколько лишних букв в ряду (08-game-design.md, «Ряд букв»): до 5 букв — 2, 6–8 — 3, 9 и больше — 4. */
export function extraCount(answerLength: number): number {
  return answerLength <= 5 ? 2 : answerLength <= 8 ? 3 : 4;
}

/** Ряд букв: буквы ответа (без дефиса) и лишние частые буквы, которых нет в ответе; перемешан. */
export function letterRow(answer: string, id: string, version: number): string[] {
  const letters = answer.toLowerCase().replace(/-/g, '').split('');
  const r = new Xorshift(id, version);
  const pool = FREQUENT.split('').filter(c => !letters.includes(c));
  const extra = shuffle(pool, r).slice(0, extraCount(letters.length));
  return shuffle([...letters, ...extra], r);
}

/** Перемешать так, чтобы порядок не совпал с исходным (у частей и вариантов). */
export function shuffleNotSame<T>(items: readonly T[], id: string, version: number): T[] {
  const r = new Xorshift(id, version);
  for (let k = 0; k < 20; k++) {
    const s = shuffle(items, r);
    if (s.some((v, i) => v !== items[i])) return s;
  }
  return items.slice().reverse();
}

/**
 * Конец пословицы (шестой вид, решение владельца bukvitsa#6): «начало — конец» по первому тире.
 * Конец — как в источнике, без точки в конце. `null` — тире нет, их больше одного, части коротки или
 * конец выдаёт себя видом (с большой буквы, с «?» или «!», ответ в диалоге).
 */
export function endingSplit(text: string): { head: string; tail: string } | null {
  const at = text.split(' — ');
  if (at.length !== 2) return null;
  const head = at[0].trim();
  const tail = at[1].trim().replace(/[.;,]+$/, '');
  // ответ не должен выдавать себя видом: диалоги («…? — …»), конец с большой буквы, вопрос или восклицание
  if (/[?!]$/.test(head) || /[?!(){}\[\]]/.test(tail) || !/^[а-яё]/.test(tail)) return null;
  const n = (s: string) => s.split(/\s+/).filter(w => /[А-Яа-яЁё]/.test(w)).length;
  if (n(head) < 2 || n(tail) < 1 || n(tail) > 6 || tail.length > 40) return null;
  return { head, tail };
}
