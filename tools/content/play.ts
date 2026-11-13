// «Виртуальный игрок» (docs/09-content.md, §5; specs/2026-10-content-pipeline.md): проходит каждую задачу
// собранного набора по правилам движка и ищет то, что сборка не видит:
//
// - ряд букв (пословица, загадка) — нет ли в ряду другого слова той же длины, которое встречается в
//   сборнике Даля (у пословицы — ещё и рядом с соседями пропуска): игрок сложит его и будет прав по-своему —
//   предупреждение;
// - лишняя буква — ошибка, если та же буква стоит рядом (касание соседней даёт то же слово, а движок
//   засчитает промах); предупреждение, если слово с лишней буквой само есть в сборнике («кот» → «крот»);
// - варианты (старое слово, конец пословицы) — ровно четыре, разные, ответ среди них, длины не больше чем
//   вдвое — ошибка; два варианта, которые подходят к началу одинаково часто, — нет (это не проверить словарём);
// - части — другой порядок, который читается не хуже верного по стыкам слов сборника (биграммы), —
//   предупреждение; одинаковые части движок принимает в любом порядке.
//
// Словарь — сами пословицы источника (content/sources/dal-1862/): частотный словарь со стороны не нужен
// (решение спецификации — «до решения — проверка по самим ответам набора»).
//
// - тайнопись — другая пословица сборника с тем же узором чисел и теми же открытыми буквами: игрок её разгадает
//   и будет прав по-своему — ошибка (specs/2026-11-cipher.md, «Неудачные случаи»).
//
//   bun tools/content/play.ts            — отчёт dist/play.md; ошибки — код выхода 1
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cipherKey, norm as engineNorm, textLetters, words, type Task } from '../../src/engine';
import { build } from './build';
import { loadPool, norm } from './pool';

const ROOT = join(import.meta.dir, '..', '..');

/** Сколько раз слово должно встретиться в сборнике, чтобы считаться «словом, которое игрок знает». */
export const MIN_FREQ = 3;

export interface Finding {
  id: string;
  level: 'error' | 'warning';
  what: string;
}

/** Словарь сборника по длине слова: слово → частота. */
function byLength(freq: Map<string, number>): Map<number, [string, number][]> {
  const out = new Map<number, [string, number][]>();
  for (const [w, n] of freq) {
    if (n < MIN_FREQ || !/^[а-я]+$/.test(w)) continue;
    const l = out.get(w.length) ?? [];
    l.push([w, n]);
    out.set(w.length, l);
  }
  return out;
}

const counts = (s: string) => {
  const m = new Map<string, number>();
  for (const c of s) m.set(c, (m.get(c) ?? 0) + 1);
  return m;
};

/** Слова сборника той же длины, что ответ, которые складываются из букв ряда (кроме самого ответа). */
export function rowAlternatives(t: Task, dict: Map<number, [string, number][]>): [string, number][] {
  const answer = norm(t.answer.replace(/-/g, ''));
  const row = counts(norm((t.row ?? []).join('')));
  return (dict.get(answer.length) ?? []).filter(([w]) => {
    if (w === answer) return false;
    const need = counts(w);
    for (const [c, n] of need) if ((row.get(c) ?? 0) < n) return false;
    return true;
  });
}

/** Лишняя буква: какие касания дают то же исходное слово, но не совпадают с ответом. */
export function extraLetterTwins(t: Task): number[] {
  const [wi, pi] = t.answer.split(':').map(Number);
  const w = t.words?.[wi] ?? '';
  const original = w.slice(0, pi) + w.slice(pi + 1);
  const out: number[] = [];
  for (let k = 0; k < w.length; k++) if (k !== pi && engineNorm(w.slice(0, k) + w.slice(k + 1)) === engineNorm(original)) out.push(k);
  return out;
}

/** Варианты: ровно четыре, разные, ответ среди них, самый длинный не больше чем вдвое длиннее самого короткого. */
export function optionProblems(t: Task): string[] {
  const o = t.options ?? [];
  const out: string[] = [];
  if (o.length !== 4) out.push(`вариантов ${o.length}, а не 4`);
  if (new Set(o.map(engineNorm)).size !== o.length) out.push('есть одинаковые варианты');
  if (o.filter(x => engineNorm(x) === engineNorm(t.answer)).length !== 1) out.push('ответ не среди вариантов ровно один раз');
  const ls = o.map(x => x.length);
  if (ls.length && Math.max(...ls) > 2 * Math.min(...ls)) out.push(`длины вариантов ${Math.min(...ls)}–${Math.max(...ls)}: больше чем вдвое`);
  return out;
}

