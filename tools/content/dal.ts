// Разбор текста Даля: вики-разметка раздела Викитеки → пословицы. Чистая функция, без сети.
// Исходник лежит в content/sources/dal-1862/<номер>.txt: первая строка — название раздела в
// Викитеке, дальше — разметка как её отдаёт `action=raw` (tools/content/fetch.ts).
//
// Правила (docs/09-content.md, «Как пословица попадает в игру»):
// - пословица — строка «: …»; в строке их бывает несколько, через точку, «!» или «?»;
// - варианты Даля «(или: …)» и пояснения в скобках «(т. е. …)» в текст игры не идут — они
//   остаются в заметке `note`, а текст игры — основное чтение без скобок;
// - знаки ударения убираются, ё остаётся как в источнике.

export interface Proverb {
  /** вечный: `dal.<раздел>.<строка>.<номер в строке>` */
  id: string;
  /** текст для игры — основное чтение, без скобок */
  text: string;
  /** строка Даля как в источнике, без разметки — для проверки человеком */
  original: string;
  /** что убрано из текста: варианты и пояснения Даля */
  note: string;
  /** раздел Даля, как его заголовок в тексте: «Счастье — удача» */
  section: string;
  /** раздел, как он назван в оглавлении Викитеки: «Счастье — Удача» — по нему выбирают разделы */
  title: string;
  /** латиницей, для идентификаторов: `schaste-udacha` */
  slug: string;
}

const LAT: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z', и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n',
  о: 'o', п: 'p', р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch', ъ: '', ы: 'y', ь: '',
  э: 'e', ю: 'yu', я: 'ya',
};

/** «Счастье — Удача» → «schaste-udacha». */
export function slugOf(title: string): string {
  return title
    .toLowerCase()
    .split('')
    .map(c => (c in LAT ? LAT[c] : /[a-z0-9]/.test(c) ? c : '-'))
    .join('')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Убрать вики-разметку строки: теги, ссылки, ударения, лишние пробелы. */
export function clean(line: string): string {
  return line
    .replace(/<ref[^>]*>.*?<\/ref>/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
    .replace(/'''?/g, '')
    .replace(/\{\{[^}]*\}\}/g, '')
    .replace(/́/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Основное чтение: без скобок с вариантами и пояснениями. Возвращает текст и что убрано. */
export function mainReading(line: string): { text: string; note: string } {
  const notes: string[] = [];
  let text = line;
  // вложенных скобок у Даля нет; на всякий случай — несколько проходов
  for (let i = 0; i < 3; i++) {
    text = text.replace(/\s*\(([^()]*)\)/g, (_, inner: string) => {
      notes.push(inner.trim());
      return '';
    });
  }
  text = text
    .replace(/\s+([,.!?;:])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  return { text, note: notes.join('; ') };
}

/** Строка Даля → отдельные пословицы: граница — «.», «!», «?» и пробел перед прописной. */
export function splitLine(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if ((c === '.' || c === '!' || c === '?') && text[i + 1] === ' ' && /[А-ЯЁ]/.test(text[i + 2] ?? '')) {
      // «т. е.» и сокращения внутри уже убраны со скобками; одиночная буква с точкой — не граница
      const before = text.slice(start, i).trim();
      if (/(^|\s)[а-яё]$/i.test(before)) continue;
      out.push(text.slice(start, i + 1).trim());
      start = i + 2;
    }
  }
  const rest = text.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/** Раздел Викитеки → пословицы. `title` — первая строка файла. */
export function parseSection(raw: string): Proverb[] {
  const lines = raw.split('\n');
  const title = (lines[0] ?? '').replace(/^.*\(Даль\)\//, '').trim();
  const head = lines.find(l => /^==\s*[^=]/.test(l));
  const section = head ? clean(head.replace(/=/g, '')) : title;
  const slug = slugOf(title);
  const out: Proverb[] = [];
  let row = 0;
  for (const l of lines.slice(1)) {
    if (!l.startsWith(':')) continue;
    row++;
    const original = clean(l.replace(/^:+\s*/, ''));
    if (!original) continue;
    const { text, note } = mainReading(original);
    splitLine(text).forEach((t, k) => {
      if (/[А-Яа-яЁё]/.test(t)) out.push({ id: `dal.${slug}.${row}.${k + 1}`, text: t, original, note, section, title, slug });
    });
  }
  return out;
}
