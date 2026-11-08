// Лист сверки (docs/09-content.md, §8; ADR 0008): записи, без которых не собрать выпуск, — первая тетрадь и задачи дня
// первых N дней календаря — одной строкой каждая: что показывает игра, раздел Даля, ссылка на Викитеку (на странице —
// индекс скана), файл записи. Отмечает, что уже `checked`. Ничего не меняет: `review: checked` ставит человек.
//
//   bun tools/content/sverka.ts [--days 70]   — dist/sverka.md
//
// 70 дней: выпуск собирается около 7 декабря, а запас сверенного календаря от дня сборки — не меньше 60 дней.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { readRecords, type Rec } from './records';

const ROOT = join(import.meta.dir, '..', '..');

/** Что сверить в записи — то, что увидит игрок. */
export function whatToCheck(r: Rec): string {
  const q = (s: string | undefined) => `«${(s ?? '').trim()}»`;
  switch (r.kind) {
    case 'proverb':
      return `${q(r.text)}, пропуск — «${r.answer}»`;
    case 'riddle':
      return `${q(r.text)}, отгадка — «${r.answer}»`;
    case 'extra-letter':
      return `${q(r.text)} (лишняя «${r.letter}» в слове ${r.word})`;
    case 'old-word':
      return `«${r.word}» — ${q(r.meaning)}, с. ${r.source.page ?? '?'}; неверные: ${(r.options ?? []).join(', ')}`;
    case 'parts':
      return `${q(r.text)} — части: ${(r.parts ?? []).map(p => `«${p}»`).join(' / ')}`;
    case 'ending':
      return `${q(r.text)}; неверные концы: ${(r.options ?? []).map(o => `«${o}»`).join(', ')}`;
    case 'cipher':
      return q(r.text);
  }
}

/** «54 задачи», «1 задача», «5 задач». */
const tasks = (n: number) => `${n} ${n % 10 === 1 && n % 100 !== 11 ? 'задача' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'задачи' : 'задач'}`;

function line(r: Rec, prefix = ''): string {
  const where = r.source.section ? `«${r.source.section}»` : r.source.page ? `с. ${r.source.page}` : '';
  const box = r.review === 'checked' ? '[x]' : '[ ]';
  return `- ${box} ${prefix}\`${r.id}\` ${whatToCheck(r)} — ${where}, [Викитека](<${r.source.url}>) — \`${r.file}\``;
}

export function sverka(root: string, days: number): { md: string; total: number; done: number } {
  const recs = readRecords(root);
  const byId = new Map(recs.map(r => [r.id, r]));
  const first = recs.filter(r => r.notebooks?.includes('first'));
  const cal = parse(readFileSync(join(root, 'content', 'calendar.yaml'), 'utf8')) as { days: Record<string, string> };
  const dates = Object.keys(cal.days ?? {}).sort().slice(0, days);
  const daily = dates.map(d => [d, byId.get(cal.days[d])!] as const).filter(([, r]) => r);
  const all = [...first, ...daily.map(([, r]) => r)];
  const done = all.filter(r => r.review === 'checked').length;
  const md = [
    '# Лист сверки к выпуску',
    '',
    `Сверено ${done} из ${all.length}. Сверять со сканом (индекс скана — на странице Викитеки): текст буква в букву, ` +
      'что показывает игра, раздел или страница. Сверено — в файле записи `review: checked` и в `checked_against` — что ' +
      'сверяли (например, «скан РГБ, 2-е изд., т. I, с. 650»). Ошибка в тексте — поправить в файле или написать агенту.',
    '',
    `## Первая тетрадь — ${tasks(first.length)}`,
    '',
    ...first.map(r => line(r)),
    '',
    `## Задача дня — ${dates[0] ?? '—'} … ${dates[dates.length - 1] ?? '—'} (${daily.length} дней)`,
    '',
    ...daily.map(([d, r]) => line(r, `${d} · `)),
    '',
  ].join('\n');
  return { md, total: all.length, done };
}

if (import.meta.main) {
  const i = process.argv.indexOf('--days');
  const days = i >= 0 ? Number(process.argv[i + 1]) : 70;
  const { md, total, done } = sverka(ROOT, days);
  mkdirSync(join(ROOT, 'dist'), { recursive: true });
  writeFileSync(join(ROOT, 'dist', 'sverka.md'), md);
  console.log(`Лист сверки: dist/sverka.md — сверено ${done} из ${total}`);
}
