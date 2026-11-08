// Слова пословицы: слово — кириллица и дефис внутри («кое-как»), остальное — промежутки.
import { WORD, norm } from './letters';
import type { Token } from './types';

export { norm };

/** Текст → слова и промежутки по порядку. */
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

/** Слова текста по порядку. */
export function words(text: string): string[] {
  return tokens(text).filter(t => t.word).map(t => t.text);
}
