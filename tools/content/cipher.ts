// «Тайнопись» в сборке (ADR 0009, specs/2026-11-cipher.md): числа букв и открытые с начала буквы — от
// sha256(id:version), как ряд букв (ADR 0005). Числа геймдизайна — docs/08-game-design.md, «Буква на число».
import { textLetters } from '../../src/engine/cipher';
import { words } from '../../src/engine/words';
import { shuffle, Xorshift } from './shuffle';

/** 08-game-design.md, «Буква на число». */
export const CIPHER = {
  letters: [20, 45] as const,
  words: 4,
  distinct: 10,
  longest: 9,
  /** открыто с начала — не меньше этой доли клеток */
  share: 0.25,
  open: [2, 5] as const,
  /** слово из стольких букв и длиннее целиком не открыто */
  wholeWord: 3,
};

const lettersOfWord = (w: string) => textLetters(w);

/** Почему пословица не годится для «Тайнописи», или `null`. */
export function cipherProblem(text: string): string | null {
  if (/[«»"()[\]]/.test(text)) return 'кавычки или скобки';
  const ws = words(text);
  const ls = textLetters(text);
  if (ls.length < CIPHER.letters[0] || ls.length > CIPHER.letters[1]) return `${ls.length} букв, нужно ${CIPHER.letters[0]}–${CIPHER.letters[1]}`;
  if (ws.length < CIPHER.words) return `${ws.length} слова, нужно не меньше ${CIPHER.words}`;
  if (new Set(ls).size < CIPHER.distinct) return `${new Set(ls).size} разных букв, нужно не меньше ${CIPHER.distinct}`;
  const long = ws.find(w => lettersOfWord(w).length > CIPHER.longest);
  if (long) return `слово «${long}» длиннее ${CIPHER.longest} букв`;
  return null;
}

/**
 * Числа букв (1…N в перемешанном порядке) и открытые числа. Открываются буквы в порядке перемешивания, пока
 * не покрыта доля `share` клеток; буква, открывающая целиком слово из `wholeWord`+ букв, пропускается.
 * `null` — правило не выполнить (тогда запись не годится).
 */
export function cipherOf(text: string, id: string, version: number): { code: number[]; open: number[] } | null {
  const ls = textLetters(text);
  const distinct = [...new Set(ls)];
  const r = new Xorshift(id, version);
  const nums = shuffle(distinct.map((_, i) => i + 1), r);
  const num = new Map(distinct.map((c, i) => [c, nums[i]]));
  const code = ls.map(c => num.get(c)!);
  const ws = words(text).map(lettersOfWord).filter(w => w.length >= CIPHER.wholeWord);
  const open = new Set<string>();
  let covered = 0;
  for (const c of shuffle(distinct, r)) {
    if (open.size >= CIPHER.open[0] && covered >= CIPHER.share * ls.length) break;
    if (open.size >= CIPHER.open[1]) break;
    const next = new Set([...open, c]);
    if (ws.some(w => w.every(x => next.has(x)))) continue;
    open.add(c);
    covered += ls.filter(x => x === c).length;
  }
  if (open.size < CIPHER.open[0] || covered < CIPHER.share * ls.length) return null;
  return { code, open: [...open].map(c => num.get(c)!).sort((a, b) => a - b) };
}
