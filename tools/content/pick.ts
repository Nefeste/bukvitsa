// Подбор задач из пословиц Даля: тетради (content/notebooks.yaml) и задачи дня (content/calendar.yaml).
// Детерминированно: порядок — по хешу идентификатора пословицы, без случайности. Пишет записи
// задач в content/tasks/*.yaml со статусом `review: draft` — проверяет их человек (docs/09-content.md).
//
// Номера вечные (устав, «Код»): уже записанные задачи и дни календаря не меняются, новые
// дописываются в конец. `bun tools/content/pick.ts` — добрать до целей; `--fresh` — только пока
// ничего не выпущено, переписать всё заново.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';
import { fnv1a } from '../../src/engine/core/hash';
import { dateOf, dayNumber } from '../../src/engine/day';
import { words } from '../../src/engine/tasks';
import type { Kind } from '../../src/engine/types';
import { commonness, loadPool, type Pool } from './pool';
import type { Proverb } from './dal';

const ROOT = join(import.meta.dir, '..', '..');
const C = (p: string) => join(ROOT, 'content', p);

/** Служебные слова: их не прячем и не портим — задача про смысл, а не про предлог. */
export const STOP = new Set(
  ('и а но да не ни что как так то же ли бы по за на в во с со к ко у о об обо из от до без для при про над под ' +
    'его ее её их он она оно они мы вы ты я мне меня мной тебе тебя тобой себе себя нас вас нам вам им ему ей ' +
    'свой своя свое своё свои это этот эта эти тот та те кто где когда коли если вот уж все всё весь вся ' +
    'чем чего чему кому кого нет есть был была было были будет быть сам сама само сами тут там здесь ' +
    'еще ещё уже лишь только хоть хотя или либо ни-ни ин иной иная иное нами вами ими ней ним нем нею ею ' +
    'после перед через около возле ну эх ой ах аж вон эка экой этак таков такой такая такое такие какой ' +
    'какая какое какие который которая которое всякий всякая всякое всякому всех всем всего всею ' +
    'чтоб чтобы будто словно авось пусть пускай очень более менее самый самая самое').split(' '),
);

export interface Rec {
  id: string;
  kind: Kind;
  level: 1 | 2 | 3;
  proverb: string;
  word?: number;
  cut?: number;
  wrong?: string[];
  starts?: number[];
  at?: number;
  letter?: string;
  review: 'draft' | 'checked';
}

const order = (p: Proverb, salt: string) => fnv1a(`${salt}:${p.id}`);
/** Одинаковые пословицы у Даля бывают в разных разделах — в игре каждая один раз. */
const textKey = (p: Proverb) => words(p.text).join(' ').toLowerCase().replace(/ё/g, 'е');

function contentWords(p: Proverb): number[] {
  const ws = words(p.text);
  return ws
    .map((w, i) => ({ w, i }))
    .filter(({ w, i }) => !STOP.has(w.toLowerCase()) && !w.includes('-') && !(i > 0 && /^[А-ЯЁ]/.test(w)))
    .map(({ i }) => i);
}

let FREQ = new Map<string, number>();
const freqOf = (w: string) => FREQ.get(w.toLowerCase().replace(/ё/g, 'е')) ?? 0;

/**
 * gap: прячем самое обиходное знаменательное слово 4–9 букв (его можно угадать по смыслу), не первое,
 * если есть другие. Уровень — по длине и частоте слова в сборнике.
 */
export function gapOf(p: Proverb): Pick<Rec, 'word' | 'level'> | null {
  const ws = words(p.text);
  if (ws.length < 3 || ws.length > 12) return null;
  let cand = contentWords(p).filter(i => ws[i].length >= 4 && ws[i].length <= 9);
  if (cand.length > 1) cand = cand.filter(i => i > 0);
  if (!cand.length) return null;
  const i = cand.reduce((a, b) => (freqOf(ws[b]) > freqOf(ws[a]) || (freqOf(ws[b]) === freqOf(ws[a]) && b > a) ? b : a));
  const n = ws[i].length;
  const f = freqOf(ws[i]);
  const level = n <= 5 && f >= 20 ? 1 : n <= 7 && f >= 5 ? 2 : 3;
  return { word: i, level };
}

