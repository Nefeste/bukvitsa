// из nardy: src/money/billing.ts @ 1d2bdff — один товар.
// Оплата на телефоне — RuStore Pay (docs/specs/2026-10-money.md). Сборка RuStore без номера приложения
// в консоли (`EXPO_PUBLIC_RUSTORE_APP_ID`) — «покупки подключаются»: без него SDK оплаты не работает.
import { pay } from './rustore';
import { causeOf, ownedOf, purchaseVia, rsDetail, rsText, unavailableOf } from './rustoreRules';
import { PRODUCT_IDS } from './types';
import type { Billing, BuyResult, Product, ProductId } from './types';

/** Для какого магазина сборка: `rustore` (по умолчанию) или `other`. */
export const STORE: 'rustore' | 'other' = process.env.EXPO_PUBLIC_STORE === 'other' ? 'other' : 'rustore';
const APP_ID = (process.env.EXPO_PUBLIC_RUSTORE_APP_ID ?? '').trim();

const isProduct = (id: string): id is ProductId => (PRODUCT_IDS as readonly string[]).includes(id);

export const billing: Billing = {
  test: false,
  async availability() {
    if (STORE === 'other') return { ok: false, why: 'other-build' };
    if (!pay || !APP_ID) return { ok: false, why: 'not-ready' };
    try {
      const a = await pay.getPurchaseAvailability();
      if (a.availability) return { ok: true };
      const detail = rsText(a.cause);
      const known = detail ? causeOf(detail) : null;
      if (known) return { ok: false, why: known, detail };
      const signed = await pay.getUserAuthorizationStatus().catch(() => true);
      return { ok: false, why: signed ? 'error' : 'not-signed-in', detail };
    } catch (e) {
      return { ok: false, why: unavailableOf(e), detail: rsDetail(e) };
    }
  },
  async products(): Promise<Product[]> {
    if (!pay || !APP_ID || STORE === 'other') return [];
    const list = await pay.getProducts([...PRODUCT_IDS]);
    return list.filter(p => isProduct(p.productId)).map(p => ({ id: p.productId as ProductId, price: p.amountLabel || null }));
  },
  async purchase(id): Promise<BuyResult> {
    if (!pay || !APP_ID || STORE === 'other') return { ok: false, why: 'unavailable' };
    return purchaseVia(pay, id);
  },
  async owned() {
    if (!pay || !APP_ID || STORE === 'other') return null;
    try {
      return ownedOf(await pay.getPurchases(null, null, null));
    } catch {
      return null;
    }
  },
};
