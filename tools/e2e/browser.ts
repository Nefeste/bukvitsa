// Сценарий в браузере (06-testing.md, §5): веб-сборка, настоящие нажатия, снимки в tools/e2e/out/.
// Главная → задача дня → «Откуда это» и «Поделиться» → архив → первая тетрадь: по задаче каждого из
// пяти видов (с подсказкой, с ошибкой, подсмотренная) → закрытая тетрадь → настройки (тёмная тема, «ещё
// крупнее») → об игре → перезагрузка: прогресс и настройки на месте → «Удалить мои данные». Ответы сценарий
// берёт из набора — экран должен показывать ту же задачу, что собрала сборка. Ошибка в консоли — провал; страницы
// отдаются с правилами безопасности сайта (CSP), так что их нарушение — тоже провал.
//
//   EXPO_OFFLINE=1 npm run export:web && bun tools/e2e/browser.ts
//   BUKVITSA_WEB_BASE=/bukvitsa/test EXPO_OFFLINE=1 npx expo export -p web --output-dir dist-site
//   E2E_DIST=dist-site E2E_BASE=/bukvitsa/test bun tools/e2e/browser.ts     — сборка для сайта (site.yml)
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Page } from 'playwright';
import { PACK } from '../../src/content/generated/pack';
import { ALPHABET, cipherKey, norm, type Task } from '../../src/engine';

const ROOT = join(import.meta.dir, '../..');
const DIST = join(ROOT, process.env.E2E_DIST ?? 'dist-web');
const OUT = join(import.meta.dir, 'out');
mkdirSync(OUT, { recursive: true });
const DAY1 = '2026-12-01';
const DAY3 = '2026-12-03';

