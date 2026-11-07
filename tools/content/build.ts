// Сборка содержания: content/ → src/content/generated/bundle.ts (в git не лежит).
// Проверяет каждую запись (docs/09-content.md, «Проверка сборкой») и падает на первой же ошибке
// списком всех ошибок. Пословицы берутся из скачанного источника — сборка работает без сети.
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { dayNumber } from '../../src/engine/day';
import { endingSplit, gapAnswer, partsInOrder, words } from '../../src/engine/tasks';
import type { Task } from '../../src/engine/types';
import type { Bundle, Notebook } from '../../src/content/types';
import { loadPool } from './pool';
import type { Rec } from './pick';

const ROOT = join(import.meta.dir, '..', '..');

export function build(root = ROOT): { bundle: Bundle; errors: string[]; report: string[] } {
  const errors: string[] = [];
  const pool = loadPool(root);
  const raw = (parse(readFileSync(join(root, 'content', 'sources.yaml'), 'utf8')) as Record<string, { author: string; title: string; year: number; url: string }>)['dal-1862'];
  const src = { author: raw.author, title: raw.title, year: raw.year, url: raw.url };
  const books = (parse(readFileSync(join(root, 'content', 'notebooks.yaml'), 'utf8')) as { notebooks: { id: string; title: string; about: string }[] }).notebooks;
  const cal = parse(readFileSync(join(root, 'content', 'calendar.yaml'), 'utf8')) as { from: string; size: number; days?: string[][] };

  const tasks: Record<string, Task> = {};
  const usedProverb = new Map<string, string>();
  let draft = 0;
  const files = readdirSync(join(root, 'content', 'tasks')).filter(f => f.endsWith('.yaml')).sort();
  for (const f of files) {
    const recs = (parse(readFileSync(join(root, 'content', 'tasks', f), 'utf8')) as Rec[] | null) ?? [];
    for (const r of recs) {
      const at = `${f}: ${r.id}`;
      if (tasks[r.id]) errors.push(`${at}: повтор идентификатора`);
      if (r.review !== 'draft' && r.review !== 'checked') errors.push(`${at}: review — draft или checked`);
      if (r.review === 'draft') draft++;
      const p = pool.byId.get(r.proverb);
      if (!p) {
        errors.push(`${at}: нет пословицы ${r.proverb} в источнике`);
        continue;
      }
      if (pool.why.has(p.id)) errors.push(`${at}: пословица ${p.id} не разрешена — ${pool.why.get(p.id)}`);
      const prev = usedProverb.get(p.id);
      if (prev) errors.push(`${at}: пословица ${p.id} уже в задаче ${prev}`);
      usedProverb.set(p.id, r.id);
      const ws = words(p.text);
      const t: Task = { id: r.id, kind: r.kind, level: r.level, text: p.text, proverb: p.id, section: p.section };
      if (r.kind === 'gap' || r.kind === 'extra') {
        if (r.word == null || r.word < 0 || r.word >= ws.length) errors.push(`${at}: нет слова ${r.word}`);
        t.word = r.word;
      }
      if (r.kind === 'gap' && gapAnswer(t).length < 3) errors.push(`${at}: короткое скрытое слово`);
      if (r.kind === 'extra') {
        if (!r.letter || !/^[а-яё]$/.test(r.letter)) errors.push(`${at}: лишняя буква — одна строчная`);
        t.at = r.at;
        t.letter = r.letter;
      }
      if (r.kind === 'ending') {
        t.cut = r.cut;
        const { head, tail } = endingSplit(t);
        if (!head || !tail) errors.push(`${at}: начало или конец пустые`);
        const wrong: string[] = [];
        for (const w of r.wrong ?? []) {
          const [id, cut] = w.split('@');
          const q = pool.byId.get(id);
          if (!q) {
            errors.push(`${at}: нет пословицы ${id} для чужого конца`);
            continue;
          }
          const tt = endingSplit({ ...t, text: q.text, cut: Number(cut) }).tail;
          if (tt === tail) errors.push(`${at}: чужой конец совпал с верным`);
          wrong.push(tt);
        }
        if (wrong.length !== 3 || new Set(wrong).size !== 3) errors.push(`${at}: нужно три разных чужих конца`);
        t.wrong = wrong;
      }
      if (r.kind === 'parts') {
        t.starts = r.starts;
        const parts = partsInOrder(t);
        if (parts.length < 3 || parts.some(x => !x)) errors.push(`${at}: частей меньше трёх или пустая`);
      }
      tasks[r.id] = t;
    }
  }

  const notebooks: Notebook[] = books.map(b => ({
    id: b.id,
    title: b.title,
    about: b.about,
    tasks: Object.keys(tasks).filter(id => id.startsWith(`t.${b.id}.`)).sort((a, c) => Number(a.split('.')[2]) - Number(c.split('.')[2])),
  }));
  for (const b of notebooks) if (!b.tasks.length) errors.push(`тетрадь ${b.id}: нет задач`);

  const days = cal.days ?? [];
  try {
    dayNumber(cal.from);
  } catch (e) {
    errors.push(`календарь: ${(e as Error).message}`);
  }
  days.forEach((d, i) => {
    if (d.length !== 5) errors.push(`календарь, день ${i + 1}: задач не пять`);
    for (const id of d) if (!tasks[id]) errors.push(`календарь, день ${i + 1}: нет задачи ${id}`);
  });
  const inDays = new Set(days.flat());
  for (const id of Object.keys(tasks)) if (id.startsWith('d.') && !inDays.has(id)) errors.push(`задача ${id} — не в календаре`);

  const report = [
    `пословиц в источнике: ${pool.byId.size}, разрешено: ${pool.allowed.length}`,
    `задач: ${Object.keys(tasks).length} (черновиков ${draft}); тетрадей ${notebooks.length}; дней ${days.length} с ${cal.from}`,
  ];
  return { bundle: { tasks, notebooks, calendar: { from: cal.from, days }, source: src, draft }, errors, report };
}

if (import.meta.main) {
  const { bundle, errors, report } = build();
  if (errors.length) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  const out = join(ROOT, 'src', 'content', 'generated');
  mkdirSync(out, { recursive: true });
  writeFileSync(
    join(out, 'bundle.ts'),
    `// Сделано tools/content/build.ts из content/ — не править руками.\nimport type { Bundle } from '../types';\n\nexport const BUNDLE: Bundle = ${JSON.stringify(bundle)};\n`,
  );
  console.log(report.join('\n'));
}
