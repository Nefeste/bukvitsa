// Черновики записей задач из скачанного Даля (docs/09-content.md, §8 и «Что изменилось»).
// Скрипт делает то, что §8 поручает ассистенту, по тем же правилам и детерминированно: берёт
// пословицы разрешённых разделов (§2 — sections.yaml, banned.yaml, stoplist.txt), выбирает слово для
// пропуска, лишнюю букву, части, отгадку и пишет записи в формате §3 со статусом `review: draft`.
// `review: checked` ставит человек после сверки со сканом.
//
// Номера вечные: существующие записи не трогаются, новые получают следующие номера.
//   bun tools/content/pick.ts          — добрать тетради и пул задач дня до целей (PLAN)
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { fnv1a } from '../../src/engine/core/hash';
import { words } from '../../src/engine/words';
import { mainReading, type Proverb } from './dal';
import { bannedWord, commonness, loadPool, norm, type Pool } from './pool';
import { idOf, nextNumber, readRecords, writeRecord, type Kind, type Rec, type Source } from './records';
import { endingSplit, shuffle, Xorshift } from './shuffle';

const ROOT = join(import.meta.dir, '..', '..');
const BOOK = 'Пословицы русского народа (Даль)';

/** Служебные слова: их не прячем и не портим — задача про смысл, а не про предлог. */
export const STOP = new Set(
  ('и а но да не ни что как так то же ли бы по за на в во с со к ко у о об обо из от до без для при про над под ' +
    'его ее её их он она оно они мы вы ты я мне меня мной тебе тебя тобой себе себя нас вас нам вам им ему ей ' +
    'свой своя свое своё свои это этот эта эти тот та те кто где когда коли если вот уж все всё весь вся ' +
    'чем чего чему кому кого нет есть был была было были будет быть сам сама само сами тут там здесь ' +
    'еще ещё уже лишь только хоть хотя или либо ин иной иная иное нами вами ими ней ним нем нею ею ' +
    'после перед через около возле ну эх ой ах аж вон эка экой этак таков такой такая такое такие какой ' +
    'какая какое какие который которая которое всякий всякая всякое всякому всех всем всего всею ' +
    'чтоб чтобы будто словно авось пусть пускай очень более менее самый самая самое').split(' '),
);

let FREQ = new Map<string, number>();
let KNOWN = new Set<string>();
let TAILS: { id: string; tail: string }[] = [];
const freqOf = (w: string) => FREQ.get(norm(w)) ?? 0;

function contentWords(text: string): number[] {
  const ws = words(text);
  return ws
    .map((w, i) => ({ w, i }))
    .filter(({ w, i }) => !STOP.has(w.toLowerCase()) && !w.includes('-') && !(i > 0 && /^[А-ЯЁ]/.test(w)))
    .map(({ i }) => i);
}

/** Пословица с пропуском: самое обиходное знаменательное слово 4–9 букв, не первое, если есть другие. */
export function gapOf(text: string): number | null {
  const ws = words(text);
  if (ws.length < 3 || ws.length > 10) return null;
  let cand = contentWords(text).filter(i => ws[i].length >= 4 && ws[i].length <= 9);
  if (cand.length > 1) cand = cand.filter(i => i > 0);
  if (!cand.length) return null;
  return cand.reduce((a, b) => (freqOf(ws[b]) > freqOf(ws[a]) || (freqOf(ws[b]) === freqOf(ws[a]) && b > a) ? b : a));
}

/** По частям: 6–12 слов, 3–4 части, границы — только по знакам препинания. */
export function partsOf(text: string, n: 3 | 4): string[] | null {
  const ws = words(text);
  if (ws.length < 6 || ws.length > 12 || ws.length < n * 2) return null;
  const marks: number[] = [];
  let k = -1;
  for (const m of text.matchAll(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*([,;:]| —)?/g)) {
    k++;
    if (m[1] && k + 1 < ws.length) marks.push(k + 1);
  }
  if (marks.length < n - 1) return null;
  const starts = [0];
  const step = ws.length / n;
  for (let j = 1; j < n; j++) {
    const left = marks.filter(x => x > starts[starts.length - 1] + 1 && ws.length - x >= n - j);
    if (!left.length) return null;
    const ideal = step * j;
    starts.push(left.reduce((a, b) => (Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a)));
  }
  // части — куски исходного текста между началами слов
  const at: number[] = [];
  let w = -1;
  for (const m of text.matchAll(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*/g)) {
    w++;
    if (starts.includes(w)) at.push(m.index ?? 0);
  }
  const parts = at.map((p, i) => text.slice(p, i + 1 < at.length ? at[i + 1] : text.length).trim());
  return parts.join(' ') === text.replace(/\s+/g, ' ').trim() ? parts : null;
}

