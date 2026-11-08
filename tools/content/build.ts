// Сборка контента (docs/09-content.md, §4–5; specs/2026-10-content-pipeline.md):
// content/ → src/content/generated/pack.ts (не в git). Ряд букв, варианты и части готовит сборка
// детерминированно от id и version (ADR 0005). Ошибки — списком, сборка красная.
//
//   bun tools/content/build.ts [--check] [--release]
//   --check   — только проверить, ничего не писать
//   --release — в набор только `review: checked`; календарь — только на checked и с запасом ≥ RELEASE_DAYS (60) дней, ADR 0008
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { dayNumber, weekday, type Calendar } from '../../src/engine/day';
import { tokens, words } from '../../src/engine/words';
import { textLetters } from '../../src/engine/cipher';
import type { Kind as TaskKind, Task } from '../../src/engine/types';
import type { Notebook, Pack } from '../../src/content/types';
import { loadPool } from './pool';
import { FOLDERS, readRecords, type Rec } from './records';
import { calendarErrors, lockErrors, type Lock } from './released';
import { WEEK } from './calendar';
import { cipherOf, cipherProblem } from './cipher';
import { endingSplit, letterRow, shuffleNotSame } from './shuffle';

const ROOT = join(import.meta.dir, '..', '..');
/** Запас выпущенного календаря от дня сборки, дней (ADR 0008: 60 сверенных, дописывается каждым выпуском). */
export const RELEASE_DAYS = 60;
const RU = /^[а-яё]+(?:-[а-яё]+)*$/;

interface Book {
  key: string;
  title: string;
  blurb: string;
  free?: boolean | string;
}

const yes = (v: unknown) => v === true || v === 'yes';

/** Источник одной строкой: «В. И. Даль. Пословицы русского народа. 2-е изд., 1879, „Работа — Праздность“». */
function sourceLine(r: Rec): string {
  const s = r.source;
  const where = s.section ? `«${s.section}»` : s.page ? `с. ${s.page}` : '';
  return `${s.work}. ${s.edition.split(' (')[0]}${where ? `, ${where}` : ''}`;
}

/** Запись → задача движка; ошибки — в `errors`. */
export function toTask(r: Rec, errors: string[]): Task | null {
  const at = r.file ?? r.id;
  const base = { id: r.id, version: r.version, kind: r.kind as TaskKind, text: r.text ?? '', about: r.about ?? '', source: sourceLine(r) };
  const answerOk = (a: string | undefined) => {
    const letters = (a ?? '').replace(/-/g, '');
    if (!a || !RU.test(a) || letters.length < 3 || letters.length > 12) {
      errors.push(`${at}: ответ «${a ?? ''}» — не 3–12 русских букв`);
      return false;
    }
    return true;
  };
  if (r.kind === 'proverb') {
    if (!r.text || !answerOk(r.answer)) return null;
    const ws = words(r.text);
    if (!r.gap || ws[r.gap - 1]?.toLowerCase() !== r.answer) {
      errors.push(`${at}: gap ${r.gap} не указывает на ответ «${r.answer}»`);
      return null;
    }
    const prompt = tokens(r.text).map(t => (t.word && t.n === r.gap! - 1 ? '____' : t.text)).join('');
    return { ...base, prompt, answer: r.answer!, row: letterRow(r.answer!, r.id, r.version) };
  }
  if (r.kind === 'riddle') {
    if (!r.text || !answerOk(r.answer)) return null;
    return { ...base, prompt: r.text, answer: r.answer!, row: letterRow(r.answer!, r.id, r.version) };
  }
  if (r.kind === 'old-word') {
    const word = String(r.word ?? '');
    if (!answerOk(word)) return null;
    const opts = r.options ?? [];
    if (opts.length < 3 || opts.some(o => o === word)) {
      errors.push(`${at}: у старого слова нужно три неверных варианта, не совпадающих с ответом`);
      return null;
    }
    if (!r.meaning) errors.push(`${at}: нет толкования`);
    const options = shuffleNotSame([word, ...opts.slice(0, 3)], r.id, r.version);
    return { ...base, text: `${word} — ${r.meaning ?? ''}`, prompt: r.meaning ?? '', answer: word, options };
  }
  if (r.kind === 'ending') {
    const split = r.text ? endingSplit(r.text) : null;
    const opts = r.options ?? [];
    if (!split) {
      errors.push(`${at}: у конца пословицы нужен текст с одним тире «начало — конец»`);
      return null;
    }
    const keyOf = (s: string) => s.toLowerCase().replace(/ё/g, 'е').replace(/[^а-я ]/g, '').replace(/\s+/g, ' ').trim();
    const keys = new Set([split.tail, ...opts].map(keyOf));
    if (opts.length !== 3 || keys.size !== 4 || opts.some(o => !o.trim())) {
      errors.push(`${at}: у конца пословицы нужно три неверных конца, разных и не совпадающих с верным`);
      return null;
    }
    const options = shuffleNotSame([split.tail, ...opts], r.id, r.version);
    return { ...base, prompt: `${split.head} — …`, answer: split.tail, options };
  }
  if (r.kind === 'extra-letter') {
    if (!r.text || !r.letter || !/^[а-яё]$/.test(r.letter) || !r.word || !r.position) {
      errors.push(`${at}: у лишней буквы нужны text, word, letter (одна строчная), position`);
      return null;
    }
    const ws = words(r.text);
    const wi = Number(r.word) - 1;
    const w = ws[wi];
    if (!w || r.position < 2 || r.position > w.length) {
      errors.push(`${at}: нет слова ${r.word} или позиция ${r.position} не внутри слова`);
      return null;
    }
    const changed = w.slice(0, r.position - 1) + r.letter + w.slice(r.position - 1);
    const shown = ws.map((x, i) => (i === wi ? changed : x));
    const prompt = tokens(r.text).map(t => (t.word ? shown[t.n] : t.text)).join('');
    return { ...base, prompt, answer: `${wi}:${r.position - 1}`, words: shown };
  }
  if (r.kind === 'cipher') {
    const why = r.text ? cipherProblem(r.text) : 'нет текста';
    const c = r.text && !why ? cipherOf(r.text, r.id, r.version) : null;
    if (why || !c) {
      errors.push(`${at}: тайнопись — ${why ?? 'не открыть буквы по правилу (08-game-design.md, «Буква на число»)'}`);
      return null;
    }
    return { ...base, prompt: '', answer: textLetters(r.text!).join(''), code: c.code, open: c.open };
  }
  // parts
  const parts = r.parts ?? [];
  if (!r.text || parts.length < 3 || parts.length > 4 || parts.join(' ').replace(/\s+/g, ' ') !== r.text.replace(/\s+/g, ' ')) {
    errors.push(`${at}: части (3–4) не складываются в текст`);
    return null;
  }
  const shuffled = shuffleNotSame(parts, r.id, r.version);
  const used = new Set<number>();
  const order = parts.map(p => {
    const i = shuffled.findIndex((s, k) => s === p && !used.has(k));
    used.add(i);
    return i;
  });
  return { ...base, prompt: '', answer: order.join(','), parts: shuffled };
}

