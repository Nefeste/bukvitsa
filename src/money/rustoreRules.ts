// из nardy: src/money/rustoreRules.ts @ 1d2bdff — права по одному товару «Буквица+».
// Ответы RuStore Pay → права и причины, и сама покупка: модуль оплаты передают параметром, поэтому
// всё здесь гоняют тесты под Bun без телефона. Коды и тексты ошибок SDK и сама покупка — из набора
// `@gornitsa/kit` (ADR студии 0022); здесь — что они значат для «Буквицы».
import { buy, causeReasonOf, reasonOf, rsCode, rsDetail, rsText } from '@gornitsa/kit/rustore-pay/rules';
import type { RsReason } from '@gornitsa/kit/rustore-pay/rules';
import type { PayNative, RsPurchase } from '@gornitsa/kit/rustore-pay';
import type { BuyResult, Owned, Unavailable } from './types';

export { rsCode, rsDetail, rsText };

const WHY: Readonly<Record<RsReason, Unavailable>> = {
  'no-rustore': 'no-rustore',
  outdated: 'no-rustore',
  'not-signed-in': 'not-signed-in',
  'no-app-id': 'not-ready',
  'no-scheme': 'not-ready',
  offline: 'error',
};

/** Ошибка RuStore (отказ промиса обёртки) → почему покупки недоступны. */
export function unavailableOf(e: unknown): Unavailable {
  const r = reasonOf(e);
  return r ? WHY[r] : 'error';
}

/** Текст причины «недоступно» от `getPurchaseAvailability` → почему; `null` — текст незнакомый. */
export function causeOf(cause: string): Unavailable | null {
  const r = causeReasonOf(cause);
  return r ? WHY[r] : null;
}

/** Разовая покупка оплачена: одностадийная — CONFIRMED. */
const PAID = new Set(['CONFIRMED']);

/** Что куплено, по списку покупок RuStore. */
export function ownedOf(list: readonly RsPurchase[]): Owned {
  return { plus: list.some(p => p.productPurchase?.productId === 'bukvitsa_plus' && PAID.has(p.productPurchase.status)) };
}

export type PayPurchase = Pick<PayNative, 'purchase'>;

/**
 * Покупка: одностадийная оплата в шторке RuStore — и всё (`buy` набора). Отметки «товар выдан»
 * (`updateAcknowledgementState`) нет: в обёртке 11.1.0 её успех роняет приложение (опыт «Нард», 1.1.3);
 * права игра берёт из списка покупок.
 */
export async function purchaseVia(pay: PayPurchase, id: string): Promise<BuyResult> {
  const r = await buy(pay, id, 'LIGHT');
  if (r.ok) return { ok: true };
  const { code, detail } = r;
  if (r.cancelled) return { ok: false, why: 'cancelled' };
  if (code === 'RuStoreNotInstalledException' || code === 'RuStoreUserUnauthorizedException') return { ok: false, why: 'unavailable', code, detail };
  return { ok: false, why: 'failed', code: code ?? undefined, detail };
}
