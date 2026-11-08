// Сценарий в браузере (06-testing.md, §5): веб-сборка, настоящие нажатия, снимки в tools/e2e/out/.
// Главная → задача дня → «Откуда это» и «Поделиться» → архив → первая тетрадь: по задаче каждого из
// пяти видов (с подсказкой, с ошибкой, подсмотренная) → закрытая тетрадь → настройки → об игре →
// перезагрузка: прогресс на месте. Ответы сценарий берёт из набора — экран должен показывать ту же
// задачу, что собрала сборка. Ошибка в консоли — провал.
//
//   EXPO_OFFLINE=1 npm run export:web && bun tools/e2e/browser.ts
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { PACK } from '../../src/content/generated/pack';
import { norm, type Task } from '../../src/engine';

const ROOT = join(import.meta.dir, '../..');
const DIST = join(ROOT, process.env.E2E_DIST ?? 'dist-web');
const OUT = join(import.meta.dir, 'out');
mkdirSync(OUT, { recursive: true });
const DAY1 = '2026-12-01';
const DAY3 = '2026-12-03';

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
const task = (id: string) => PACK.tasks.find(t => t.id === id)!;

/** Решить задачу на экране; `wrong` — сначала одна неверная попытка. */
async function solve(p: Page, t: Task, wrong = false) {
  if (t.kind === 'proverb' || t.kind === 'riddle') {
    const row = t.row!;
    const letters = t.answer.replace(/-/g, '').split('');
    const pick = (word: string[]) => {
      const taken = new Set<number>();
      return word.map(c => {
        const i = row.findIndex((x, k) => norm(x) === norm(c) && !taken.has(k));
        taken.add(i);
        return i;
      });
    };
    if (wrong) {
      // последняя буква — лишняя из ряда: поле встряхивается, буквы остаются; игрок убирает её сам
      const idx = pick(letters.slice(0, -1));
      const extra = row.findIndex((_, k) => !idx.includes(k) && norm(row[k]) !== norm(letters[letters.length - 1]));
      for (const i of [...idx, extra]) await tap(p, `tile-${i}`);
      await tap(p, `slot-${letters.length - 1}`);
    }
    for (const i of wrong ? pick(letters).slice(-1) : pick(letters)) await tap(p, `tile-${i}`);
  } else if (t.kind === 'old-word' || t.kind === 'ending') {
    const right = t.options!.findIndex(o => o === t.answer);
    if (wrong) await tap(p, `option-${(right + 1) % 4}`);
    await tap(p, `option-${right}`);
  } else if (t.kind === 'extra-letter') {
    const [w, pos] = t.answer.split(':').map(Number);
    if (wrong) {
      await tap(p, `word-${w}`);
      await tap(p, `letter-${pos === 0 ? 1 : 0}`);
    }
    await tap(p, `word-${w}`);
    await tap(p, `letter-${pos}`);
  } else {
    const order = t.answer.split(',').map(Number);
    if (wrong) for (const i of [...order].reverse()) await tap(p, `part-${i}`);
    for (const i of order) await tap(p, `part-${i}`);
  }
  await p.getByTestId('source').waitFor();
}

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
try {
  const ctx = await browser.newContext({ viewport: { width: 412, height: 915 }, permissions: ['clipboard-read', 'clipboard-write'] });
  const page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', e => errors.push(String(e)));

  // задача дня
  await page.goto(`http://localhost:${server.port}/?date=${DAY1}`);
  await page.getByTestId('daily').waitFor();
  await snap(page, 'home');
  const d1 = task(PACK.calendar.days[DAY1]);
  check((await page.getByTestId('daily').textContent())?.includes('1 декабря') === true, `главная: задача дня 1 декабря (${d1.kind})`);
  await tap(page, 'daily-solve');
  await page.getByTestId('question').waitFor();
  await snap(page, 'daily-task');
  await solve(page, d1, true);
  await snap(page, 'daily-source');
  check((await page.getByTestId('source').textContent())?.includes(d1.about.slice(0, 20)) === true, '«Откуда это»: полный текст, источник, строка о значении');
  await tap(page, 'share');
  const shared = await page.evaluate(() => navigator.clipboard.readText());
  check(shared.startsWith('Буквица · 1 декабря') && shared.includes('со второй попытки') && !shared.includes(d1.answer), '«Поделиться»: текст без условия и ответа, со второй попытки');
  await tap(page, 'home');
  check((await page.getByTestId('daily-result').textContent())?.includes('со второй попытки') === true, 'главная: задача дня решена');

  // архив
  await page.goto(`http://localhost:${server.port}/?date=${DAY3}`);
  await tap(page, 'archive');
  await page.getByTestId(`day-${DAY1}`).waitFor();
  check((await page.getByTestId(`day-${DAY1}`).textContent())?.includes('●') === true && (await page.getByTestId(`day-${DAY3}`).count()) === 0, 'архив: прошлые дни со значками, сегодняшнего и будущих нет');
  await snap(page, 'archive');
  await tap(page, 'back');

  // среда — конец пословицы (bukvitsa#6): подсказка «Открыть первое слово», ошибка, верный конец
  const WED = '2026-12-02';
  const dw = task(PACK.calendar.days[WED]);
  check(dw.kind === 'ending', `среда ${WED}: конец пословицы (${dw.kind})`);
  await page.goto(`http://localhost:${server.port}/?date=${WED}`);
  await tap(page, 'daily-solve');
  await page.getByTestId('question').waitFor();
  check((await page.getByTestId('question').textContent())?.endsWith('— …') === true, 'конец пословицы: начало и «— …»');
  await tap(page, 'hint-1');
  await tap(page, 'hint-2');
  check((await page.getByText(/Первое слово — «/).count()) === 1, 'конец пословицы: подсказка «Первое слово»');
  await snap(page, 'ending');
  const right = dw.options!.findIndex(o => o === dw.answer);
  await tap(page, `option-${right}`);
  await page.getByTestId('source').waitFor();
  check((await page.getByTestId('verdict').textContent()) === 'Верно', 'конец пословицы: решена');
  await tap(page, 'home');

  // первая тетрадь: по задаче каждого вида
  const first = PACK.notebooks.find(b => b.key === 'first')!;
  check((await page.getByTestId('notebook-labor').getAttribute('aria-disabled')) === 'true' && (await page.getByTestId('notebook-labor').textContent())?.includes('В следующих версиях') === true, 'тетради, кроме первой, — «В следующих версиях»');
  await tap(page, 'notebook-first');
  const kinds = ['proverb', 'riddle', 'extra-letter', 'parts', 'old-word'] as const;
  for (const kind of kinds) {
    const k = first.tasks.findIndex(id => task(id).kind === kind);
    await tap(page, `cell-${k}`);
    await page.getByTestId('question').or(page.getByTestId('option-0')).first().waitFor();
    if (kind === 'riddle') {
      // все три подсказки: задача подсмотрена
      for (const h of [1, 2, 3]) await tap(page, `hint-${h}`);
      check((await page.getByTestId('verdict').textContent()) === 'Подсмотрена', 'загадка: три подсказки — подсмотрена');
    } else {
      if (kind === 'proverb') await tap(page, 'hint-1');
      await solve(page, task(first.tasks[k]), kind === 'parts');
      check((await page.getByTestId('verdict').textContent()) === 'Верно', `${kind}: решена`);
    }
    if (kind === 'extra-letter') await snap(page, 'extra-letter');
    await tap(page, 'more');
    await tap(page, 'back');
  }
  await snap(page, 'notebook');
  check((await page.getByTestId('notebook-progress').textContent())?.includes('4 из') === true && (await page.getByTestId('notebook-progress').textContent())?.includes('1 подсмотрены') === true, 'тетрадь: 4 решены, 1 подсмотрена');
  await tap(page, 'back');

  await tap(page, 'settings');
  await tap(page, 'motion-on');
  await tap(page, 'back');
  await tap(page, 'about');
  check((await page.getByTestId('about-version').textContent())?.includes('0.') === true, '«Об игре»: версия');
  await snap(page, 'about');

  await page.goto(`http://localhost:${server.port}/?date=${DAY1}`);
  await page.getByTestId('daily-result').waitFor();
  check(true, 'после перезагрузки задача дня решена');

  if (errors.length) throw new Error(`ошибки в консоли:\n${errors.join('\n')}`);
  console.log('Сценарий пройден.');
} finally {
  await browser.close();
  server.stop();
}