/** ending: пословица с тире; конец — после тире, 2–6 слов, начало — от 2 слов. */
export function endingCut(p: Proverb): number | null {
  if ((p.text.match(/ — /g) ?? []).length !== 1) return null;
  const [head, tail] = p.text.split(' — ');
  const h = words(head).length;
  const t = words(tail).length;
  // конец со строчной буквы: прописная выдала бы, что это начало другой пословицы
  if (h < 2 || t < 2 || t > 6 || !/^[а-яё]/.test(tail)) return null;
  return h;
}

/** parts: 6–12 слов; части — по знакам препинания, иначе поровну. Уровень — число частей. */
export function partsOf(p: Proverb, level: 1 | 2 | 3): number[] | null {
  const ws = words(p.text);
  if (ws.length < 6 || ws.length > 12) return null;
  const n = level + 2;
  if (ws.length < n * 2) return null;
  // граница — после слова со знаком: «, — : ;»
  const marks: number[] = [];
  let k = -1;
  for (const m of p.text.matchAll(/[А-Яа-яЁё]+(?:-[А-Яа-яЁё]+)*([,;:]| —)?/g)) {
    k++;
    if (m[1] && k + 1 < ws.length) marks.push(k + 1);
  }
  // части режутся только по знакам препинания — иначе кусок «Птицу по» не похож на часть пословицы;
  // из подходящих границ берутся ближайшие к равным долям
  if (marks.length < n - 1) return null;
  const starts = [0];
  const step = ws.length / n;
  for (let j = 1; j < n; j++) {
    const ideal = step * j;
    const left = marks.filter(x => x > starts[starts.length - 1] + 1 && ws.length - x >= n - j);
    if (!left.length) return null;
    starts.push(left.reduce((a, b) => (Math.abs(b - ideal) < Math.abs(a - ideal) ? b : a)));
  }
  return starts;
}

const COMMON = 'оеаинтсрвлкмдпу';

/** extra: слово 4–8 букв, буква внутрь, не рядом с такой же. Уровень — по числу слов. */
export function extraOf(p: Proverb): Pick<Rec, 'word' | 'at' | 'letter' | 'level'> | null {
  const ws = words(p.text);
  if (ws.length < 4 || ws.length > 10) return null;
  const cand = contentWords(p).filter(i => ws[i].length >= 4 && ws[i].length <= 8);
  if (!cand.length) return null;
  const h = fnv1a(`extra:${p.id}`);
  const i = cand[h % cand.length];
  const w = ws[i].toLowerCase();
  const at = 1 + ((h >>> 8) % (w.length - 1));
  let letter = '';
  for (let j = 0; j < COMMON.length; j++) {
    const c = COMMON[((h >>> 16) + j) % COMMON.length];
    if (c !== w[at - 1] && c !== w[at]) {
      letter = c;
      break;
    }
  }
  if (!letter) return null;
  return { word: i, at, letter, level: ws.length <= 5 ? 1 : ws.length <= 8 ? 2 : 3 };
}

/** Чужие концы для ending: того же размера ±1 слово, из других пословиц. Запись — `id@cut`. */
function wrongFor(p: Proverb, cut: number, endings: { p: Proverb; cut: number }[]): string[] | null {
  const tailLen = words(p.text).length - cut;
  const tail = p.text.split(' — ')[1];
  const pool = endings
    .filter(e => e.p.id !== p.id && Math.abs(words(e.p.text).length - e.cut - tailLen) <= 1 && e.p.text.split(' — ')[1] !== tail)
    .sort((a, b) => fnv1a(`wrong:${p.id}:${a.p.id}`) - fnv1a(`wrong:${p.id}:${b.p.id}`));
  const out: string[] = [];
  const seen = new Set<string>([tail]);
  for (const e of pool) {
    const t = e.p.text.split(' — ')[1];
    if (seen.has(t)) continue;
    seen.add(t);
    out.push(`${e.p.id}@${e.cut}`);
    if (out.length === 3) return out;
  }
  return null;
}

