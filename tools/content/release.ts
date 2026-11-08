// Записать выпуск (specs/2026-10-content-pipeline.md; 05-process.md, «Выпуск версии», шаг 2): какие версии записей и
// какие даты календаря ушли игрокам. После этого сборка не даст поменять выпущенную запись без новой `version`,
// а тест — выпущенную дату календаря.
//
//   bun tools/content/release.ts v1.0.0   — набор как в магазине (--release: только checked, календарь ≥ 365 дней)
//
// Только для выпусков в RuStore: сборки на тег для закрытого теста (с черновиками) не выпуск — черновики правятся
// сверкой со сканом без новой version.
//
// Пишет content/released.json (id → version), content/released-lock.json (id → выпуск, version, sha256) и
// tools/test/fixtures/calendar-released.json (дата → id: все даты календаря, вошедшие в выпуск). Уже выпущенное
// не стирается и не переписывается: новые записи и даты дописываются, новые версии — заменяют старые.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { build } from './build';
import { calendarErrors, lockErrors, taskHash, type Lock } from './released';

const ROOT = join(import.meta.dir, '..', '..');
const sorted = <T>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
const read = <T>(p: string, empty: T): T => {
  try {
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  } catch {
    return empty;
  }
};

export function release(root: string, tag: string, opts: { today?: string } = {}) {
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error(`выпуск — vX.Y.Z, а не «${tag}»`);
  const { pack, errors } = build(root, { release: true, today: opts.today });
  const paths = {
    released: join(root, 'content', 'released.json'),
    lock: join(root, 'content', 'released-lock.json'),
    calendar: join(root, 'tools', 'test', 'fixtures', 'calendar-released.json'),
  };
  const lock = read<Record<string, Lock>>(paths.lock, {});
  const cal = read<Record<string, string>>(paths.calendar, {});
  const problems = [...errors, ...lockErrors(pack.tasks, lock), ...calendarErrors(pack.calendar.days, cal)];
  if (problems.length) return { ok: false as const, problems };
  const released = read<Record<string, number>>(paths.released, {});
  let added = 0;
  let bumped = 0;
  for (const t of pack.tasks) {
    const l = lock[t.id];
    if (!l) added++;
    else if (l.version !== t.version) bumped++;
    else continue;
    lock[t.id] = { tag, version: t.version, sha256: taskHash(t) };
    released[t.id] = t.version;
  }
  const days = { ...cal, ...pack.calendar.days };
  writeFileSync(paths.released, `${JSON.stringify(sorted(released), null, 2)}\n`);
  writeFileSync(paths.lock, `${JSON.stringify(sorted(lock), null, 2)}\n`);
  writeFileSync(paths.calendar, `${JSON.stringify(sorted(days), null, 2)}\n`);
  return { ok: true as const, added, bumped, days: Object.keys(days).length - Object.keys(cal).length };
}

if (import.meta.main) {
  const tag = process.argv[2] ?? '';
  const r = release(ROOT, tag);
  if (!r.ok) {
    console.error(r.problems.slice(0, 50).join('\n') + (r.problems.length > 50 ? `\n… ещё ${r.problems.length - 50}` : ''));
    process.exit(1);
  }
  console.log(`${tag}: новых записей ${r.added}, новых версий ${r.bumped}, новых дат календаря ${r.days}`);
}