/** Слова до и после пропуска «____» в условии пословицы (строчными, ё как е). */
export function gapNeighbours(t: Task): [string, string] {
  const [a, b] = t.prompt.split('____');
  return [words(a ?? '').map(norm).at(-1) ?? '', words(b ?? '').map(norm)[0] ?? ''];
}

const perms = (n: number): number[][] => (n <= 1 ? [[0]] : perms(n - 1).flatMap(p => Array.from({ length: n }, (_, i) => [...p.slice(0, i), n - 1, ...p.slice(i)])));

/**
 * Части: оценка порядка — сумма по стыкам частей log(1 + сколько раз в сборнике за последним словом части идёт
 * первое слово следующей); первая часть с большой буквы и последняя с точкой — бонус. Возвращает другие
 * порядки (не равные верному по тексту), которые набрали не меньше верного.
 */
export function partsRivals(t: Task, bigrams: Map<string, number>): string[][] {
  const parts = t.parts ?? [];
  const order = t.answer.split(',').map(Number);
  const right = order.map(i => parts[i]);
  const score = (seq: string[]) => {
    let s = 0;
    for (let i = 0; i + 1 < seq.length; i++) {
      const a = words(seq[i]).map(norm).at(-1) ?? '';
      const b = words(seq[i + 1]).map(norm)[0] ?? '';
      s += Math.log(1 + (bigrams.get(`${a} ${b}`) ?? 0));
    }
    if (/^[А-ЯЁ]/.test(seq[0])) s += 2;
    if (/[.!?…]$/.test(seq.at(-1)!.trim())) s += 2;
    return s;
  };
  const best = score(right);
  // равноправные порядки (`also`) — тоже верные
  const seen = new Set([right.join('|'), ...(t.also ?? []).map(a => a.split(',').map(i => parts[Number(i)]).join('|'))]);
  const out: string[][] = [];
  for (const p of perms(parts.length)) {
    const seq = p.map(i => parts[i]);
    const key = seq.join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    if (score(seq) >= best) out.push(seq);
  }
  return out;
}

/** Узор слов: длины слов по буквам — по нему ищутся соперники «Тайнописи». */
const shape = (text: string) => words(text).map(w => textLetters(w).length).join(' ');

/** Пословицы по узору слов — буквами. */
export function shapeIndex(texts: Iterable<string>): Map<string, { text: string; ls: string[] }[]> {
  const out = new Map<string, { text: string; ls: string[] }[]>();
  for (const text of texts) {
    const k = shape(text);
    out.set(k, [...(out.get(k) ?? []), { text, ls: textLetters(text) }]);
  }
  return out;
}

/**
 * Тайнопись: пословицы из `texts`, которые подходят под узор чисел задачи и её открытые буквы, но читаются
 * иначе. Одинаковые числа — одинаковые буквы, разные — разные.
 */
export function cipherRivals(t: Task, texts: Iterable<string> | Map<string, { text: string; ls: string[] }[]>): string[] {
  const code = t.code ?? [];
  const key = cipherKey(t);
  const own = textLetters(t.text).join('');
  const index = texts instanceof Map ? texts : shapeIndex(texts);
  const out: string[] = [];
  for (const { text: s, ls } of index.get(shape(t.text)) ?? []) {
    if (ls.join('') === own) continue;
    const of = new Map<number, string>();
    const back = new Map<string, number>();
    const ok = ls.every((c, i) => {
      const n = code[i];
      if ((t.open ?? []).includes(n) && key[n - 1] !== c) return false;
      if ((of.get(n) ?? c) !== c || (back.get(c) ?? n) !== n) return false;
      of.set(n, c);
      back.set(c, n);
      return true;
    });
    if (ok) out.push(s);
  }
  return out;
}