// Сборка для сайта (`/bukvitsa/test`, site.yml) отдаётся из той же папки под этим адресом. Правила безопасности —
// те же, что ставит nginx сайта (deploy/bukvitsa/nginx.sh в Nefeste/gornitsagames): меняете там — поменяйте здесь.
const BASE = (process.env.E2E_BASE ?? '').replace(/\/+$/, '');
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (BASE) {
      if (path === BASE) path = `${BASE}/`;
      // значок браузер просит у корня домена — на сайте он есть у самого сайта
      if (path === '/favicon.ico') return new Response(null, { status: 204 });
      if (!path.startsWith(`${BASE}/`)) return new Response('not found', { status: 404 });
      path = path.slice(BASE.length);
    }
    const file = Bun.file(join(DIST, path === '/' ? 'index.html' : path));
    const body = (await file.exists()) ? file : Bun.file(join(DIST, 'index.html'));
    return new Response(body, { headers: { 'content-security-policy': CSP } });
  },
});
const ROOT_URL = () => `http://localhost:${server.port}${BASE}/`;

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
  await page.goto(`${ROOT_URL()}?date=${DAY1}`);
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
  check(shared.startsWith('Складно · 1 декабря') && shared.includes('со второй попытки') && !shared.includes(d1.answer), '«Поделиться»: текст без условия и ответа, со второй попытки');
  // «Сообщить об ошибке» из «Откуда это»: в отчёте — номер задачи и версия записи, текст игрока первым; «Назад» — к задаче
  await tap(page, 'report-task');
  await page.getByTestId('report-what').fill('опечатка в задаче');
  const report = (await page.getByTestId('report-text').textContent()) ?? '';
  check(report.startsWith('Что не такопечатка в задаче') || report.startsWith('Что не так\nопечатка в задаче'), 'отчёт: текст игрока первым');
  check(report.includes(`Задача: ${d1.id} (${d1.version})`) && report.includes('Версия: 0.') && report.includes('сбоев не было'), 'отчёт: задача с версией записи, версия игры, журнал сбоев пуст');
  await snap(page, 'report');
  await tap(page, 'report-send');
  check((await page.evaluate(() => navigator.clipboard.readText())).includes(`Задача: ${d1.id}`), 'отчёт в браузере — в буфер обмена целиком');
  await tap(page, 'back');
  await page.getByTestId('source').waitFor();
  await tap(page, 'home');
  check((await page.getByTestId('daily-result').textContent())?.includes('со второй попытки') === true, 'главная: задача дня решена');

  // архив
  await page.goto(`${ROOT_URL()}?date=${DAY3}`);
  await tap(page, 'archive');
  await page.getByTestId(`day-${DAY1}`).waitFor();
  check((await page.getByTestId(`day-${DAY1}`).textContent())?.includes('●') === true && (await page.getByTestId(`day-${DAY3}`).count()) === 0, 'архив: прошлые дни со значками, сегодняшнего и будущих нет');
  await snap(page, 'archive');
  await tap(page, 'back');

  // среда — конец пословицы (bukvitsa#6): подсказка «Открыть первое слово», ошибка, верный конец
  const WED = '2026-12-02';
  const dw = task(PACK.calendar.days[WED]);
  check(dw.kind === 'ending', `среда ${WED}: конец пословицы (${dw.kind})`);
  await page.goto(`${ROOT_URL()}?date=${WED}`);
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
  check((await page.getByTestId('verdict').textContent())?.startsWith('Верно') === true, 'конец пословицы: решена');
  await tap(page, 'home');

  // первая тетрадь: по задаче каждого вида
  const first = PACK.notebooks.find(b => b.key === 'first')!;
  // «Продолжить» с нуля ведёт в первую тетрадь, к первой задаче
  check((await page.getByTestId('resume-at').textContent())?.startsWith('Первая тетрадь · задача 1 из') === true, 'главная: «Продолжить» — первая задача первой тетради');
  await tap(page, 'notebook-first');
  const kinds = ['proverb', 'riddle', 'extra-letter', 'parts', 'ending', 'cipher'] as const;
  for (const kind of kinds) {
    const k = first.tasks.findIndex(id => task(id).kind === kind);
    await tap(page, `cell-${k}`);
    await page.getByTestId('question').or(page.getByTestId('option-0')).first().waitFor();
    if (kind === 'cipher') {
      // тайнопись (specs/2026-11-cipher.md): на первое число — неверная буква, остальные верно; поле полно, но не
      // решено; «Убрать неверные» снимает её, «Открыть букву» ставит верную — решена
      const t = task(first.tasks[k]);
      const code = t.code!;
      const key = cipherKey(t);
      const free = key.map((_, i) => i + 1).filter(n => !t.open!.includes(n));
      const wrongLetter = ALPHABET.split('').find(c => !key.includes(c))!;
      for (const [j, n] of free.entries()) {
        await tap(page, `code-${code.indexOf(n)}`);
        await tap(page, `key-${j === 0 ? wrongLetter : key[n - 1]}`);
      }
      check((await page.getByTestId('verdict').count()) === 0, 'тайнопись: поле полно с неверной буквой — не решена');
      await snap(page, 'cipher');
      await tap(page, 'hint-1');
      check((await page.getByTestId(`code-${code.indexOf(free[0])}`).getAttribute('aria-label'))?.endsWith('пусто') === true, 'тайнопись: «Убрать неверные» сняла неверную букву');
      await tap(page, 'hint-2');
      check((await page.getByTestId('verdict').textContent())?.startsWith('Верно') === true, 'тайнопись: «Открыть букву» дописала последнюю — решена');
    } else if (kind === 'riddle') {
      // все три подсказки: задача подсмотрена
      for (const h of [1, 2, 3]) await tap(page, `hint-${h}`);
      check((await page.getByTestId('verdict').textContent()) === 'Подсмотрена', 'загадка: три подсказки — подсмотрена');
    } else {
      if (kind === 'proverb') await tap(page, 'hint-1');
      await solve(page, task(first.tasks[k]), kind === 'parts');
      check((await page.getByTestId('verdict').textContent())?.startsWith('Верно') === true, `${kind}: решена`);
    }
    if (kind === 'extra-letter') await snap(page, 'extra-letter');
    await tap(page, 'more');
    await tap(page, 'back');
  }
  await snap(page, 'notebook');
  check((await page.getByTestId('notebook-progress').textContent())?.includes('5 из') === true && (await page.getByTestId('notebook-progress').textContent())?.includes('1 подсмотрена') === true, 'тетрадь: 5 решены, 1 подсмотрена');
  check((await page.getByTestId('notebook-progress').textContent())?.includes('начисто') === true && (await page.getByText('★', { exact: true }).count()) > 0, 'тетрадь: решённые начисто отмечены звёздочкой и сосчитаны');
  await tap(page, 'back');
  // сборник: всё решённое (две задачи дня и пять задач тетради), звание впереди; «Продолжить» — следующая нерешённая
  check((await page.getByTestId('collection-count').textContent())?.startsWith('Решено 7 из') === true, 'главная: в сборнике семь решённых');
  await tap(page, 'collection');
  check((await page.getByTestId('rank-name').textContent()) === 'Звания пока нет' && (await page.getByTestId('rank-next').textContent())?.includes('«Ученик» — ещё 3') === true, 'сборник: до звания «Ученик» — ещё три задачи');
  check((await page.getByTestId('collection-item').count()) === 7, 'сборник: семь решённых пословиц и загадок списком');
  await snap(page, 'collection');
  await tap(page, 'back');
  await tap(page, 'resume-go');
  await page.getByTestId('question').or(page.getByTestId('option-0')).first().waitFor();
  check(true, '«Продолжить» открывает следующую нерешённую задачу тетради');
  await tap(page, 'back');
  await tap(page, 'back');

  // деньги (specs/2026-10-money.md): ролик по желанию открывает десять задач закрытой тетради; перед первым
  // роликом — экран согласия; межстраничный — только между задачами тетради, со второго дня, если пора
  const labor = PACK.notebooks.find(b => b.key === 'mind')!;
  const ads = () => page.evaluate(() => (globalThis as unknown as { __bukvitsaAds?: { shown: string[]; personal: boolean | null } }).__bukvitsaAds ?? { shown: [], personal: null });
  await tap(page, 'notebook-mind');
  check((await page.getByTestId('cell-4').getAttribute('aria-disabled')) !== 'true' && (await page.getByTestId('cell-5').getAttribute('aria-disabled')) === 'true' && (await page.getByTestId('open-plus').count()) === 1, 'платная тетрадь: первые пять задач открыты, шестая закрыта, «Открыть в „Складно+“»');
  await tap(page, 'tens');
  await page.getByTestId('consent').waitFor();
  await snap(page, 'consent');
  await tap(page, 'consent-no');
  await tap(page, 'tens');
  await page.getByTestId('notebook-opened').filter({ hasText: 'Открыто 15' }).waitFor();
  check((await page.getByTestId('cell-14').getAttribute('aria-disabled')) !== 'true' && (await page.getByTestId('cell-15').getAttribute('aria-disabled')) === 'true', 'ролик досмотрен: открыты задачи 1–15, шестнадцатая закрыта');
  check((await ads()).shown.includes('rewarded') && (await ads()).personal === false, 'ролик по желанию показан; реклама — обычная, по ответу на экране согласия');
  await snap(page, 'notebook-tens');
  // межстраничный: решено двенадцать задач тетрадей, второй день, три задачи с прошлого ролика
  await page.evaluate(() => {
    const k = 'bukvitsa.money.v1';
    const m = JSON.parse(localStorage.getItem(k) ?? '{}');
    m.counters = { installDay: '2026-12-01', solved: 12, sinceAd: 2, lastAdAt: 0 };
    localStorage.setItem(k, JSON.stringify(m));
  });
  await page.goto(`${ROOT_URL()}?date=${DAY3}`);
  await tap(page, 'notebook-mind');
  // задача из открытых, которой нет в первой тетради (образец proverb-0001 стоит в двух тетрадях — он уже решён)
  const li = labor.tasks.findIndex((id, i) => i < 10 && !first.tasks.includes(id));
  await tap(page, `cell-${li}`);
  await page.getByTestId('question').or(page.getByTestId('option-0')).first().waitFor();
  await solve(page, task(labor.tasks[li]));
  await tap(page, 'more');
  await page.getByTestId('ad-note').waitFor();
  await snap(page, 'ad-note');
  await page.getByTestId('question').or(page.getByTestId('option-0')).first().waitFor();
  check((await ads()).shown.filter(x => x === 'interstitial').length === 1, 'межстраничный: после «Ещё», с экраном «Реклама», и сразу следующая задача');
  await tap(page, 'back');
  await tap(page, 'back');
  // «Буквица+»: покупка в тестовом магазине — рекламы нет, все тетради открыты
  await tap(page, 'plus-home');
  await page.getByTestId('plus-price').filter({ hasText: '249' }).waitFor();
  check((await page.getByTestId('plus-books').textContent())?.includes('тетрадях за «Складно+»: 4') === true, '«Складно+»: сказано, сколько тетрадей и задач открывает покупка');
  await snap(page, 'plus');
  await tap(page, 'plus-buy');
  await page.getByTestId('plus-thanks').waitFor();
  await tap(page, 'back');
  await tap(page, 'notebook-mind');
  check((await page.getByTestId(`cell-${labor.tasks.length - 1}`).getAttribute('aria-disabled')) !== 'true' && (await page.getByTestId('tens').count()) === 0, '«Буквица+»: вся тетрадь открыта, ролика нет');
  await tap(page, 'back');

  await tap(page, 'settings');
  await tap(page, 'motion-on');
  await tap(page, 'report');
  check((await page.getByTestId('report-text').textContent())?.includes('Экран: settings') === true, 'отчёт из настроек: без задачи, экран — настройки');
  await tap(page, 'back');
  await tap(page, 'theme-dark');
  await tap(page, 'bigger-on');
  await snap(page, 'settings-dark');
  await tap(page, 'back');
  await snap(page, 'home-dark');
  await tap(page, 'about');
  const version = page.getByTestId('about-version');
  check((await version.textContent())?.includes('0.') === true, '«Об игре»: версия');
  const look = () => version.evaluate(e => [getComputedStyle(e).color, getComputedStyle(e).fontSize]);
  check(JSON.stringify(await look()) === JSON.stringify(['rgb(233, 232, 224)', '21px']), 'тёмная тема и «ещё крупнее»: светлые чернила, текст 17 → 21 px');
  await snap(page, 'about');

  await page.goto(`${ROOT_URL()}?date=${DAY1}`);
  await page.getByTestId('daily-result').waitFor();
  check(true, 'после перезагрузки задача дня решена');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('bukvitsa.save') ?? 'null'));
  check(saved?.schema === 1 && saved.events.some((e: { t: string }) => e.t === 'shared') && saved.settings.theme === 'dark', 'сохранение — схема 1: события с «Поделиться», настройки');
  await tap(page, 'about');
  check(JSON.stringify(await look()) === JSON.stringify(['rgb(233, 232, 224)', '21px']), 'тема и размер пережили перезагрузку');
  await tap(page, 'back');

  // «Удалить мои данные» — с подтверждением на экране; после — задача дня снова не решена
  await tap(page, 'settings');
  await tap(page, 'wipe');
  await tap(page, 'wipe-no');
  await tap(page, 'wipe');
  await tap(page, 'wipe-yes');
  await tap(page, 'theme-system');
  await tap(page, 'back');
  await page.getByTestId('daily-solve').waitFor();
  check((await page.getByTestId('daily-result').count()) === 0, '«Удалить мои данные»: прогресс с нуля');

  // Маленький телефон 360 × 640 и «ещё крупнее» (specs/2026-10-screens.md, «Неудачные случаи»): самые длинные ряд букв,
  // части и варианты из календаря — без прокрутки вбок, всё видно в ширину экрана.
  const narrow = await browser.newContext({ viewport: { width: 360, height: 640 } });
  await narrow.addInitScript(() => {
    localStorage.setItem('bukvitsa.save', JSON.stringify({ schema: 1, events: [], settings: { bigger: true, adsConsent: 'no' }, installedOn: '2026-12-01', counters: { solved: 0, peeked: 0, days: 0 } }));
  });
  const small = await narrow.newPage();
  small.on('pageerror', e => errors.push(String(e)));
  const longest = (score: (t: Task) => number) =>
    Object.entries(PACK.calendar.days).sort(([, a], [, b]) => score(task(b)) - score(task(a)))[0];
  const cases: [string, (t: Task) => number][] = [
    ['ряд букв', t => t.row?.length ?? 0],
    ['части', t => (t.parts ? t.parts.join('').length : 0)],
    ['варианты', t => (t.options ? Math.max(...t.options.map(o => o.length)) : 0)],
    ['тайнопись', t => (t.kind === 'cipher' ? t.code!.length : 0)],
  ];
  for (const [what, score] of cases) {
    const [date, id] = longest(score);
    await small.goto(`${ROOT_URL()}?date=${date}`);
    await small.getByTestId('daily-solve').click();
    await small.getByTestId('question').waitFor();
    const fits = await small.evaluate(() => {
      const wide = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
      const out = [...document.querySelectorAll('[data-testid^="tile-"],[data-testid^="part-"],[data-testid^="option-"],[data-testid^="code-"],[data-testid^="key-"]')].filter(e => {
        const r = e.getBoundingClientRect();
        return r.left < 0 || r.right > window.innerWidth + 0.5;
      }).length;
      return { wide, out };
    });
    await small.screenshot({ path: join(OUT, `${String(++shot).padStart(2, '0')}-narrow-${task(id).kind}.png`) });
    check(fits.wide <= 360 && fits.out === 0, `360 × 640, «ещё крупнее»: ${what} (${id}) — в ширину экрана`);
  }
  await narrow.close();

  // Тайнопись обычным размером на 360 × 640: самая длинная пословица календаря целиком над клавиатурой, без
  // прокрутки; при «ещё крупнее» она прокручивается над неподвижной клавиатурой (specs/2026-11-cipher.md)
  const plain = await browser.newContext({ viewport: { width: 360, height: 640 } });
  const pl = await plain.newPage();
  const [cDate, cId] = longest(t => (t.kind === 'cipher' ? t.code!.length : 0));
  await pl.goto(`${ROOT_URL()}?date=${cDate}`);
  await pl.getByTestId('daily-solve').click();
  await pl.getByTestId('question').waitFor();
  const q = (await pl.getByTestId('question').boundingBox())!;
  const keyA = (await pl.getByTestId('key-А').boundingBox())!;
  const keyZ = (await pl.getByTestId('key-Я').boundingBox())!;
  check(q.y + q.height <= keyA.y && keyZ.y + keyZ.height <= 640 && keyA.width >= 36, `360 × 640: тайнопись (${cId}, ${task(cId).code!.length} букв) над клавиатурой, клавиши ${Math.round(keyA.width)} × ${Math.round(keyA.height)}`);
  await pl.screenshot({ path: join(OUT, `${String(++shot).padStart(2, '0')}-narrow-cipher-plain.png`) });
  await plain.close();

  if (errors.length) throw new Error(`ошибки в консоли:\n${errors.join('\n')}`);
  console.log('Сценарий пройден.');
} finally {
  await browser.close();
  server.stop();
}
