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
import { cipherOf, cipherProblem } from './cipher';
import { cipherRivals, shapeIndex } from './play';
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

let KNOWN = new Set<string>();
let TAILS: { id: string; tail: string }[] = [];
let SHAPES: ReturnType<typeof shapeIndex> = new Map();

function contentWords(text: string): number[] {
  const ws = words(text);
  return ws
    .map((w, i) => ({ w, i }))
    .filter(({ w, i }) => !STOP.has(w.toLowerCase()) && !w.includes('-') && !(i > 0 && /^[А-ЯЁ]/.test(w)))
    .map(({ i }) => i);
}

/**
 * Пословица с пропуском: последнее знаменательное слово 3–10 букв — на нём у пословицы обычно ударение и
 * рифма («Тише едешь — дальше ____»), так что слово можно вывести, а не только вспомнить. Не первое, если есть другие.
 */
export function gapOf(text: string): number | null {
  const ws = words(text);
  if (ws.length < 3 || ws.length > 10) return null;
  let cand = contentWords(text).filter(i => ws[i].length >= 3 && ws[i].length <= 10);
  if (cand.length > 1) cand = cand.filter(i => i > 0);
  if (!cand.length) return null;
  return cand[cand.length - 1];
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
    // 0,75–1,4: самый длинный из четырёх не больше чем вдвое длиннее самого короткого (tools/content/play.ts)
    if (Math.abs(m - n) > 1 || ratio < 0.75 || ratio > 1.4) return false;
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
    if (/^(то же|он же|она же|оно же|те же)(?![а-яё])/.test(a)) a = prev;
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
  /** первая тетрадь: 48 задач из отбора редактора и шесть загадок */
  first: { proverb: 14, ending: 9, 'extra-letter': 9, parts: 10, cipher: 6 } as Record<string, number>,
  firstRiddles: 6,
  /** тематическая тетрадь — 40 задач из отбора редактора */
  book: { proverb: 12, ending: 7, 'extra-letter': 7, parts: 7, cipher: 7 } as Record<string, number>,
  /** первые недели задачи дня — из отбора редактора (сколько найдётся, не больше) */
  dailyKnown: { proverb: 30, ending: 14, 'extra-letter': 14, parts: 14, cipher: 14 } as Record<string, number>,
  /** пул задач дня на три года (1096 дней): пословицы — и на дни без загадок и старых слов */
  daily: { proverb: 800, 'extra-letter': 160, parts: 160, ending: 160, cipher: 160 } as Record<string, number>,
};

/** Отбор редактора (content/known.txt): номера пословиц источника по порядку, от самых известных. */
export function readKnown(root: string): string[] {
  return readFileSync(join(root, 'content', 'known.txt'), 'utf8')
    .split('\n')
    .map(l => l.split('#')[0].trim())
    .filter(Boolean);
}

interface Book {
  key: string;
  sections?: string[];
  /** тетрадь берёт и пословицы разделов, не названных ни в одной тетради */
  rest?: boolean | string;
}

