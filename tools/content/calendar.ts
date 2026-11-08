// Календарь задач дня (ADR 0002, docs/09-content.md §4): дописывает content/calendar.yaml на N лет
// вперёд из записей с `daily: yes` и `review: checked`; уже назначенные даты не трогает никогда.
// Виды по дням недели — docs/08-game-design.md, «Задача дня»; нет задачи нужного вида — пословица
// (сборка считает такие дни в отчёте: «не по виду дня недели»).
//
//   bun tools/content/calendar.ts --from 2026-12-01 --years 3 [--draft]
//   --draft — брать и черновики: для проверки игры до сверки; к выпуску каждая дата должна указывать
//             на checked — иначе `build.ts --release` красная.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { dateOf, dayNumber, weekday } from '../../src/engine/day';
import { readRecords, type Kind } from './records';

const ROOT = join(import.meta.dir, '..', '..');
/** пн — пословица, вт — загадка, ср — старое слово, чт — лишняя буква, пт — по частям, сб — пословица, вс — загадка */
export const WEEK: Kind[] = ['proverb', 'riddle', 'old-word', 'extra-letter', 'parts', 'proverb', 'riddle'];

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

function main() {
  const file = join(ROOT, 'content', 'calendar.yaml');
  const text = readFileSync(file, 'utf8');
  const cal = parse(text) as { from: string | null; days: Record<string, string> | null };
  const from = cal.from ?? arg('--from');
  if (!from) throw new Error('нет даты начала: --from ГГГГ-ММ-ДД');
  const years = Number(arg('--years') ?? '3');
  const draft = process.argv.includes('--draft');
  const days = { ...(cal.days ?? {}) };
  const taken = new Set(Object.values(days));
  const pool = readRecords(ROOT).filter(r => (r.daily === 'yes' || r.daily === true) && !r.notebooks?.length && (draft || r.review === 'checked') && !taken.has(r.id));
  const queue = new Map<Kind, string[]>();
  for (const r of pool) queue.set(r.kind, [...(queue.get(r.kind) ?? []), r.id]);
  const start = dayNumber(from);
  const end = dayNumber(dateOf(start)) + Math.round(years * 365.25);
  let added = 0;
  let fallback = 0;
  for (let d = start; d < end; d++) {
    const date = dateOf(d);
    if (days[date]) continue;
    const want = WEEK[weekday(date)];
    let id = queue.get(want)?.shift();
    if (!id) {
      id = queue.get('proverb')?.shift();
      if (id) fallback++;
    }
    if (!id) break;
    days[date] = id;
    added++;
  }
  const head = text.split('\n').filter(l => l.startsWith('#')).join('\n');
  const body = Object.keys(days)
    .sort()
    .map(d => `  ${d}: ${days[d]}`)
    .join('\n');
  writeFileSync(file, `${head}\nfrom: ${from}\ndays:\n${body}\n`);
  console.log(`дописано дней: ${added} (пословица вместо нужного вида: ${fallback}); всего: ${Object.keys(days).length}`);
}

if (import.meta.main) main();