export function play(root = ROOT): { findings: Finding[]; total: number } {
  const { pack, errors } = build(root);
  if (errors.length) throw new Error(`сборка с ошибками — сначала npm run content:\n${errors.join('\n')}`);
  const pool = loadPool(root);
  const dict = byLength(pool.freq);
  const bigrams = new Map<string, number>();
  for (const p of pool.byId.values()) {
    const ws = words(p.text).map(norm);
    for (let i = 0; i + 1 < ws.length; i++) bigrams.set(`${ws[i]} ${ws[i + 1]}`, (bigrams.get(`${ws[i]} ${ws[i + 1]}`) ?? 0) + 1);
  }
  const texts = shapeIndex([...pool.byId.values()].map(p => p.text));
  const findings: Finding[] = [];
  const add = (id: string, level: Finding['level'], what: string) => findings.push({ id, level, what });
  for (const t of pack.tasks) {
    if (t.kind === 'proverb' || t.kind === 'riddle') {
      // у пословицы — только слова, которые в сборнике стоят рядом с соседями пропуска: «Без труда не вынешь и
      // рыбку из пруда» с «дела» вместо «труда» — уже другая пословица; у загадки соседей нет — все слова
      const fit = (w: string) => (t.kind === 'riddle' ? 1 : (bigrams.get(`${gapNeighbours(t)[0]} ${w}`) ?? 0) + (bigrams.get(`${w} ${gapNeighbours(t)[1]}`) ?? 0));
      const alt = rowAlternatives(t, dict).filter(([w]) => fit(w) > 0).sort((a, b) => b[1] - a[1]);
      if (alt.length) add(t.id, 'warning', `ряд «${(t.row ?? []).join('')}»: кроме «${t.answer}» складывается ${alt.slice(0, 5).map(([w, n]) => `«${w}» (${n})`).join(', ')}`);
    } else if (t.kind === 'extra-letter') {
      const twins = extraLetterTwins(t);
      const [wi] = t.answer.split(':').map(Number);
      const shown = t.words?.[wi] ?? '';
      if (twins.length) add(t.id, 'error', `«${shown}»: касание буквы ${twins.map(k => k + 1).join(', ')} даёт то же слово, а движок засчитает промах`);
      if ((pool.freq.get(norm(shown)) ?? 0) >= MIN_FREQ) add(t.id, 'warning', `«${shown}» с лишней буквой — само слово сборника (${pool.freq.get(norm(shown))})`);
    } else if (t.kind === 'old-word' || t.kind === 'ending') {
      for (const p of optionProblems(t)) add(t.id, 'error', p);
    } else if (t.kind === 'cipher') {
      const r = cipherRivals(t, texts);
      if (r.length) add(t.id, 'error', `тот же узор чисел у «${r[0]}»${r.length > 1 ? ` и ещё ${r.length - 1}` : ''}: другой ответ`);
    } else if (t.kind === 'parts') {
      const r = partsRivals(t, bigrams);
      if (r.length) add(t.id, 'warning', `другой порядок читается не хуже: «${r[0].join(' ')}»${r.length > 1 ? ` и ещё ${r.length - 1}` : ''}`);
    }
  }
  return { findings, total: pack.tasks.length };
}

if (import.meta.main) {
  const { findings, total } = play();
  const errs = findings.filter(f => f.level === 'error');
  const warns = findings.filter(f => f.level === 'warning');
  const byKind = (prefix: string) => warns.filter(f => f.id.startsWith(prefix)).length;
  const lines = [
    '# «Виртуальный игрок»',
    '',
    `Задач: ${total}; ошибок: ${errs.length}; предупреждений: ${warns.length} (пословицы ${byKind('proverb')}, загадки ${byKind('riddle')}, лишняя буква ${byKind('extra')}, части ${byKind('parts')}).`,
    '',
    'Ошибка — задачу нельзя решить честно; предупреждение — проверить при сверке со сканом (`review: checked` ставит человек).',
    '',
    ...findings.map(f => `- **${f.level === 'error' ? 'ошибка' : 'проверить'}** \`${f.id}\`: ${f.what}`),
    '',
  ];
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist', 'play.md'), lines.join('\n'));
  console.log(lines[2]);
  for (const f of errs) console.log(`ошибка ${f.id}: ${f.what}`);
  console.log('Отчёт: dist/play.md');
  if (errs.length) process.exit(1);
}