function main() {
  const pool = loadPool(ROOT);
  SHAPES = shapeIndex([...pool.byId.values()].map(q => q.text));
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
    if (kind === 'cipher') {
      // открытые буквы зависят от номера записи: проверка — на настоящем номере, не подошло — номер не тратится
      const id = nextId(kind);
      const c = cipherProblem(p.text) ? null : cipherOf(p.text, id, 1);
      const rivals = c ? cipherRivals({ id, version: 1, kind: 'cipher', prompt: '', answer: '', text: p.text, about: '', source: '', ...c }, SHAPES) : [];
      if (!c || rivals.length) {
        counter.set(kind, counter.get(kind)! - 1);
        return null;
      }
      return { ...base(id), text: p.text };
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
    kind === 'cipher'
      ? cipherProblem(p.text) == null && cipherOf(p.text, 'probe', 1) != null
      : kind === 'ending'
      ? endingSplit(p.text) != null && wrongEndings('probe', 1, p, TAILS, KNOWN) != null
      : kind === 'proverb' ? gapOf(p.text) != null : kind === 'parts' ? (partsOf(p.text, 3) ?? partsOf(p.text, 4)) != null : extraOf('probe', p.text) != null;

  const hashOrder = (salt: string) => (a: Proverb, b: Proverb) => fnv1a(`${salt}:${a.id}`) - fnv1a(`${salt}:${b.id}`);
  const made: Rec[] = [];
  const emit = (r: Rec | null) => {
    if (!r) return false;
    made.push(r);
    writeRecord(ROOT, r);
    return true;
  };

  const known = readKnown(ROOT);
  const rank = new Map(known.map((id, i) => [id, i]));
  const knownPool = known.map(id => pool.byId.get(id)).filter((p): p is Proverb => !!p && p.title !== 'Загадки' && pool.allowed.includes(p));

  // загадки — только из отбора редактора: отгадка, которую знают сегодня; сперва в первую тетрадь, остальные — в задачу дня
  const riddles = riddlesOf(pool, stems)
    .filter(r => rank.has(r.id) && !usedProverb.has(r.id))
    .sort((a, c) => rank.get(a.id)! - rank.get(c.id)!);
  let firstRiddles = existing.filter(r => r.kind === 'riddle' && r.notebooks?.includes('first')).length;
  for (const rd of riddles) {
    const p = pool.byId.get(rd.id)!;
    const toFirst = firstRiddles < PLAN.firstRiddles;
    if (toFirst) firstRiddles++;
    emit({
      id: nextId('riddle'), version: 1, kind: 'riddle', review: 'draft', daily: toFirst ? 'no' : 'yes', notebooks: toFirst ? ['first'] : [],
      source: { ...sourceOf(p), section: 'Загадки' }, proverb: p.id, text: p.text, answer: rd.answer,
      about: 'Загадка из раздела «Загадки» сборника Даля.',
    });
    take(p);
  }

  /**
   * Добрать задачи из отбора редактора до целей по видам. Редкие виды — первыми: пословица, годная в тайнопись или
   * по частям, идёт туда, а короткие известные остаются пропуску и концу.
   */
  const ORDER: Kind[] = ['cipher', 'parts', 'ending', 'extra-letter', 'proverb'];
  const fill = (cand: Proverb[], goal: Record<string, number>, have: (k: Kind) => number, daily: boolean, books: string[]) => {
    const left = new Map(ORDER.map(k => [k, Math.max(0, (goal[k] ?? 0) - have(k))]));
    for (const p of cand) {
      if (![...left.values()].some(n => n > 0)) break;
      if (!free(p)) continue;
      // вид с наибольшей долей недобора среди годных; при равенстве — более редкий
      const kind = ORDER.filter(k => left.get(k)! > 0 && fits(k, p)).sort((a, c) => left.get(c)! / goal[c] - left.get(a)! / goal[a])[0];
      if (!kind) continue;
      if (emit(make(kind, p, daily, books))) {
        take(p);
        left.set(kind, left.get(kind)! - 1);
      }
    }
    return [...left].filter(([, n]) => n > 0).map(([k, n]) => `${k} −${n}`);
  };
  const inBookOf = (key: string) => (k: Kind) => existing.filter(r => r.kind === k && r.notebooks?.includes(key)).length;

  // первая тетрадь — самые известные из отбора
  const short: string[] = [];
  const s1 = fill(knownPool, PLAN.first, inBookOf('first'), false, ['first']);
  if (s1.length) short.push(`first: ${s1.join(', ')}`);

  // первые недели задачи дня — следующие по известности
  const dailyHave = (k: Kind) => existing.filter(r => r.kind === k && (r.daily === 'yes' || r.daily === true) && r.proverb && rank.has(r.proverb)).length;
  const s2 = fill(knownPool, PLAN.dailyKnown, dailyHave, true, []);
  if (s2.length) short.push(`задача дня из отбора: ${s2.join(', ')}`);

  // тематические тетради — из отбора, по разделам Даля; тетрадь с `rest` берёт и разделы, не названные нигде
  const named = new Set(books.flatMap(b => b.sections ?? []));
  for (const b of books) {
    if (b.key === 'first') continue;
    const rest = b.rest === true || b.rest === 'yes';
    const cand = knownPool.filter(p => b.sections?.includes(p.title) || (rest && !named.has(p.title)));
    const s3 = fill(cand, PLAN.book, inBookOf(b.key), false, [b.key]);
    if (s3.length) short.push(`${b.key}: ${s3.join(', ')}`);
  }
  if (short.length) console.log(`не хватило в отборе редактора — ${short.join('; ')}`);

  // пул задач дня — сперва самые обиходные пословицы, внутри ступени — по хешу
  const tier = (p: Proverb) => Math.floor(commonness(p.text, pool.freq));
  const sorted = pool.allowed.slice().sort((a, c) => tier(c) - tier(a) || hashOrder('daily')(a, c));
  for (const kind of ['proverb', 'extra-letter', 'parts', 'ending', 'cipher'] as Kind[]) {
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
  console.log(`новых записей: ${made.length} — пословиц ${count('proverb')}, загадок ${count('riddle')}, с лишней буквой ${count('extra-letter')}, по частям ${count('parts')}, конец пословицы ${count('ending')}, тайнописи ${count('cipher')}`);
}

if (import.meta.main) main();
