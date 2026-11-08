// из nardy: src/money/types.ts @ 1d2bdff — один товар «Буквица+» вместо «Без рекламы», «Про» и оформлений.
// Общие типы денег (docs/specs/2026-10-money.md): товар, права, порты оплаты и рекламы. Кода платформ
// здесь нет: реализации — billing.ts / adsSdk.ts (телефон) и *.web.ts (браузер, только для проверок).

/** Идентификатор товара — навсегда, как `applicationId` (он же в консоли RuStore). */
export type ProductId = 'bukvitsa_plus';
export const PRODUCT_IDS: readonly ProductId[] = ['bukvitsa_plus'];

/** Товар для экрана «Буквица+»: цена — строкой из магазина («249 ₽»); `null` — магазин цену не назвал. */
export interface Product { id: ProductId; price: string | null }

/** Что куплено, по словам магазина. */
export interface Owned { plus: boolean }

/** Почему покупки недоступны. */
export type Unavailable =
  | 'other-build'     // сборка не для RuStore
  | 'not-ready'       // сборка RuStore, но номер приложения в консоли ещё не задан
  | 'no-rustore'      // RuStore не установлен или не поддерживает платежи
  | 'not-signed-in'   // не выполнен вход в RuStore
  | 'error';          // RuStore отказал или не ответил

/** `detail` — что ответил RuStore, как есть: по нему видно, что чинить. */
export type Availability = { ok: true } | { ok: false; why: Unavailable; detail?: string };

export type BuyResult = { ok: true } | { ok: false; why: 'cancelled' | 'failed' | 'unavailable'; code?: string; detail?: string };

/** Порт оплаты: всё, что игре нужно от магазина. */
export interface Billing {
  /** Тестовый магазин (браузер): экран подписывает это, чтобы не путать с настоящим. */
  readonly test: boolean;
  availability(): Promise<Availability>;
  products(): Promise<Product[]>;
  purchase(id: ProductId): Promise<BuyResult>;
  /** Сверка прав с магазином; `null` — сверить не удалось (тогда живём по сохранённому). */
  owned(): Promise<Owned | null>;
}

/** Порт рекламной сети: загрузить заранее, показать готовое. Ждать загрузки игрок не должен никогда. */
export interface AdsSdk {
  /** Запуск SDK; `personal` — согласие на персональную рекламу. */
  init(personal: boolean): Promise<void>;
  setPersonal(personal: boolean): void;
  loadInterstitial(): void;
  interstitialReady(): boolean;
  /** Показать загруженный; `false` — показывать нечего. `onShown` — ролик действительно показан. */
  showInterstitial(onShown: () => void): boolean;
  loadRewarded(onReady?: () => void): void;
  rewardedReady(): boolean;
  /** Ролик по желанию: `rewarded` — только по событию SDK «награда получена». */
  showRewarded(): Promise<'rewarded' | 'closed' | 'failed'>;
}
