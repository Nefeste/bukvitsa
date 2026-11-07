// Все тексты интерфейса (устав, docs/05-rules.md: строки для игрока — только здесь и в content/).
// Экраны читают `T.раздел.ключ` в момент отрисовки. Тексты пословиц — из источника, не отсюда.
// В 0.x — только русский; английский — когда решим про выход за пределы России (docs/07-roadmap.md).
import { cleanCount, marksLine } from '../engine/day';
import type { Kind, Result } from '../engine/types';

const nb = ' ';

const plural = (n: number, one: string, few: string, many: string) => {
  const a = Math.abs(n) % 100,
    b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b === 1) return one;
  if (b >= 2 && b <= 4) return few;
  return many;
};

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «2026-11-12» → «12 ноября». */
export function humanDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d}${nb}${MONTHS[m - 1]}`;
}

/** Итог дня текстом — им делятся в мессенджере. Без ответов: строка кружков. */
export function shareText(date: string, results: readonly (Result | undefined)[]): string {
  return [`Буквица · ${humanDate(date)}`, `${marksLine(results)}  ${cleanCount(results)} из ${results.length} без подсказок`, 'gornitsa.games/bukvitsa'].join('\n');
}

const KIND: Record<Kind, { name: string; ask: string }> = {
  gap: { name: 'Пропущенное слово', ask: 'Соберите слово из букв' },
  ending: { name: 'Конец пословицы', ask: 'Как кончается пословица?' },
  parts: { name: 'Пословица по частям', ask: 'Сложите части по порядку' },
  extra: { name: 'Лишняя буква', ask: 'В каком слове лишняя буква?' },
};

export const T = {
  app: { name: 'Буквица', initial: 'Б', tagline: 'Пословицы Даля — по задаче в минуту' },
  home: {
    today: (date: string) => `Задачи дня · ${date}`,
    todayAbout: 'Пять задач, одни на всех',
    start: 'Решать',
    resume: 'Продолжить',
    done: 'Готово',
    share: 'Поделиться',
    notebooks: 'Тетради',
    notebooksAbout: 'Задачи по темам — сколько хочется',
    archive: 'Прошлые дни',
    settings: 'Настройки',
    about: 'Об игре',
  },
  kind: KIND,
  task: {
    of: (n: number, total: number) => `Задача ${n} из ${total}`,
    hint: 'Подсказка',
    show: 'Показать ответ',
    erase: 'Стереть',
    right: 'Верно',
    shown: 'Ответ',
    next: 'Дальше',
    finish: 'К итогу',
    back: 'Назад',
    from: (section: string) => `Даль, «Пословицы русского народа», раздел «${section}»`,
    note: (n: string) => `У Даля в скобках: ${n}`,
    hints: (n: number) => (n ? `подсказок: ${n}` : 'без подсказок'),
    mistakes: (n: number) => (n ? `${n}${nb}${plural(n, 'ошибка', 'ошибки', 'ошибок')}` : 'без ошибок'),
    tile: (c: string) => `Буква ${c}`,
    slot: (n: number, c: string | null) => (c ? `Место ${n}: ${c}, убрать` : `Место ${n}: пусто`),
  },
  day: {
    title: (date: string) => `Итог · ${date}`,
    clean: (n: number, total: number) => `${n} из ${total} — без подсказок и ошибок`,
    legend: 'Закрашен — сами, наполовину — с подсказкой или ошибкой, пустой — ответ открыт',
    share: 'Поделиться',
    home: 'В начало',
    tomorrow: 'Новые задачи — завтра. Прошлые дни ждут в архиве.',
  },
  archive: { title: 'Прошлые дни', today: 'сегодня', none: 'Пока не решали' },
  notebook: {
    title: 'Тетради',
    progress: (done: number, total: number) => `${done} из ${total}`,
    open: 'Открыть',
    complete: 'Тетрадь решена',
  },
  settings: {
    title: 'Настройки',
    motion: 'Меньше движения',
    motionAbout: 'Плитки и окна появляются сразу, без плавных переходов',
    system: 'Как в телефоне',
    on: 'Включено',
    off: 'Выключено',
  },
  about: {
    title: 'Об игре',
    version: (v: string, b: number) => `Версия ${v} (${b})`,
    source: (author: string, title: string, year: number) => `Пословицы — из книги: ${author}, «${title}», ${year}. Текст — по Викитеке.`,
    draft: (n: number) => `Задач на проверке человеком: ${n}. Нашли ошибку в пословице — напишите нам.`,
    studio: 'Игра студии «Горница» — gornitsa.games',
    support: 'support@gornitsa.games',
    noNet: 'Игра работает без интернета и ничего о вас не собирает.',
  },
};