export function build(root = ROOT, opts: { release?: boolean; today?: string } = {}) {
  const errors: string[] = [];
  const pool = loadPool(root);
  const stop = readFileSync(join(root, 'content', 'stoplist.txt'), 'utf8')
    .split('\n')
    .map(s => s.trim().toLowerCase())
    .filter(s => s && !s.startsWith('#'));
  const released = JSON.parse(readFileSync(join(root, 'content', 'released.json'), 'utf8')) as Record<string, number>;
  const books = parse(readFileSync(join(root, 'content', 'notebooks.yaml'), 'utf8')) as Book[];
  const keys = new Set(books.map(b => b.key));
  const raw = parse(readFileSync(join(root, 'content', 'calendar.yaml'), 'utf8')) as { from: string | null; days: Record<string, string> | null };
  const recs = readRecords(root);

  const tasks: Task[] = [];
  const byId = new Map<string, Rec>();
  for (const r of recs) {
    const at = r.file ?? r.id;
    const folder = FOLDERS[r.kind];
    if (!folder) {
      errors.push(`${at}: неизвестный вид ${r.kind}`);
      continue;
    }
    const expect = `content/${folder.dir}/${r.id.split('-').pop()}.yaml`;
    if (!r.id.startsWith(`${folder.prefix}-`) || expect !== r.file) errors.push(`${at}: id ${r.id} не совпадает с путём`);
    if (byId.has(r.id)) errors.push(`${at}: повтор id`);
    byId.set(r.id, r);
    if (!Number.isInteger(r.version) || r.version < (released[r.id] ?? 1)) errors.push(`${at}: version меньше выпущенной`);
    if (r.review !== 'draft' && r.review !== 'checked') errors.push(`${at}: review — draft или checked`);
    const s = r.source;
    if (!s || !s.work || !s.edition || !(s.section || s.page || r.page) || !s.url || !s.basis) errors.push(`${at}: источник без раздела/страницы, основания или url`);
    else if (s.basis !== 'общественное достояние') errors.push(`${at}: основание «${s.basis}» — только общественное достояние (другое — решением владельца)`);
    if (!r.about || r.about.trim().length === 0 || r.about.length > 280) errors.push(`${at}: about пуст или длиннее 280 знаков`);
    for (const k of r.notebooks ?? []) if (!keys.has(k)) errors.push(`${at}: нет тетради ${k}`);
    if (r.text && stop.some(w => words(r.text!).some(x => x.toLowerCase() === w))) errors.push(`${at}: слово из стоп-листа`);
    // запись, сделанная скриптом, держит текст источника буква в букву
    if (r.proverb) {
      const p = pool.byId.get(r.proverb);
      if (!p) errors.push(`${at}: нет пословицы ${r.proverb} в скачанном источнике`);
      else if (p.text !== r.text) errors.push(`${at}: текст разошёлся с источником (${r.proverb})`);
    }
    if (opts.release && r.review !== 'checked') continue;
    const t = toTask(r, errors);
    if (t) tasks.push(t);
  }

  const inPack = new Set(tasks.map(t => t.id));
  const notebooks: Notebook[] = books.map(b => ({
    key: b.key,
    title: b.title,
    blurb: b.blurb,
    free: yes(b.free),
    tasks: recs.filter(r => r.notebooks?.includes(b.key) && inPack.has(r.id)).map(r => r.id),
  }));

  const calendar: Calendar = { from: raw.from ?? '', days: {} };
  for (const [date, id] of Object.entries(raw.days ?? {})) {
    const r = byId.get(id);
    if (!r) errors.push(`календарь, ${date}: нет записи ${id}`);
    else if (!yes(r.daily)) errors.push(`календарь, ${date}: ${id} без daily: yes`);
    else if (r.notebooks?.length) errors.push(`календарь, ${date}: ${id} стоит в тетради — задача дня не входит в тетради`);
    else if (opts.release && r.review !== 'checked') errors.push(`календарь, ${date}: ${id} не checked`);
    if (inPack.has(id)) calendar.days[date] = id;
  }
  if (opts.release) {
    const dates = Object.keys(calendar.days).sort();
    const last = dates[dates.length - 1];
    const today = opts.today ?? new Date().toISOString().slice(0, 10);
    if (!last || dayNumber(last) - dayNumber(today) < RELEASE_DAYS) errors.push(`календарь: запас меньше ${RELEASE_DAYS} дней (последний день — ${last ?? 'нет'})`);
  }

  // выпущенное не меняется: запись — только новой version, дата календаря — никогда (tools/content/release.ts)
  const readJson = <T>(file: string, empty: T): T => {
    try {
      return JSON.parse(readFileSync(file, 'utf8')) as T;
    } catch {
      return empty;
    }
  };
  errors.push(...lockErrors(tasks, readJson<Record<string, Lock>>(join(root, 'content', 'released-lock.json'), {})));
  errors.push(...calendarErrors(calendar.days, readJson<Record<string, string>>(join(root, 'tools', 'test', 'fixtures', 'calendar-released.json'), {})));

  const count = (k: string) => tasks.filter(t => t.kind === k).length;
  const draft = recs.filter(r => r.review === 'draft').length;
  const plan = WEEK;
  const offPlan = Object.entries(calendar.days).filter(([d, id]) => byId.get(id)?.kind !== plan[weekday(d)]).length;
  const endingWed = Object.entries(calendar.days).filter(([d, id]) => weekday(d) === 2 && byId.get(id)?.kind === 'ending').length;
  const report = [
    `записей: ${recs.length} (черновиков ${draft}); в наборе: ${tasks.length} — пословиц ${count('proverb')}, загадок ${count('riddle')}, лишняя буква ${count('extra-letter')}, старых слов ${count('old-word')}, по частям ${count('parts')}, конец пословицы ${count('ending')}, тайнописи ${count('cipher')}`,
    `тетради: ${notebooks.map(b => `${b.key} ${b.tasks.length}`).join(', ')}`,
    `календарь: ${Object.keys(calendar.days).length} дней с ${calendar.from || '—'}; не по виду дня недели: ${offPlan} (из них в среду конец пословицы вместо старого слова: ${endingWed})`,
    `пословиц в источнике: ${pool.byId.size}, разрешено: ${pool.allowed.length}`,
  ];
  const pack: Pack = { tasks, notebooks, calendar, released, draft };
  return { pack, errors, report };
}

if (import.meta.main) {
  const release = process.argv.includes('--release');
  const { pack, errors, report } = build(ROOT, { release });
  console.log(report.join('\n'));
  if (errors.length) {
    console.error(errors.slice(0, 50).join('\n') + (errors.length > 50 ? `\n… ещё ${errors.length - 50}` : ''));
    process.exit(1);
  }
  if (!process.argv.includes('--check')) {
    const out = join(ROOT, 'src', 'content', 'generated');
    mkdirSync(out, { recursive: true });
    // строкой: литерал на полторы тысячи задач TypeScript не выводит («union type that is too complex»)
    writeFileSync(join(out, 'pack.ts'), `// Сделано tools/content/build.ts из content/ — не править руками.\nimport type { Pack } from '../types';\n\nexport const PACK: Pack = JSON.parse(${JSON.stringify(JSON.stringify(pack))});\n`);
    mkdirSync(join(ROOT, 'dist'), { recursive: true });
    writeFileSync(join(ROOT, 'dist', 'report.md'), `# Отчёт сборки контента\n\n${report.map(l => `- ${l}`).join('\n')}\n`);
  }
}
