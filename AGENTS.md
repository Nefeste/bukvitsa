This is an Expo/React Native mobile game («Буквица», Bukvitsa) for RuStore: word puzzles made of Russian
proverbs from Vladimir Dal's «Пословицы русского народа» (1862) — a missing word assembled from letter tiles,
the ending chosen from four, a proverb put back together from parts, a word with an extra letter. Five daily
puzzles, the same for everyone, plus themed notebooks. Prioritize calm, honest UX, one-handed play, and the
correctness of every text against its source.

## Studio charter — read first

This project belongs to the «Горница» studio. Studio-wide rules live only in the public
charter repository `Nefeste/gornitsa` (https://github.com/Nefeste/gornitsa); this repository
keeps only what is specific to the project. Before changing anything — and after a context
reset — read the charter's `AGENTS.md`, then `docs/05-rules.md` (hard rules for every game)
and `docs/04-process.md` (how work is done). Raw files:
`https://raw.githubusercontent.com/Nefeste/gornitsa/main/<path>`.

Current state of this project: `STATUS.md` (it is not repeated here).

Precedence: the owner's recorded decision → the charter → this project's documents. A project
rule may narrow a charter rule, never weaken it. If a document here restates or contradicts
the charter, replace it with a link or report the contradiction to the owner.

## Read `docs/` before changing anything

The project documents itself in [`docs/`](docs/README.md), in Russian. Start there:

- `docs/specs/2026-11-v1.md` — the live specification: the path to 1.0, criteria, agent's decisions, check log.
- `docs/08-game-design.md` — the game as it ships in 1.0; **all game-design numbers live only there**.
- `docs/09-content.md` — the source, how a proverb becomes a puzzle, what is never taken. Read before touching `content/`.
- `docs/01-product.md`, `docs/02-architecture.md`, `docs/04-data-model.md`, `docs/05-process.md`, `docs/06-testing.md`,
  `docs/10-money.md`, `docs/11-market.md`, `docs/13-art.md` (style sheet), `docs/adr/`.

## Hard rules

Studio-wide rules — no React Native `Alert`, player-facing strings only in `src/i18n/` and `content/`, generated
`ios/`/`android/`, a permanent application id and signing key, a pure engine, no pressure, content only from named
sources — are in the charter's `docs/05-rules.md`. This project's own rules:

- **Every proverb comes from the downloaded source** (`content/sources/dal-1862/`), resolved by id at build time.
  Never type a proverb, riddle or definition by hand or from memory. No text at hand → no puzzle of that kind.
- **Puzzle records are generated, then reviewed:** `tools/content/pick.ts` writes `content/tasks/*.yaml` with
  `review: draft`; only a human sets `checked`. Ids (`d.<n>`, `t.<notebook>.<n>`) and released calendar days are
  eternal — append, never renumber or reorder.
- **What is never taken** — sections in `content/sections.yaml` (`take` only) and stems in `content/banned.yaml`:
  faith and church, peoples, violence, drinking, death, women-and-marriage sections. Do not widen without the owner.
- **The engine is pure** (`src/engine/`): no React, no `Date`, no `Math.random`; the date is an argument
  («YYYY-MM-DD»), tile and option order come from a hash of the task id. Cyrillic in the engine only in `letters.ts`.
- **No pressure:** no timers, lives, streaks or notifications; hints are free and never sold; a missed day waits.
- **Ads, if the owner approves them,** only between notebook tasks, never on the first day, never in or after the daily
  puzzles; numbers in `docs/08-game-design.md` §8. «Буквица+» is one purchase, not a subscription.
- **Look** — studio brand tokens only (`src/ui/theme.ts`), drawn by code; no raster pictures (ADR studio 0023).
- **Portrait only.** `applicationId` — `games.gornitsa.bukvitsa` (proposed; the owner confirms before the first
  signed APK).
- The repository is public: no secrets, no private details (e.g. the owner's phone model) in commits, PRs or Issues.

## Expo and native SDKs

Expo SDK 57, as the sister projects (`package.json`); the working config was copied from `Nefeste/shelter`. Never
write Expo or React Native code from memory — follow «Expo has changed» in the charter's `AGENTS.md`.

## Commands

```bash
npm ci                              # dependencies (Bun runs tests and tools)
npx expo install <package>          # ALWAYS instead of npm add for Expo/RN packages
npm run content                     # build and validate content/ → src/content/generated (not in git)
npm run typecheck                   # content + tsc (app) + tsc -p tools
npm run lint                        # zero warnings
npm test                            # content + bun test tools/test
EXPO_OFFLINE=1 npm run export:web && npm run e2e   # web build + Playwright scenario, screenshots in tools/e2e/out
bun tools/content/pick.ts           # add puzzles up to the targets (notebooks.yaml, calendar.yaml); never --fresh after release
bun tools/content/fetch.ts          # download missing Dal sections from Wikisource (polite: own User-Agent, 4 s apart)
```

Run content, typecheck, lint and tests before every push; for UI changes also the browser scenario. `pr.yml` runs the
first four on every PR; the APK is built only on a `vX.Y.Z` tag by `android.yml` (tags are the owner's).

## Project map

- `content/` — `sources.yaml`, `sources/dal-1862/NNN.txt` (raw Wikisource sections), `sections.yaml`, `banned.yaml`,
  `notebooks.yaml`, `calendar.yaml`, `tasks/*.yaml`.
- `tools/content/` — `fetch.ts` (download; scan-page sections via `fromRendered`), `dal.ts` (parse a section into
  proverbs: variants and notes in brackets go to `note`), `pool.ts` (allowed proverbs, word frequency, commonness),
  `pick.ts` (make puzzles: `gapOf`, `endingCut`, `partsOf`, `extraOf`, day slots), `build.ts` (validate, write bundle).
- `src/engine/` — `tasks.ts` (puzzle from proverb, checks), `play.ts` (solving state → state), `day.ts` (calendar
  without `Date`, marks line), `letters.ts`, `core/` (hash, rng — copies).
- `src/state/` — `game.ts` (screen, results, settings, today), `progress.ts`, `settings.ts`, `storage.ts`, `today.ts`.
- `src/screens/` — Home, Task, Day, Archive, Notebooks, Notebook, Settings, About; `src/ui/` — tokens, fonts, kit
  (`Marks` — drawn result circles), `Initial` (the drop-cap); `src/i18n/` — all strings, dates and the share text.
- `tools/test/` — engine, play, content, settings, i18n, version; `tools/e2e/browser.ts` — the browser scenario.