/** Сделать задачу вида `kind` из пословицы; `null` — пословица не подходит. */
export function makeTask(id: string, kind: Kind, p: Proverb, endings: { p: Proverb; cut: number }[], want?: 1 | 2 | 3): Rec | null {
  if (kind === 'gap') {
    const g = gapOf(p);
    if (!g || (want && g.level !== want)) return null;
    return { id, kind, level: g.level!, proverb: p.id, word: g.word, review: 'draft' };
  }
  if (kind === 'ending') {
    const cut = endingCut(p);
    if (cut == null) return null;
    const wrong = wrongFor(p, cut, endings);
    if (!wrong) return null;
    return { id, kind, level: words(p.text).length - cut <= 3 ? 1 : 2, proverb: p.id, cut, wrong, review: 'draft' };
  }
  if (kind === 'parts') {
    const level = want ?? 1;
    const starts = partsOf(p, level);
    if (!starts) return null;
    return { id, kind, level, proverb: p.id, starts, review: 'draft' };
  }
  const e = extraOf(p);
  if (!e || (want && e.level !== want)) return null;
  return { id, kind, level: e.level!, proverb: p.id, word: e.word, at: e.at, letter: e.letter, review: 'draft' };
}

interface NotebookDef {
  id: string;
  title: string;
  sections: string[];
  /** слова, хотя бы одно из которых должно быть в пословице (основы) */
  words?: string[];
  size: number;
}

/** Вид и уровень задачи по её месту в тетради: виды по кругу, к концу — труднее. */
export function slotOf(n: number, size: number): { kind: Kind; want?: 1 | 2 | 3 } {
  const kinds: Kind[] = ['gap', 'ending', 'parts', 'extra'];
  const kind = kinds[n % 4];
  const want = (n < size / 3 ? 1 : n < (2 * size) / 3 ? 2 : 3) as 1 | 2 | 3;
  return { kind, want: kind === 'ending' ? undefined : kind === 'parts' ? (Math.min(want, 2) as 1 | 2) : want };
}

/** Набор задач дня: лёгкое слово, конец, части, лишняя буква, слово потруднее. */
export const DAY_SLOTS: { kind: Kind; want?: 1 | 2 | 3 }[] = [
  { kind: 'gap', want: 1 },
  { kind: 'ending' },
  { kind: 'parts', want: 1 },
  { kind: 'extra' },
  { kind: 'gap', want: 2 },
];

function readRecs(file: string): Rec[] {
  return existsSync(file) ? ((parse(readFileSync(file, 'utf8')) as Rec[] | null) ?? []) : [];
}

const HEADER = (what: string) =>
  `# ${what}. Сделано tools/content/pick.ts, проверяет человек: \`review: checked\` ставит только он.\n` +
  '# Номера вечные: запись не удаляется и не перенумеровывается (docs/09-content.md).\n';

