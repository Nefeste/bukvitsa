# Данные

## Содержание (`content/`)

| Файл | Что | Кто пишет |
|---|---|---|
| `sources.yaml` | источник: автор, издание, год, ссылка, основание | человек |
| `sources/dal-1862/NNN.txt` | раздел Даля: первая строка — название в Викитеке, дальше — разметка | `tools/content/fetch.ts` |
| `sections.yaml` | какие разделы берём (`take`) | человек |
| `banned.yaml` | запретные основы слов (`stems`; «=» — слово целиком) | человек |
| `notebooks.yaml` | тетради: id, название, о чём, разделы, основы слов, размер | человек |
| `calendar.yaml` | начало, размер, зимнее окно, дни (`days`) | заголовок — человек, дни — `pick.ts` |
| `tasks/*.yaml` | записи задач | `pick.ts`, правит человек |

Запись задачи:

```yaml
- id: d.1                    # вечный: d.<n> — задачи дня, t.<тетрадь>.<n> — тетради
  kind: gap                  # gap | ending | parts | extra
  level: 1                   # 1–3
  proverb: dal.pischa.12.1   # пословица в источнике
  word: 4                    # gap, extra: номер слова (с нуля)
  cut: 3                     # ending: с какого слова конец
  wrong: [dal.x.3.1@2, …]    # ending: три чужих конца — «пословица@с какого слова»
  starts: [0, 3, 8]          # parts: с каких слов начинаются части
  at: 2                      # extra: куда вставлена буква
  letter: о                  # extra: какая
  review: draft              # draft | checked — checked ставит человек
```

## Сборка (`src/content/generated/bundle.ts`)

`Bundle`: `tasks` (задача с текстом пословицы, разделом и разрешёнными чужими концами), `notebooks` (порядок задач),
`calendar` (`from`, `days`), `source` (для «Об игре»), `draft` (сколько задач ещё не проверено).

## На телефоне

| Ключ AsyncStorage | Что |
|---|---|
| `bukvitsa.results.v1` | итоги задач: `{ id: { done, hints, mistakes, shown } }` |
| `bukvitsa.settings.v1` | настройки: `{ lessMotion? }` |

Номер в ключе — версия формата; сменился формат — новый ключ и перенос старого в том же PR.
