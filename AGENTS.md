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

«Буквица» (`bukvitsa`): Russian-language word puzzles for RuStore — a proverb with a missing
word, a riddle, a proverb with an extra letter, an old word from Dahl's dictionary, a proverb
in shuffled parts. Content comes from public-domain editions (Dahl 1879/1880, Sadovnikov 1876).
One daily puzzle shared by everyone, thematic notebooks, free hints, no timers, no server.
Money: interstitial ads between puzzles (never inside a puzzle, never around the daily
puzzle) and one purchase «Буквица+». Expo / React Native / TypeScript, SVG, no Skia.

**There is no code yet** (owner's decision 04.10.2026: documents and the "planned" card on
the site only). Do not start implementation until the owner opens development; until then,
work is documents, specs, ADRs and content records (`content/`, `review: draft`).

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

## Commands (planned; appear with 0.1)

```bash
npx expo install <package>          # ALWAYS use instead of npm/yarn/pnpm/bun add
bun tools/content/build.ts --check  # FIRST: content/ → src/content/generated/pack.ts (not in git) + checks
bun tools/content/play.ts           # "virtual player": ambiguous letter rows, options, parts
bun tools/content/calendar.ts --from ГГГГ-ММ-ДД --years 3   # append the daily calendar (never edit released dates)
npx expo start                      # dev server
npm run lint                        # zero warnings
npx tsc --noEmit                    # typecheck (also -p tools)
bun test tools/test                 # engine, content, saves, texts, automerge
npm run export:web && npm run e2e   # web build + Playwright scenario
BUKVITSA_WEB_BASE=/bukvitsa/test npx expo export --platform web --output-dir dist-site
E2E_DIST=dist-site E2E_BASE=/bukvitsa/test npm run e2e   # the same scenario on the site build
```

**CI and merging** (studio ADR 0018, 0019; `docs/05-process.md`, «Ветки»): `pr.yml` runs
typecheck, lint, tests and the content build on every PR to `main` — a required check (while
there is no `package.json` it passes immediately). A PR that touches no owner path from
`.github/CODEOWNERS` merges by itself (`automerge.yml`) after green checks and the label
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
  under the same `id`. Keep ≥ 365 days of calendar ahead in every release.
- **No server, no analytics SDK, no profile** (ADR 0001 table). The ad SDK is the only
  third-party code with network access; its permissions are the project's whitelist
  (`tools/test/permissions.json`) and nothing more.
- **Web build is first-class** (ADR 0007): nothing native-only in the core; purchase, ads,
  sound and storage sit behind adapters with web stubs; the Playwright scenario must stay green.
- **Russian only** (ADR 0006): no second language in `src/i18n/`, no foreign builds.
- `applicationId` is `games.gornitsa.bukvitsa` (studio ADR 0006).
