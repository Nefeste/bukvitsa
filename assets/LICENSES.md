# Паспорт картинок «Буквицы»

Сделано скриптом `bun tools/art/icon.ts` (ADR устава 0023, правило 3) — не править руками. Буква — шрифт Kurale
(SIL OFL 1.1, пакет `@expo-google-fonts/kurale`, тот же, что в игре), цвета — токены студии (`src/ui/theme.ts`).
Рисует Chromium без окна (Playwright 1.56.1); другая версия Chromium может дать другие байты —
тогда паспорт пересобирается этим же скриптом.

| Файл | Размер | SHA-256 |
|---|---|---|
| `assets/icon.png` | 1024 × 1024 | `0e9c496ad26d1c1261d1a97f8a85fd7f10df54e892272e1e3e195c19e38b8f5e` |
| `assets/adaptive-icon.png` | 1024 × 1024 | `d43b87145b9b94e36d3bb8cc047d6b06eaafa4d74a90766e7873a81139b3005e` |
| `assets/sounds/right.wav`, `hint.wav` | звуки — синтез своим кодом, `bun tools/sound/make.ts` (`tools/sound/synth.ts`); байты сверяет `tools/test/sound.test.ts` | — |
| `assets/splash-icon.png` | 512 × 512 | `e8ffd95420b44efbb143dfbc35a61f1a1ef32ab2c3a2590740d27c688eea1f74` |
