# Данные

Форматы — только здесь; движок, экраны и спецификации на них ссылаются. Кода ещё нет:
описан принятый проект.

## Движок

### Задача (из встроенного набора)

```ts
interface Task {
  id: string;            // 'proverb-0001' — вечный
  version: number;       // версия записи; прогресс ссылается на id, не на version
  kind: 'proverb' | 'riddle' | 'extra-letter' | 'old-word' | 'parts';
  prompt: string;        // условие как показывается: с пропуском «____», с лишней буквой, толкование
  answer: string;        // ответ в нижнем регистре, без знаков препинания (для parts — порядок частей '0,2,1,3')
  row?: string[];        // ряд букв — ответ + лишние, уже перемешан (proverb, riddle)
  options?: string[];    // четыре варианта, перемешаны (old-word)
  words?: string[];      // слова условия плашками (extra-letter); answer — 'слово:позиция'
  parts?: string[];      // части, перемешаны (parts)
  about: string;         // «Откуда это»: полный текст + строка о значении
  source: string;        // одна строка: «В. И. Даль. Пословицы русского народа. 1879, т. I, „Работа — Праздность“»
}
```

Ряд, варианты и части приходят **уже перемешанными** из сборки ([`09-content.md`](09-content.md),
§4): у движка нет случайности. Условие с лишней буквой и с пропуском тоже готовит сборка.

### Тетрадь и календарь

```ts
interface Notebook { key: string; title: string; blurb: string; free: boolean; tasks: string[] }
interface Calendar { from: string; days: Record<string, string> }  // 'ГГГГ-ММ-ДД' → id задачи
```

### Прогресс — список событий

```ts
type Event =
  | { t: 'solved';  id: string; day: string; tries: number; hints: 0 | 1 | 2 }
  | { t: 'peeked';  id: string; day: string }            // открыт ответ (подсказка 3)
  | { t: 'shared';  id: string; day: string }
  | { t: 'ad';      day: string; at: number }             // показан ролик между задачами (at — мс от начала суток)
  | { t: 'tens';    notebook: string; n: number; day: string }  // открыты ещё десять задач тетради
```

Из событий выводятся: решённые и подсмотренные задачи, «12 из 40», архив, счётчик
роликов и время последнего (правила рекламы), открытые десятки. Событие о задаче
повторяется, если игрок решил заново подсмотренную, — считается последнее.

`day` — дата по часам телефона, `ГГГГ-ММ-ДД`; `tries` — номер попытки, с которой
решено (1 — с первой).

### Что доступно игроку

```ts
interface Rights { plus: boolean; plusCheckedAt?: string }   // «Буквица+» и дата последней сверки с RuStore
engine.canOpen(task, notebook, rights, events): 'open' | 'plus' | 'tens'
engine.adAllowed(events, rights, now): boolean            // границы — 08-game-design.md, «Реклама»
engine.daily(calendar, today): Task | undefined
engine.archive(calendar, today): string[]                 // id прошлых задач дня
```

## Телефон

Один файл `bukvitsa.json` в папке документов приложения, запись атомарная (копия
хранилища «Вотчины»):

```ts
interface Save {
  schema: 1;                    // версия схемы; миграции — src/state/migrations.ts
  events: Event[];
  rights: Rights;
  settings: { sound: boolean; bigger: boolean; theme: 'auto' | 'light' | 'dark'; adsConsent?: 'yes' | 'no' };
  installedOn: string;          // первый запуск — для правила «не в первый день»
  counters: { solved: number; peeked: number; days: number };  // для «Об игре»; выводимы из events, хранятся для скорости
}
```

- **Миграции**: смена `schema` — шаг миграции и образец старого файла в
  `tools/test/fixtures/saves/` (ADR студии 0004). Забытая миграция стирает прогресс
  человека — тест не даёт поднять `schema` без образца.
- Файл входит в **автобэкап Android** (правила резервной копии плагином); размер —
  килобайты.
- **Удалить мои данные** в настройках — удаляет файл; «Буквица+» остаётся в RuStore.

## Сборка контента

Запись в `content/` — [`09-content.md`](09-content.md), §3. Сборка пишет
`src/content/generated/pack.ts` с `tasks: Task[]`, `notebooks: Notebook[]`, `calendar:
Calendar` и `released: Record<string, number>` (выпущенные версии записей, из
`content/released.json`).

## Сроки хранения

Ничего не хранится нигде, кроме телефона игрока и резервной копии его аккаунта Android.
Письма «Сообщить об ошибке» — в почте студии, год, затем удаляются (как во всех играх,
[`07-privacy.md`](https://github.com/Nefeste/gornitsa/blob/main/docs/07-privacy.md) устава).
Что хранит рекламная сеть — по её политике; срок и состав — в разделе игры в политике
конфиденциальности ([`10-money.md`](10-money.md), «152-ФЗ»).