/** Ключ сравнения концов: строчными, ё как е, без знаков. */
const tailKey = (s: string) => norm(s).replace(/[^а-я ]/g, '').replace(/\s+/g, ' ').trim();
const wordCount = (s: string) => words(s).length;

/**
 * Три неверных конца для «Конца пословицы» (bukvitsa#6): концы других разрешённых пословиц Даля с
 * тире — той же длины в словах (±1) и в буквах (0,6–1,6), с другим первым словом. Начало с чужим
 * концом не должно совпасть ни с одной пословицей сборника. Выбор — от sha256(id:version), как ряд
 * букв (ADR 0005): одинаковый вход — одинаковые варианты.
 */
export function wrongEndings(id: string, version: number, p: Proverb, tails: { id: string; tail: string }[], known: Set<string>): string[] | null {
  const own = endingSplit(p.text);
  if (!own) return null;
  const n = wordCount(own.tail);
  const first = tailKey(own.tail).split(' ')[0];
  const cand = tails.filter(t => {
    if (t.id === p.id || tailKey(t.tail) === tailKey(own.tail)) return false;
    const m = wordCount(t.tail);
    const ratio = t.tail.length / own.tail.length;
    if (Math.abs(m - n) > 1 || ratio < 0.6 || ratio > 1.6) return false;
    if (tailKey(t.tail).split(' ')[0] === first) return false;
    return !known.has(tailKey(`${own.head} ${t.tail}`));
  });
  const out: string[] = [];
  const keys = new Set([tailKey(own.tail)]);
  for (const t of shuffle(cand, new Xorshift(id, version))) {
    if (keys.has(tailKey(t.tail))) continue;
    keys.add(tailKey(t.tail));
    out.push(t.tail);
    if (out.length === 3) return out;
  }
  return null;
}

const COMMON = 'оеаинтсрвлкмдпу';

/** Лишняя буква: слово 4–8 букв, буква — частая строчная внутрь слова, не рядом с такой же. */
export function extraOf(id: string, text: string): { word: number; position: number; letter: string } | null {
  const ws = words(text);
  if (ws.length < 4 || ws.length > 10) return null;
  const cand = contentWords(text).filter(i => ws[i].length >= 4 && ws[i].length <= 8);
  if (!cand.length) return null;
  const h = fnv1a(`extra:${id}`);
  const i = cand[h % cand.length];
  const w = ws[i].toLowerCase();
  const at = 1 + ((h >>> 8) % (w.length - 1)); // вставка перед буквой at (с нуля): не первой и не после последней
  for (let j = 0; j < COMMON.length; j++) {
    const c = COMMON[((h >>> 16) + j) % COMMON.length];
    if (c !== w[at - 1] && c !== w[at]) return { word: i + 1, position: at + 1, letter: c };
  }
  return null;
}

/** Отгадки, которых не берём (§2: оружие, война, смерть). */
const RIDDLE_NO = ['ружь', 'ружей', 'пул', 'выстрел', 'заряд', 'пушк', 'сабл', 'смерт', 'гроб', 'нож', 'топор', 'кнут', 'бич'];

interface Riddle {
  id: string;
  text: string;
  answer: string;
  note: string;
}

/** Загадки из раздела «Загадки»: отгадка — слово в скобках; «то же» — отгадка предыдущей строки. */
export function riddlesOf(pool: Pool, stems: string[]): Riddle[] {
  const out: Riddle[] = [];
  let prev = '';
  for (const p of pool.byId.values()) {
    if (p.title !== 'Загадки') continue;
    // строка разбилась на несколько пословиц — у загадки так не бывает, такую строку не берём
    if (mainReading(p.original).text !== p.text) continue;
    let a = p.note.trim().toLowerCase().replace(/[.!]$/, '');
    if (/^(то же|он же|она же|оно же|те же)\b/.test(a)) a = prev;
    else prev = /^[а-яё]+$/.test(a) ? a : '';
    if (!/^[а-яё]{3,12}$/.test(a)) continue;
    if (RIDDLE_NO.some(s => a.startsWith(s))) continue;
    if (bannedWord(p.text, stems) || bannedWord(a, stems)) continue;
    if (words(p.text).some(w => norm(w) === norm(a))) continue; // отгадка не должна стоять в самой загадке
    out.push({ id: p.id, text: p.text, answer: a, note: p.note });
  }
  return out;
}

const urlOf = (title: string) => `https://ru.wikisource.org/wiki/${`${BOOK}/${title}`.replace(/ /g, '_')}`;

