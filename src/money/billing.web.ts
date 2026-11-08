// из nardy: src/money/billing.web.ts @ 1d2bdff — один товар.
// Тестовый магазин для браузера: веб-сборка — только для проверок (tools/e2e), настоящей оплаты в ней нет.
// Покупка проходит сразу и запоминается в localStorage, чтобы прогон проверил «Буквицу+» после перезагрузки.
import { PRODUCT_IDS } from './types';
import type { Billing, Owned } from './types';

export const STORE: 'rustore' | 'other' = 'rustore';

const KEY = 'bukvitsa.test-store';

function read(): Owned {
  try {
    const o = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null') as Partial<Owned> | null;
    return { plus: o?.plus === true };
  } catch {
    return { plus: false };
  }
}

export const billing: Billing = {
  test: true,
  availability: async () => ({ ok: true }),
  products: async () => PRODUCT_IDS.map(id => ({ id, price: '249 ₽' })),
  purchase: async () => {
    try {
      globalThis.localStorage?.setItem(KEY, JSON.stringify({ plus: true }));
    } catch {
      // проверке хватит памяти страницы
    }
    return { ok: true };
  },
  owned: async () => read(),
};
