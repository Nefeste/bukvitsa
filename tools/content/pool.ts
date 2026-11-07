// Все пословицы источника и те, что можно брать в задачи (content/sections.yaml, content/banned.yaml).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { words } from '../../src/engine/tasks';
import { parseSection, type Proverb } from './dal';

export interface Pool {
  /** все пословицы источника по идентификатору */
  byId: Map<string, Proverb>;
  /** разрешённые: раздел в `take`, ни одного слова из `banned`, без цифр и латиницы */
  allowed: Proverb[];
  /** почему пословица не взята — для отчёта сборки */
  why: Map<string, string>;
  /** сколько раз слово (строчными, ё как е) встречается во всём сборнике — мера «известности» */
  freq: Map<string, number>;
}

export const norm = (w: string) => w.toLowerCase().replace(/ё/g, 'е');

/**
 * Насколько знакомы слова пословицы: средний логарифм частоты её слов во всём сборнике. Чем выше, тем
 * обиходнее язык: «Тише едешь — дальше будешь» выше, чем «Пивица вопьется…».
 */
export function commonness(text: string, freq: Map<string, number>): number {
  const ws = words(text).map(norm);
  if (!ws.length) return 0;
  return ws.reduce((a, w) => a + Math.log(1 + (freq.get(w) ?? 0)), 0) / ws.length;
}

/** Нет ли в пословице запрещённого слова: «=слово» — целиком, иначе — начало слова. */
export function bannedWord(text: string, stems: readonly string[]): string | null {
  const ws = words(text).map(norm);
  for (const s of stems) {
    const exact = s.startsWith('=');
    const t = norm(exact ? s.slice(1) : s);
    if (ws.some(w => (exact ? w === t : w.startsWith(t)))) return s;
  }
  return null;
}

export function loadPool(root: string): Pool {
  const dir = join(root, 'content', 'sources', 'dal-1862');
  const take = new Set((parse(readFileSync(join(root, 'content', 'sections.yaml'), 'utf8')) as { take: string[] }).take);
  const stems = (parse(readFileSync(join(root, 'content', 'banned.yaml'), 'utf8')) as { stems: string[] }).stems;
  const byId = new Map<string, Proverb>();
  const allowed: Proverb[] = [];
  const why = new Map<string, string>();
  for (const f of readdirSync(dir).filter(f => /^\d{3}\.txt$/.test(f)).sort()) {
    for (const p of parseSection(readFileSync(join(dir, f), 'utf8'))) {
      if (byId.has(p.id)) throw new Error(`повтор идентификатора пословицы: ${p.id}`);
      byId.set(p.id, p);
      const b = bannedWord(p.text, stems);
      if (!take.has(p.title)) why.set(p.id, 'раздел не взят');
      else if (b) why.set(p.id, `слово «${b}»`);
      else if (/[0-9A-Za-z«»"]/.test(p.text)) why.set(p.id, 'цифры, латиница или кавычки');
      else allowed.push(p);
    }
  }
  const freq = new Map<string, number>();
  for (const p of byId.values()) for (const w of words(p.text)) freq.set(norm(w), (freq.get(norm(w)) ?? 0) + 1);
  return { byId, allowed, why, freq };
}