function sourceOf(p: Proverb): Source {
  return {
    work: 'Даль. Пословицы русского народа',
    edition: '2-е изд., 1879 (текст Викитеки — по 1-му изд., 1862, без изменений против 2-го)',
    section: p.section,
    basis: 'общественное достояние',
    url: urlOf(p.title),
    checked_against: 'текст Викитеки 08.11.2026, не сверено со сканом',
  };
}

/** «Откуда это» только из источника: раздел, скобки Даля, соседняя пословица (09-content.md, §6). */
export function aboutOf(p: Proverb, neighbour: string | undefined): string {
  let s = `Из раздела «${p.section}».`;
  if (p.note) s += ` У Даля в скобках: ${p.note.replace(/\.$/, '')}.`;
  if (neighbour && s.length + neighbour.length + 20 <= 280) s += ` У Даля рядом — «${neighbour.replace(/[.]$/, '')}».`;
  return s.slice(0, 280);
}

/** Цели — docs/08-game-design.md, «Тетради» и «Задача дня»; состав тетрадей — content/notebooks.yaml. */
const PLAN = {
  /** тетрадь: сколько задач и каких видов */
  notebook: 40,
  firstMix: { proverb: 9, riddle: 8, 'extra-letter': 11, parts: 11 } as Record<string, number>,
  bookMix: ['proverb', 'extra-letter', 'parts', 'proverb'] as Kind[],
  /** пул задач дня на три года (1096 дней): пословицы — и на дни без загадок и старых слов */
  daily: { proverb: 800, 'extra-letter': 160, parts: 160, ending: 160 } as Record<string, number>,
};

interface Book {
  key: string;
  sections?: string[];
  words?: string[];
}

