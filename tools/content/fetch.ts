// Скачать разделы «Пословиц русского народа» Даля из Викитеки в content/sources/dal-1862/.
// Нужен раз: скачанное лежит в репозитории, сборка работает без сети (docs/09-content.md).
// Запускать: `bun tools/content/fetch.ts` — только недостающие файлы, по одному в 4 секунды
// (правила Викимедиа для ботов: свой User-Agent и без спешки). `--list` — обновить список разделов.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '..', '..');
const DIR = join(ROOT, 'content', 'sources', 'dal-1862');
const LIST = join(DIR, 'sections.txt');
const UA = 'GornitsaBukvitsa/0.1 (https://gornitsa.games; content build)';
const BOOK = 'Пословицы русского народа (Даль)';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function get(url: string): Promise<string> {
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.ok) return await res.text();
    console.error(`${res.status} ${url} — повтор через ${20 * attempt} с`);
    await sleep(20000 * attempt);
  }
  throw new Error(`не скачалось: ${url}`);
}

async function list(): Promise<string[]> {
  const html = await get(`https://ru.wikisource.org/wiki/${encodeURIComponent(BOOK.replace(/ /g, '_'))}`);
  const seen = new Set<string>();
  for (const m of html.matchAll(/title="([^"]+)"/g)) {
    const t = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    if (t.startsWith(`${BOOK}/`)) seen.add(t);
  }
  return [...seen];
}

/**
 * Готовая страница → строки «: …», как у разделов с текстом: теги убраны, номера страниц скана и
 * числа месяца в начале строки («2. На Сильвестра…») — тоже, строки навигации и строки короче трёх слов
 * (заголовки) пропущены.
 */
export function fromRendered(html: string, section: string): string {
  const text = html
    .replace(/<span[^>]*class="[^"]*pagenum[^"]*"[^>]*>.*?<\/span>/g, '')
    .replace(/<(br|p|div|li|dd|dt)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');
  // заголовок — как у разделов с текстом; что строки собраны со страниц скана, видно по `sources.yaml`
  const out = [`== ${section} ==`];
  for (let l of text.split('\n')) {
    l = l.trim().replace(/^\[?\s*\d+\s*\]?$/, '').replace(/^\d+\.\s*/, '').trim();
    // строки навигации Викитеки («← …», «автор …», «Опубл.: …») — не текст Даля
    if (/[←→]|^автор |^Опубл\.|^Источник:/.test(l)) continue;
    if (l.split(/\s+/).length < 3 || !/[А-Яа-яЁё]/.test(l)) continue;
    out.push(`: ${l}`);
  }
  return out.join('\n') + '\n';
}

async function main() {
  mkdirSync(DIR, { recursive: true });
  if (process.argv.includes('--list') || !existsSync(LIST)) writeFileSync(LIST, (await list()).join('\n') + '\n');
  const titles = readFileSync(LIST, 'utf8').split('\n').filter(Boolean);
  for (let i = 0; i < titles.length; i++) {
    const file = join(DIR, `${String(i).padStart(3, '0')}.txt`);
    if (existsSync(file)) continue;
    const url = `https://ru.wikisource.org/w/index.php?title=${encodeURIComponent(titles[i].replace(/ /g, '_'))}&action=raw`;
    let raw = await get(url);
    // раздел, собранный из страниц скана (шаблон с `index=`), отдаёт разметку без строк «: …» —
    // тогда берётся готовая страница и переводится в те же строки (`fromRendered`)
    if (!/^:/m.test(raw) && /\|index=/.test(raw)) {
      await sleep(4000);
      raw = fromRendered(await get(url.replace('action=raw', 'action=render')), titles[i].replace(`${BOOK}/`, ''));
    }
    writeFileSync(file, `${titles[i]}\n${raw}`);
    console.log(`${i + 1}/${titles.length} ${titles[i]}`);
    await sleep(4000);
  }
}

if (import.meta.main) await main();
