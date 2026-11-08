// из nardy: src/money/rustore.ts @ 1d2bdff — без оценки RuStore (её модуль — потом, docs/07-roadmap.md, 0.6).
// RuStore Pay — из общего набора студии `@gornitsa/kit` (ADR студии 0022): типы обёртки для React Native
// и сам модуль; Android-часть приходит из maven RuStore и регистрируется плагином набора
// `@gornitsa/kit/rustore-pay/plugin` (app.json).
export { pay } from '@gornitsa/kit/rustore-pay';
export type { PayNative, RsPurchase } from '@gornitsa/kit/rustore-pay';
