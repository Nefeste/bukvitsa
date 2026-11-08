# Паспорт картинок «Складно»

Сделано скриптом `bun tools/art/icon.ts` (ADR устава 0023, правило 3) — не править руками. Буква — шрифт Kurale
(SIL OFL 1.1, пакет `@expo-google-fonts/kurale`, тот же, что в игре), цвета — токены студии (`src/ui/theme.ts`).
Рисует Chromium без окна (Playwright 1.56.1); другая версия Chromium может дать другие байты —
тогда паспорт пересобирается этим же скриптом.

| Файл | Размер | SHA-256 |
|---|---|---|
| `assets/icon.png` | 1024 × 1024 | `6601321db988628dd72daf2805b1e31b1624535feb48133a203f94568def6d9e` |
| `assets/adaptive-icon.png` | 1024 × 1024 | `9fe5dc128180c39cd34622447e11639d3f029d4e6cf0e1df20efe56eee526ee1` |
| `assets/splash-icon.png` | 512 × 512 | `078243132f98d215723112ddb466f5dc847f751b6a0309c40a4f64b37cde3383` |

Звуки `assets/sounds/right.wav`, `hint.wav` — синтез своим кодом: `bun tools/sound/make.ts` (`tools/sound/synth.ts`);
байты сверяет `tools/test/sound.test.ts`.
