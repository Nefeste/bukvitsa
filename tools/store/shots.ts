// Снимки для RuStore и сайта (store/README.md; устав, docs/08-publishing.md) — с веб-сборки, настоящими касаниями.
// Портрет 9 : 16: окно 360 × 640 при плотности 3 — 1080 × 1920. Прогресс тетради на снимках — запись сохранения
// схемы 1 (src/state/save.ts), положенная в хранилище браузера до запуска: снимки воспроизводимы.
// Задачи и ответы — из собранного набора, как в tools/e2e/browser.ts.
//
//   npm run content && EXPO_OFFLINE=1 npm run export:web && bun tools/store/shots.ts
//
// Пишет store/screenshots/ru/NN-*.png и графику магазина (tools/store/graphics.ts).
import { mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser, type Page } from 'playwright';
import { PACK } from '../../src/content/generated/pack';
import { cipherKey, norm, weekday, type Task } from '../../src/engine';
import type { Event, Save } from '../../src/state/save';
import { renderGraphics } from './graphics';

const ROOT = join(import.meta.dir, '..', '..');
const DIST = join(ROOT, process.env.E2E_DIST ?? 'dist-web');
const OUT = join(ROOT, 'store/screenshots/ru');

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(join(DIST, path === '/' ? 'index.html' : path));
    return (await file.exists()) ? new Response(file) : new Response(Bun.file(join(DIST, 'index.html')));
  },
});

const task = (id: string) => PACK.tasks.find(t => t.id === id)!;
const first = PACK.notebooks.find(b => b.key === 'first')!;
/** Первый день календаря с задачей дня вида `kind`. */
const dayOf = (kind: Task['kind']) => Object.keys(PACK.calendar.days).sort().find(d => task(PACK.calendar.days[d]).kind === kind)!;

/** Сохранение для снимков: в первой тетради решено 14 задач, две подсмотрены; задачи `keep` не тронуты. */
function seed(today: string, keep: string[], dark = false): Save {
  const events: Event[] = [];
  for (const id of first.tasks.filter(id => !keep.includes(id)).slice(0, 16)) {
    events.push(events.length % 8 === 7 ? { t: 'peeked', id, day: today } : { t: 'solved', id, day: today, tries: 1, hints: 0 });
  }
  return { schema: 1, events, settings: { adsConsent: 'no', ...(dark ? { theme: 'dark' } : {}) }, installedOn: today, counters: { solved: 14, peeked: 2, days: 1 } };
}

async function open(browser: Browser, today: string, save: Save): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
  await ctx.addInitScript(s => {
    if (!localStorage.getItem('bukvitsa.save')) localStorage.setItem('bukvitsa.save', s);
  }, JSON.stringify(save));
  const page = await ctx.newPage();
  await page.goto(`http://localhost:${server.port}/?date=${today}`);
  await page.getByTestId('daily').waitFor();
  await page.evaluate(() => document.fonts.ready);
  return page;
}

let n = 0;
async function shot(page: Page, name: string) {
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(OUT, `${String(++n).padStart(2, '0')}-${name}.png`) });
  console.log(`✓ ${name}`);
}
const tap = (p: Page, id: string) => p.getByTestId(id).click();

/** Плитки ряда по буквам ответа: первые `count` букв. */
async function placeLetters(p: Page, t: Task, count: number) {
  const row = t.row!;
  const taken = new Set<number>();
  for (const c of t.answer.replace(/-/g, '').split('').slice(0, count)) {
    const i = row.findIndex((x, k) => norm(x) === norm(c) && !taken.has(k));
    taken.add(i);
    await tap(p, `tile-${i}`);
  }
}

mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) rmSync(join(OUT, f));
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  // 1–2. задача дня — пословица с пропуском: ряд букв, первая подсказка, потом «Откуда это»
  const pDay = dayOf('proverb');
  const pTask = task(PACK.calendar.days[pDay]);
  let page = await open(browser, pDay, seed(pDay, [pTask.id]));
  await tap(page, 'daily-solve');
  await page.getByTestId('question').waitFor();
  await tap(page, 'hint-1');
  await placeLetters(page, pTask, 2);
  await shot(page, 'proverb');
  // остальные буквы ответа — те же плитки, что выбрала бы рука (как placeLetters, без первых двух)
  const row = pTask.row!;
  const used = new Set<number>();
  const idx = pTask.answer.replace(/-/g, '').split('').map(c => {
    const i = row.findIndex((x, k) => norm(x) === norm(c) && !used.has(k));
    used.add(i);
    return i;
  });
  for (const i of idx.slice(2)) await tap(page, `tile-${i}`);
  await page.getByTestId('source').waitFor();
  await shot(page, 'source');
  await page.context().close();

  // 3. конец пословицы — выбор из четырёх
  const eDay = dayOf('ending');
  page = await open(browser, eDay, seed(eDay, []));
  await tap(page, 'daily-solve');
  await page.getByTestId('question').waitFor();
  await shot(page, 'ending');
  await page.context().close();

  // 4. лишняя буква — слово раскрыто по буквам
  const xi = first.tasks.findIndex(id => task(id).kind === 'extra-letter');
  const xTask = task(first.tasks[xi]);
  page = await open(browser, pDay, seed(pDay, [xTask.id]));
  await tap(page, 'notebook-first');
  await tap(page, `cell-${xi}`);
  await page.getByTestId('question').waitFor();
  await tap(page, `word-${Number(xTask.answer.split(':')[0])}`);
  await shot(page, 'extra-letter');
  await tap(page, 'back');
  // 5. тетрадь с прогрессом
  await shot(page, 'notebook');
  await tap(page, 'back');
  // 6. главная
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, 'home');
  await page.context().close();

  // 7. тёмная тема — пословица по частям
  const ki = first.tasks.findIndex(id => task(id).kind === 'parts');
  const kTask = task(first.tasks[ki]);
  page = await open(browser, pDay, seed(pDay, [kTask.id], true));
  await tap(page, 'notebook-first');
  await tap(page, `cell-${ki}`);
  await page.getByTestId('question').waitFor();
  await tap(page, `part-${Number(kTask.answer.split(',')[0])}`);
  await shot(page, 'parts-dark');
  await page.context().close();

  // 8. тайнопись — первая из первой тетради, несколько букв поставлено
  const ci = first.tasks.findIndex(id => task(id).kind === 'cipher');
  const cTask = task(first.tasks[ci]);
  page = await open(browser, pDay, seed(pDay, [cTask.id]));
  await tap(page, 'notebook-first');
  await tap(page, `cell-${ci}`);
  await page.getByTestId('question').waitFor();
  const key = cipherKey(cTask);
  for (const n of key.map((_, i) => i + 1).filter(n => !cTask.open!.includes(n)).slice(0, 3)) {
    await tap(page, `code-${cTask.code!.indexOf(n)}`);
    await tap(page, `key-${key[n - 1]}`);
  }
  await shot(page, 'cipher');
  await page.context().close();

  await renderGraphics(browser);
  if (weekday(eDay) !== 2) console.log(`внимание: конец пословицы ${eDay} — не среда`);
} finally {
  await browser.close();
  server.stop();
}
console.log(`store/screenshots/ru: ${n} снимков 1080 × 1920; store/graphics`);
