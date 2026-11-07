// Сценарий в браузере (спецификация 1.0, критерий 1): веб-сборка, настоящие нажатия, сквозной путь
// «первый экран → пять задач дня → итог → прошлые дни → тетрадь → настройки → об игре», снимки
// ключевых экранов в tools/e2e/out/. Ошибка в консоли — провал. Ответы сценарий берёт из движка —
// так он проверяет, что экран показывает ту же задачу, что посчитал движок.
//
//   EXPO_OFFLINE=1 npm run export:web && bun tools/e2e/browser.ts
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { BUNDLE } from '../../src/content/generated/bundle';
import { dailyTasks, endingChoices, endingSplit, gapAnswer, gapTiles, partsInOrder, type Task } from '../../src/engine';

const ROOT = join(import.meta.dir, '../..');
const DIST = join(ROOT, process.env.E2E_DIST ?? 'dist-web');
const OUT = join(import.meta.dir, 'out');
mkdirSync(OUT, { recursive: true });
const DATE = '2026-12-01';

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const path = new URL(req.url).pathname;
    const file = Bun.file(join(DIST, path === '/' ? 'index.html' : path));
    return (await file.exists()) ? new Response(file) : new Response(Bun.file(join(DIST, 'index.html')));
  },
});

const errors: string[] = [];
let shot = 0;
const snap = async (p: Page, name: string) => p.screenshot({ path: join(OUT, `${String(++shot).padStart(2, '0')}-${name}.png`) });
const tap = async (p: Page, id: string) => p.getByTestId(id).click();
const check = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`не выполнено: ${what}`);
  console.log(`✓ ${what}`);
};

/** Решить задачу на экране. `mistake` — сначала ошибиться; `hint` — сначала взять подсказку. */
async function solve(p: Page, t: Task, opts: { mistake?: boolean; hint?: boolean } = {}) {
  if (opts.hint) await tap(p, 'hint');
  if (t.kind === 'gap') {
    const tiles = gapTiles(t);
    const answer = gapAnswer(t).replace(/-/g, '').toUpperCase();
    const taken = new Set<number>();
    // после подсказки первое место уже занято верной буквой
    const from = opts.hint ? 1 : 0;
    if (opts.hint) taken.add(tiles.findIndex(c => c === answer[0]));
    for (const c of answer.slice(from)) {
      const i = tiles.findIndex((x, k) => x === c && !taken.has(k));
      taken.add(i);
      await tap(p, `tile-${i}`);
    }
  } else if (t.kind === 'ending') {
    const choices = endingChoices(t);
    const right = choices.indexOf(endingSplit(t).tail);
    if (opts.mistake) await tap(p, `choice-${(right + 1) % 4}`);
    await tap(p, `choice-${right}`);
  } else if (t.kind === 'parts') {
    const parts = partsInOrder(t);
    for (let k = opts.hint ? 1 : 0; k < parts.length; k++) await tap(p, `part-${k}`);
  } else {
    if (opts.mistake) await tap(p, `word-${t.word === 0 ? 1 : 0}`);
    await tap(p, `word-${t.word}`);
  }
  await p.getByTestId('solved').waitFor();
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const page = await browser.newPage({ viewport: { width: 412, height: 915 } });
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(`http://localhost:${server.port}/?date=${DATE}`);
  await page.getByTestId('today').waitFor();
  await snap(page, 'home');
  check((await page.getByTestId('today-marks').textContent()) === '·····', 'первый экран: пять нерешённых задач дня');

  const ids = dailyTasks(BUNDLE.calendar, DATE);
  await tap(page, 'today-start');
  for (let n = 0; n < ids.length; n++) {
    const t = BUNDLE.tasks[ids[n]];
    await page.getByTestId('question').waitFor();
    if (n === 0) await snap(page, 'task-gap');
    const opts = t.kind === 'ending' ? { mistake: true } : n === 0 ? { hint: true } : {};
    await solve(page, t, opts);
    if (n === 0) await snap(page, 'task-solved');
    check((await page.getByTestId('source').textContent())?.includes(t.section) === true, `задача ${n + 1} (${t.kind}) решена, показан раздел Даля`);
    await tap(page, 'next');
  }
  await page.getByTestId('day-result').waitFor();
  await snap(page, 'day');
  const share = (await page.getByTestId('share-text').textContent()) ?? '';
  check(share.startsWith('Буквица · 1 декабря') && share.includes('gornitsa.games/bukvitsa'), 'итог дня: текст «Поделиться»');
  check(!/[А-Яа-я]{4,}/.test(share.split('\n')[1].replace('без подсказок', '').replace(/из/g, '')), 'в тексте «Поделиться» нет ответов');

  await tap(page, 'home');
  check((await page.getByTestId('today-marks').textContent())?.includes('·') === false, 'первый экран: день решён');
  await tap(page, 'archive');
  await page.getByTestId(`day-${DATE}`).waitFor();
  await snap(page, 'archive');
  await tap(page, 'back');

  await tap(page, 'notebooks');
  await page.getByTestId('notebook-winter').waitFor();
  await snap(page, 'notebooks');
  await tap(page, 'notebook-winter');
  await tap(page, 'notebook-open');
  const first = BUNDLE.tasks[BUNDLE.notebooks.find(b => b.id === 'winter')!.tasks[0]];
  await solve(page, first);
  await snap(page, 'notebook-task');
  await tap(page, 'next');
  await page.getByTestId('show').click();
  await page.getByTestId('solved').waitFor();
  check((await page.getByTestId('solved').textContent())?.includes('Ответ') === true, '«Показать ответ» решает задачу за игрока');
  await tap(page, 'back');
  check((await page.getByTestId('cell-0').textContent())?.includes('●') === true, 'тетрадь: решённая задача отмечена');
  await tap(page, 'back');
  await tap(page, 'back');

  await tap(page, 'settings');
  await tap(page, 'motion-on');
  await snap(page, 'settings');
  await tap(page, 'back');
  await tap(page, 'about');
  check((await page.getByTestId('about-version').textContent())?.includes('0.') === true, '«Об игре»: версия');
  await snap(page, 'about');

  // перезагрузка: итоги сохранились
  await page.reload();
  await page.getByTestId('today').waitFor();
  check((await page.getByTestId('today-marks').textContent())?.includes('·') === false, 'после перезагрузки день решён');

  if (errors.length) throw new Error(`ошибки в консоли:\n${errors.join('\n')}`);
  console.log('Сценарий пройден.');
} finally {
  await browser.close();
  server.stop();
}