function main() {
  const fresh = process.argv.includes('--fresh');
  const pool: Pool = loadPool(ROOT);
  FREQ = pool.freq;
  const all = pool.allowed;
  // знакомость пословицы — грубыми ступенями, внутри ступени порядок по хешу (не по алфавиту)
  const tier = new Map(all.map(p => [p.id, Math.floor(commonness(p.text, pool.freq))]));
  const endings = all.map(p => ({ p, cut: endingCut(p) })).filter((e): e is { p: Proverb; cut: number } => e.cut != null);
  const used = new Set<string>();
  const books = (parse(readFileSync(C('notebooks.yaml'), 'utf8')) as { notebooks: NotebookDef[] }).notebooks;

  // уже записанные задачи держат свои пословицы
  const existing = new Map<string, Rec[]>();
  for (const b of books) existing.set(b.id, fresh ? [] : readRecs(C(`tasks/${b.id}.yaml`)));
  existing.set('daily', fresh ? [] : readRecs(C('tasks/daily.yaml')));
  const usedText = new Set<string>();
  const take = (p: Proverb) => {
    used.add(p.id);
    usedText.add(textKey(p));
  };
  const free = (p: Proverb) => !used.has(p.id) && !usedText.has(textKey(p));
  for (const recs of existing.values()) for (const r of recs) take(pool.byId.get(r.proverb)!);

  for (const b of books) {
    const recs = existing.get(b.id)!;
    const stems = (b.words ?? []).map(s => s.toLowerCase());
    const cand = all
      .filter(p => b.sections.includes(p.title))
      .filter(p => !stems.length || words(p.text).some(w => stems.some(s => w.toLowerCase().replace(/ё/g, 'е').startsWith(s))))
      .sort((a, c) => order(a, b.id) - order(c, b.id));
    while (recs.length < b.size) {
      const n = recs.length;
      const slot = slotOf(n, b.size);
      // нужного вида не нашлось — другой вид, чтобы тетрадь была полной
      const kinds: Kind[] = [slot.kind, ...(['gap', 'extra', 'ending', 'parts'] as Kind[]).filter(k => k !== slot.kind)];
      let made: Rec | null = null;
      for (const kind of kinds) {
        const want = kind === slot.kind ? slot.want : undefined;
        const p = cand.find(x => free(x) && makeTask('', kind, x, endings, want));
        if (!p) continue;
        made = makeTask(`t.${b.id}.${n + 1}`, kind, p, endings, want)!;
        take(p);
        break;
      }
      if (!made) {
        console.error(`тетрадь ${b.id}: не хватило пословиц на задачу ${n + 1}`);
        break;
      }
      recs.push(made);
    }
    writeFileSync(C(`tasks/${b.id}.yaml`), HEADER(`Тетрадь «${b.title}»`) + stringify(recs, { lineWidth: 0 }));
  }

  // задачи дня: из всех разрешённых разделов, кроме взятого тетрадями; зимой — зимние пословицы
  const cal = parse(readFileSync(C('calendar.yaml'), 'utf8')) as { from: string; size: number; winter: { from: string; to: string; words: string[] }; days?: string[][] };
  const days = fresh ? [] : (cal.days ?? []);
  const daily = existing.get('daily')!;
  const winterStems = cal.winter.words.map(s => s.toLowerCase());
  const isWinter = (p: Proverb) => words(p.text).some(w => winterStems.some(s => w.toLowerCase().replace(/ё/g, 'е').startsWith(s)));
  // задачи дня — сперва самые обиходные пословицы: день — для всех, и первый — для новичка
  const sorted = all.slice().sort((a, c) => tier.get(c.id)! - tier.get(a.id)! || order(a, 'daily') - order(c, 'daily'));
  const w0 = dayNumber(cal.winter.from) - dayNumber(cal.from);
  const w1 = dayNumber(cal.winter.to) - dayNumber(cal.from);
  while (days.length < cal.size) {
    const d = days.length;
    const winter = d >= w0 && d <= w1;
    const ids: string[] = [];
    for (const slot of DAY_SLOTS) {
      const pick = (pref: boolean) => sorted.find(x => free(x) && (!pref || isWinter(x)) && makeTask('', slot.kind, x, endings, slot.want));
      const p = (winter ? pick(true) : undefined) ?? pick(false);
      if (!p) throw new Error(`день ${dateOf(dayNumber(cal.from) + d)}: не хватило пословиц (${slot.kind})`);
      const rec = makeTask(`d.${daily.length + 1}`, slot.kind, p, endings, slot.want)!;
      daily.push(rec);
      take(p);
      ids.push(rec.id);
    }
    days.push(ids);
  }
  writeFileSync(C('tasks/daily.yaml'), HEADER('Задачи дня') + stringify(daily, { lineWidth: 0 }));
  const head = readFileSync(C('calendar.yaml'), 'utf8').split('\ndays:')[0].trimEnd();
  writeFileSync(C('calendar.yaml'), `${head}\ndays:\n${days.map(d => `  - [${d.join(', ')}]`).join('\n')}\n`);
  console.log(`задач: тетради ${books.map(b => `${b.id} ${existing.get(b.id)!.length}`).join(', ')}; дней ${days.length}, задач дня ${daily.length}`);
}

if (import.meta.main) main();
