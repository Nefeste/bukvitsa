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

## The project

«Буквица» (`bukvitsa`; the store name is «Складно» since the owner's decision of 08.11.2026, #2 — internal names stay `bukvitsa`): Russian-language word puzzles for RuStore — a proverb with a missing
word, a riddle, a proverb with an extra letter, an old word from Dahl's dictionary, a proverb
in shuffled parts. Content comes from public-domain editions (Dahl 1879/1880, Sadovnikov 1876).
One daily puzzle shared by everyone, thematic notebooks, free hints, no timers, no server.
Money: interstitial ads between puzzles (never inside a puzzle, never around the daily
puzzle) and one purchase «Буквица+». Expo / React Native / TypeScript, SVG, no Skia.

**Development is open** (owner's decision 08.11.2026, `Nefeste/uprava#80`): release in RuStore by mid-December.
0.1.0 is in `main`'s history: the engine of five kinds, the content build, 1 338 draft records made by a script from
the Wikisource text of Dahl (`docs/09-content.md`, §9), a three-year calendar from drafts, the screens. What is not
done yet against the documents — `docs/02-architecture.md`, «Что сделано».

## Read `docs/` before changing anything

The project documents itself in [`docs/`](docs/README.md), in Russian; that is the source of
truth for *why* things are the way they are. Start there, in this order:

- `docs/README.md` — index and the rules these documents follow.
- `docs/01-product.md` — what we promise the player and what is deliberately absent; glossary.
- `docs/08-game-design.md` — five puzzle kinds, hints, daily puzzle, notebooks, ads and
  «Буквица+» as the player sees them; **all game-design numbers live only there**.
- `docs/09-content.md` — sources, what we never take, the record format, build and checks.
  **Read before adding or editing any puzzle record.**
- `docs/02-architecture.md`, `docs/03-server-api.md`, `docs/04-data-model.md` — how it is built
  (no server; what still goes to the network).
- `docs/05-process.md`, `docs/06-testing.md` — versions, branches, CI, secrets, release, checks.
- `docs/07-roadmap.md` — stages 0.1 → 1.0; owner questions В1–В10.
- `docs/10-money.md`, `docs/11-market.md` — ads, purchase, law, market (RuStore, 04.10.2026).
- `docs/adr/` — decisions that are expensive to reverse; read the relevant one *before*
  proposing the opposite.
- `docs/specs/` — specification-driven development: a notable feature gets a spec **before** code.
- `content/known.txt` and ADR 0010 (13.11.2026) — the editor's selection of proverbs known today: it fills the first
  notebook, the first 90 calendar days and the themed notebooks, and goes into `--release` without the scan check;
  `review: checked` is still set only by a human.
- `docs/journal/ГГГГ-ММ.md` — the monthly journal; add a dated entry for anything decided,
  done or broken.

## Sister projects

Infrastructure is reused from the studio's other games **by copying** with a source line on top
(studio ADR 0002; list in `docs/02-architecture.md`, «Что берём у соседей»): `Nefeste/votchina`
(dialog, i18n mechanics, crash log, storage, settings, theme), `Nefeste/uzory` (signing plugin,
`android.yml`, `site.yml`, `rustore.yml`, `pr.yml`, `automerge.yml` + script, content build
and checks as a model), `Nefeste/nardy` (RuStore Pay, RuStore Review, the ads adapter and its
SDK — «Буквица» uses the same ad network as «Нарды»). Take workflows from `Nefeste/gornitsa-kit`
once they exist there. The studio brand (fonts Kurale and Onest, colour tokens, the ornament
band) is in the charter's `brand/`.

## Expo and native SDKs

Planned Expo SDK 57, as the sister projects. Never write Expo, React Native, Reanimated,
RuStore Pay / Review or the ad SDK code from memory — follow «Expo has changed» in the
charter's `AGENTS.md` and read the current docs of each SDK before use. The ad SDK version is
pinned and changed only in a separate PR.

## Commands

```bash
npm ci
npx expo install <package>          # ALWAYS use instead of npm/yarn/pnpm/bun add
npm run content                     # FIRST: content/ → src/content/generated/pack.ts (not in git) + checks; report dist/report.md
bun tools/content/build.ts --check  # checks only; --release — only `checked` or the editor's selection (`content/known.txt`, ADR 0010), calendar ≥ 60 such days (ADR 0008)
bun tools/content/pick.ts           # draft records from the downloaded Dahl text (09-content.md §9); never renumbers
bun tools/content/calendar.ts --from ГГГГ-ММ-ДД --years 3 [--draft]   # append the daily calendar (never edit released dates)
bun tools/content/fetch.ts          # download missing Dahl sections from Wikisource (own User-Agent, 4 s apart)
bun tools/content/release.ts vX.Y.Z # store release only: released.json, released-lock.json (task hashes), released calendar dates
bun tools/content/sverka.ts         # owner's checklist for the release: first notebook + first 70 calendar days → dist/sverka.md
bun tools/content/play.ts           # "virtual player": ambiguous letter rows, extra letters, options, parts → dist/play.md
npx expo start                      # dev server
npm run lint                        # zero warnings; no Date.now / new Date / Math.random in src/engine
npm run typecheck                   # content + tsc (app) + tsc -p tools
bun test tools/test                 # engine, play, content, settings, texts, version
EXPO_OFFLINE=1 npm run export:web && npm run e2e   # web build + Playwright scenario (`?date=ГГГГ-ММ-ДД`)
BUKVITSA_WEB_BASE=/bukvitsa/test npx expo export --platform web --output-dir dist-site
E2E_DIST=dist-site E2E_BASE=/bukvitsa/test npm run e2e   # the same scenario on the site build
```

**CI and merging** (studio ADR 0018, 0019; `docs/05-process.md`, «Ветки»): `pr.yml` runs
the content build, typecheck, lint and tests on every PR to `main` — a required check. A PR that touches no owner path from
`.github/CODEOWNERS` merges by itself (`automerge.yml`, from `Nefeste/gornitsa-kit`, studio ADR 0022) after green checks and the label
`ревью: ок` from a reviewer in another session — never put that label on your own PR; a new
commit removes it. Owner paths (`deploy/`, `.github/`, `server/`, `src/money/`, forms and
privacy, `app.json`, `plugins/`, `content/calendar.yaml`) are merged by the owner. Run the
checks locally before every push anyway. APK is built only on a version tag `vX.Y.Z`.

## Hard rules

Studio-wide rules — no React Native `Alert`, player-facing strings only in `src/i18n/`,
generated `ios/`/`android/`, a permanent application id and signing key, a pure engine, no
ads in the middle of play, no pressure, content only from named sources — are in the
charter's `docs/05-rules.md` and are not repeated here. This project's own rules:

- **The engine is pure**: `src/engine/` — no React, no `Date.now()`, no `Math.random()`;
  today's date, rights and progress are arguments. Letter rows, option order and part order
  come **from the content build**, never shuffled on the phone (ADR 0005).
- **Content only from the sources in `docs/09-content.md` §1**, with section/page and a
  legal basis in every record; selection rules of §2 apply (no religion, no peoples, no
  cruelty, no weapons in riddles). Agents write `review: draft`; `review: checked` is set by
  a human after checking against the scan. **Never from memory, never from "the internet".**
- **Ads only between puzzles** by the engine's `adAllowed`; never inside a puzzle, never
  before or after the daily puzzle, never at launch; no banners. Hints are free and are
  never sold — not for money, not for a rewarded ad (ADR 0003). The rewarded ad, if kept
  (owner question В3), opens *ten more puzzles* of a notebook — a counter, never a time-limited
  pass.
- **«Буквица+» is one non-consumable purchase**, offered only in the three places listed in
  `docs/08-game-design.md`; no subscription, no trial, no countdown discounts.
- **The daily calendar is immutable once released** (`content/calendar.yaml`, ADR 0002):
  the calendar tool only appends; a wrong puzzle is fixed by a new `version` of the record
  under the same `id`. Keep ≥ 60 days of checked calendar ahead in every release (ADR 0008); each release appends checked days.
- **No server, no analytics SDK, no profile** (ADR 0001 table). The ad SDK is the only
  third-party code with network access; its permissions are the project's whitelist
  (`.github/apk-permissions.txt`, checked on the tag build) and nothing more; RuStore forms — `store/forms.md`.
- **Web build is first-class** (ADR 0007): nothing native-only in the core; purchase, ads,
  sound and storage sit behind adapters with web stubs; the Playwright scenario must stay green.
- **Russian only** (ADR 0006): no second language in `src/i18n/`, no foreign builds.
- `applicationId` is `games.gornitsa.bukvitsa` (studio ADR 0006).

## Project map (0.1.0)

- `content/` — records `proverbs/`, `riddles/`, `extra/`, `parts/`, `words/` (one file per puzzle,
  `09-content.md` §3), `notebooks.yaml`, `calendar.yaml`, `released.json`, `stoplist.txt` (owner), `sections.yaml` and
  `banned.yaml` (§2 for the script), `sources/dal-1862/` (downloaded Wikisource sections — never edit by hand).
- `tools/content/` — `fetch.ts`, `dal.ts` (parse a section), `pool.ts` (allowed proverbs, word frequency), `pick.ts`
  (draft records), `records.ts`, `shuffle.ts` (row and order from `sha256(id:version)`, ADR 0005), `calendar.ts`,
  `build.ts` (checks §5, `pack.ts`, report).
- `src/engine/` — `types.ts`, `play.ts` (four interactions, three hints, peeked), `day.ts` (calendar without `Date`),
  `words.ts`, `money.ts`, `rate.ts`, `letters.ts` (the only engine file with Cyrillic).
- `src/state/` — `game.ts`, `save.ts` + `migrations.ts` (save schema 1: events, settings; fixtures in
  `tools/test/fixtures/saves/`), `progress.ts` (results derived for screens), `settings.ts`, `storage.ts`, `rate.ts`,
  `today.ts` (`?date=` on web), `share.ts`; `src/screens/` — Home, Task (with «Откуда это»), Notebook, Archive, Settings,
  About; `src/ui/` — `theme.ts` (light/dark palettes, «ещё крупнее», `themed()` styles), fonts, kit, `Initial` (the
  drop-cap); `src/i18n/` — all strings and the share text; `modules/rustore-review` — RuStore Review (copy from nardy).
- `tools/test/`, `tools/e2e/browser.ts`.

