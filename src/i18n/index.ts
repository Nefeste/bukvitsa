// Все тексты интерфейса (устав, docs/05-rules.md: строки для игрока — только здесь и в content/).
// Только русский (ADR 0006). Экраны читают `T.раздел.ключ` в момент отрисовки.
import type { Kind, Result } from '../engine/types';

const nb = ' ';

const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTH_NAMES = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];

/** «2026-11-12» → «12 ноября». */
export function humanDate(date: string): string {
  const [, m, d] = date.split('-').map(Number);
  return `${d}${nb}${MONTHS[m - 1]}`;
}

/** «2026-11» → «Ноябрь 2026». */
export function monthName(ym: string): string {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

const KIND: Record<Kind, { name: string; lower: string; ask: string }> = {
  proverb: { name: 'Пословица', lower: 'пословица', ask: 'Какого слова не хватает?' },
  riddle: { name: 'Загадка', lower: 'загадка', ask: 'Отгадайте' },
  'extra-letter': { name: 'Лишняя буква', lower: 'лишняя буква', ask: 'В одном слове лишняя буква. Нажмите на слово, потом на букву' },
  'old-word': { name: 'Старое слово', lower: 'старое слово', ask: 'Какое слово так толкует Даль?' },
  parts: { name: 'По частям', lower: 'по частям', ask: 'Расставьте части по порядку' },
  ending: { name: 'Конец пословицы', lower: 'конец пословицы', ask: 'Чем кончается пословица?' },
};

const ORDINAL = ['первой', 'второй', 'третьей', 'четвёртой', 'пятой'];

/** Как решена задача — одной строкой (08-game-design.md, «Задача дня»). */
export function howSolved(r: Result): string {
  if (r.peeked) return 'Подсмотрена';
  if (r.hints > 0) return 'Решена с подсказкой';
  if (r.tries <= 1) return 'Решена с первой попытки, без подсказок ✓';
  const n = ORDINAL[r.tries - 1] ?? `${r.tries}-й`;
  return `Решена ${r.tries === 2 ? 'со' : 'с'} ${n} попытки`;
}

/** Текст «Поделиться» без условия и ответа — чтобы не портить день другу. */
export function shareText(date: string, kind: Kind, r: Result): string {
  return [`Буквица · ${humanDate(date)} · ${KIND[kind].lower}`, howSolved(r), 'gornitsa.games/bukvitsa'].join('\n');
}

export const T = {
  app: { name: 'Буквица', initial: 'Б', tagline: 'Пословицы, загадки и старые слова по Далю' },
  home: {
    daily: (date: string, kind: Kind) => `Задача дня · ${humanDate(date)} · ${KIND[kind].lower}`,
    solve: 'Решать',
    share: 'Поделиться',
    copied: 'Скопировано',
    beyond: 'Новые задачи дня — в новой версии игры',
    notebooks: 'Тетради',
    progress: (done: number, total: number, peeked: number) => `${done} из ${total}${peeked ? ` · ${peeked} подсмотрены` : ''}`,
    later: 'В следующих версиях',
    archive: 'Архив',
    settings: 'Настройки',
    about: 'Об игре',
  },
  kind: KIND,
  task: {
    back: 'Назад',
    hint: { 1: 'Убрать лишние', 2: 'Открыть букву', 3: 'Показать ответ' } as Record<number, string>,
    hintPart: 'Открыть часть',
    hintWord: 'Подсветить слово',
    first: (c: string) => `Начинается на «${c}»`,
    firstWord: (w: string) => `Первое слово — «${w}»`,
    hintFirstWord: 'Открыть первое слово',
    right: 'Верно',
    peeked: 'Подсмотрена',
    from: 'Откуда это',
    more: 'Ещё',
    home: 'На главную',
    tile: (c: string) => `Буква ${c}`,
    slot: (n: number, c: string | null) => (c ? `Место ${n}: ${c}, убрать` : `Место ${n}: пусто`),
    word: (w: string) => `Слово «${w}»`,
    letter: (c: string) => `Буква ${c}`,
  },
  archive: { title: 'Архив', none: 'Прошлых задач дня пока нет — архив начнётся завтра', solved: 'решена', peeked: 'подсмотрена', open: 'не решена' },
  notebook: { done: 'Решена', solved: 'решена', peeked: 'подсмотрена', open: 'не тронута', item: (n: number) => `Задача ${n}` },
  money: {
    plus: '«Буквица+»',
    plusHome: '«Буквица+» — без рекламы и все тетради',
    thanks: 'Спасибо! «Буквица+» у вас: рекламы нет, все тетради открыты',
    what: ['Все тетради — сейчас и те, что выйдут потом', 'Без рекламы — совсем', 'Подсказки и задача дня — бесплатны всем, как и прежде'],
    price: (p: string | null) => (p ? `${p} — один раз, не подписка` : 'Один раз, не подписка'),
    buy: 'Купить',
    restore: 'Восстановить покупки',
    restored: 'Покупки сверены с RuStore',
    test: 'Тестовый магазин: настоящей оплаты нет',
    why: {
      'other-build': 'Покупки есть только в версии из RuStore',
      'not-ready': 'Покупки подключаются — скоро будут',
      'no-rustore': 'Для покупки нужен RuStore',
      'not-signed-in': 'Войдите в RuStore, чтобы купить',
      error: 'RuStore не ответил. Попробуйте позже',
    } as Record<string, string>,
    openRuStore: 'Открыть RuStore',
    failed: 'Оплата не прошла',
    cancelled: 'Покупка отменена',
    locked: 'Закрыта',
    openPlus: 'Открыть в «Буквице+»',
    tens: (n: number) => `${n} задач за ролик`,
    needNet: 'Нужен интернет',
    opened: (n: number, total: number) => `Открыто ${n} из ${total}`,
    ad: 'Реклама',
    adNote: '«Буквица+» убирает её навсегда',
    consentTitle: 'Реклама помогает игре быть бесплатной',
    consentAsk: 'Показывать персональную рекламу? Её подбирают по интересам. Обычной рекламы не меньше и не больше.',
    consentYes: 'Персональную',
    consentNo: 'Только обычную',
    consentLater: 'Ответ можно поменять в настройках.',
    privacy: 'Политика конфиденциальности',
  },
  settings: {
    title: 'Настройки',
    ads: 'Персональная реклама',
    adsAbout: 'Подбирать рекламу по интересам. Обычной рекламы не меньше и не больше',
    motion: 'Меньше движения',
    motionAbout: 'Без встряхивания и плавных переходов',
    system: 'Как в телефоне',
    on: 'Включено',
    off: 'Выключено',
  },
  about: {
    title: 'Об игре',
    version: (v: string, b: number) => `Версия ${v} (${b})`,
    sources:
      'Тексты — из книг общественного достояния: В. И. Даль, «Пословицы русского народа» (1862, 2-е изд. 1879) и «Толковый словарь живого великорусского языка» (2-е изд., 1880–1882). Текст — по Викитеке.',
    draft: (n: number) => `Задач, ещё не сверенных со сканом: ${n}. Нашли ошибку — напишите нам.`,
    studio: 'Игра студии «Горница» — gornitsa.games',
    support: 'support@gornitsa.games',
    fonts: 'Шрифты Kurale и Onest — SIL Open Font License',
    noNet: 'Игра работает без интернета и ничего о вас не собирает.',
  },
};