function main() {
  const pool = loadPool(ROOT);
  FREQ = pool.freq;
  KNOWN = new Set([...pool.byId.values()].map(q => tailKey(q.text.replace(' — ', ' '))));
  TAILS = pool.allowed.flatMap(q => {
    const s = endingSplit(q.text);
    return s ? [{ id: q.id, tail: s.tail }] : [];
  });
  const stems = [
    ...(parse(readFileSync(join(ROOT, 'content', 'banned.yaml'), 'utf8')) as { stems: string[] }).stems,
    ...readFileSync(join(ROOT, 'content', 'stoplist.txt'), 'utf8').split('\n').map(s => s.trim()).filter(s => s && !s.startsWith('#')),
  ];
  const books = parse(readFileSync(join(ROOT, 'content', 'notebooks.yaml'), 'utf8')) as Book[];
  const existing = readRecords(ROOT);
  const usedText = new Set(existing.map(r => (r.text ? words(r.text).map(norm).join(' ') : '')).filter(Boolean));
  const usedProverb = new Set(existing.map(r => r.proverb).filter(Boolean) as string[]);
  const textKey = (t: string) => words(t).map(norm).join(' ');
  const free = (p: Proverb) => !usedProverb.has(p.id) && !usedText.has(textKey(p.text));
  const take = (p: Proverb) => {
    usedProverb.add(p.id);
    usedText.add(textKey(p.text));
  };
  const counter = new Map<Kind, number>();
  const nextId = (k: Kind) => {
    const n = counter.get(k) ?? nextNumber(ROOT, k);
    counter.set(k, n + 1);
    return idOf(k, n);
  };
  const bySection = new Map<string, Proverb[]>();
  for (const p of pool.allowed) bySection.set(p.title, [...(bySection.get(p.title) ?? []), p]);
  const neighbour = (p: Proverb) => bySection.get(p.title)?.find(q => q.id !== p.id && q.text.length <= 90 && !q.text.includes(p.text));

  /** Запись вида `kind` из пословицы или `null`, если пословица не подходит. */
  const make = (kind: Kind, p: Proverb, daily: boolean, notebooks: string[]): Rec | null => {
    const base = (id: string) => ({ id, version: 1, kind, review: 'draft' as const, daily: daily ? ('yes' as const) : ('no' as const), notebooks, source: sourceOf(p), proverb: p.id, about: aboutOf(p, neighbour(p)?.text) });
    if (kind === 'proverb') {
      const g = gapOf(p.text);
      if (g == null) return null;
      return { ...base(nextId(kind)), text: p.text, answer: words(p.text)[g].toLowerCase(), gap: g + 1 };
    }
    if (kind === 'extra-letter') {
      const id = nextId(kind);
      const e = extraOf(id, p.text);
      if (!e) {
        counter.set(kind, counter.get(kind)! - 1);
        return null;
      }
      return { ...base(id), text: p.text, word: e.word, letter: e.letter, position: e.position };
    }
    if (kind === 'ending') {
      const id = nextId(kind);
      const split = endingSplit(p.text);
      const options = split ? wrongEndings(id, 1, p, TAILS, KNOWN) : null;
      if (!split || !options) {
        counter.set(kind, counter.get(kind)! - 1);
        return null;
      }
      return { ...base(id), text: p.text, options };
    }
    if (kind === 'parts') {
      const parts = partsOf(p.text, (fnv1a(p.id) % 2 === 0 ? 3 : 4) as 3 | 4) ?? partsOf(p.text, 3);
      if (!parts) return null;
      return { ...base(nextId(kind)), text: p.text, parts };
    }
    return null;
  };
  /** Пробная проверка без расхода номера. */
  const fits = (kind: Kind, p: Proverb) =>
    kind === 'ending'
      ? endingSplit(p.text) != null && wrongEndings('probe', 1, p, TAILS, KNOWN) != null
      : kind === 'proverb' ? gapOf(p.text) != null : kind === 'parts' ? (partsOf(p.text, 3) ?? partsOf(p.text, 4)) != null : extraOf('probe', p.text) != null;

  const hashOrder = (salt: string) => (a: Proverb, b: Proverb) => fnv1a(`${salt}:${a.id}`) - fnv1a(`${salt}:${b.id}`);
  const inBook = (key: string) => existing.filter(r => r.notebooks?.includes(key)).length;
  const made: Rec[] = [];
  const emit = (r: Rec | null) => {
    if (!r) return false;
    made.push(r);
    writeRecord(ROOT, r);
    return true;
  };

  // загадки: сперва в первую тетрадь, остальные — в пул задач дня
  const riddles = riddlesOf(pool, stems).filter(r => !usedProverb.has(r.id));
  let firstRiddles = existing.filter(r => r.kind === 'riddle' && r.notebooks?.includes('first')).length;
  for (const rd of riddles) {
    const p = pool.byId.get(rd.id)!;
    const toFirst = firstRiddles < PLAN.firstMix.riddle;
    if (toFirst) firstRiddles++;
    emit({
      id: nextId('riddle'), version: 1, kind: 'riddle', review: 'draft', daily: toFirst ? 'no' : 'yes', notebooks: toFirst ? ['first'] : [],
      source: { ...sourceOf(p), section: 'Загадки' }, proverb: p.id, text: p.text, answer: rd.answer,
      about: `Загадка из раздела «Загадки» сборника Даля. Отгадка у Даля — «${rd.note.replace(/\.$/, '')}».`,
    });
    take(p);
  }

  // тетради
  for (const b of books) {
    if (b.key.startsWith('riddles-') || b.key === 'things' || b.key === 'people') continue; // загадки и старые слова — руками (§8)
    const stemsB = (b.words ?? []).map(s => s.toLowerCase());
    const cand = pool.allowed
      .filter(p => !b.sections || b.sections.includes(p.title))
      .filter(p => !stemsB.length || words(p.text).some(w => stemsB.some(s => norm(w).startsWith(s))))
      .sort(hashOrder(b.key));
    let n = inBook(b.key);
    let turn = 0;
    const mix = b.key === 'first' ? (['proverb', 'extra-letter', 'parts'] as Kind[]) : PLAN.bookMix;
    while (n < PLAN.notebook) {
      const kind = mix[turn++ % mix.length];
      const p = cand.find(x => free(x) && fits(kind, x));
      if (!p) break;
      if (emit(make(kind, p, false, [b.key]))) {
        take(p);
        n++;
      }
      if (turn > 4000) break;
    }
  }

  // пул задач дня — сперва самые обиходные пословицы, внутри ступени — по хешу
  const tier = (p: Proverb) => Math.floor(commonness(p.text, pool.freq));
  const sorted = pool.allowed.slice().sort((a, c) => tier(c) - tier(a) || hashOrder('daily')(a, c));
  for (const kind of ['proverb', 'extra-letter', 'parts', 'ending'] as Kind[]) {
    let have = existing.filter(r => r.kind === kind && (r.daily === 'yes' || r.daily === true)).length + made.filter(r => r.kind === kind && r.daily === 'yes').length;
    for (const p of sorted) {
      if (have >= PLAN.daily[kind]) break;
      if (!free(p) || !fits(kind, p)) continue;
      if (emit(make(kind, p, true, []))) {
        take(p);
        have++;
      }
    }
  }
  const count = (k: Kind) => made.filter(r => r.kind === k).length;
  console.log(`новых записей: ${made.length} — пословиц ${count('proverb')}, загадок ${count('riddle')}, с лишней буквой ${count('extra-letter')}, по частям ${count('parts')}, конец пословицы ${count('ending')}`);
}

if (import.meta.main) main();
