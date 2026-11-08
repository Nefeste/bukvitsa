// Деньги в игре (docs/specs/2026-10-money.md): когда грузить и показывать ролики, права «Буквицы+»,
// покупка. Экраны зовут только эти функции; правила — чистые, в src/engine/money.ts. Устроено как
// src/money/index.ts «Нард» (nardy @ 1d2bdff), только проще: один товар, нет «Про» и оценки.
import { useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { AD_RULES, adAllowed, afterAd, afterSolved, afterTens, EMPTY_COUNTERS, normalizeCounters, withInstallDay, type AdCounters, type AdPlace } from '../engine/money';
import { adsSdk } from './adsSdk';
import { billing } from './billing';
import type { Availability, BuyResult, Unavailable } from './types';

export { billing, STORE } from './billing';
export type { Availability, BuyResult, Product, Unavailable } from './types';

const KEY = 'bukvitsa.money.v1';

export interface Money {
  /** «Буквица+» куплена (по последней сверке с RuStore или по сохранённому) */
  plus: boolean;
  /** когда права сверены с RuStore, мс; 0 — ни разу */
  plusCheckedAt: number;
  counters: AdCounters;
  /** тетрадь → сколько первых задач открыто роликами по желанию */
  opened: Record<string, number>;
}

const EMPTY: Money = { plus: false, plusCheckedAt: 0, counters: EMPTY_COUNTERS, opened: {} };

/** Сохранённое → состояние; мусор не проходит. */
export function parseMoney(raw: string | null): Money {
  try {
    const v = (raw ? JSON.parse(raw) : {}) as Record<string, unknown>;
    const opened: Record<string, number> = {};
    if (v.opened && typeof v.opened === 'object')
      for (const [k, n] of Object.entries(v.opened as Record<string, unknown>)) if (typeof n === 'number' && n > 0) opened[k] = Math.floor(n);
    return {
      plus: v.plus === true,
      plusCheckedAt: typeof v.plusCheckedAt === 'number' ? v.plusCheckedAt : 0,
      counters: normalizeCounters(v.counters),
      opened,
    };
  } catch {
    return { ...EMPTY };
  }
}

let state: Money = EMPTY;
const listeners = new Set<() => void>();
function set(next: Money) {
  state = next;
  listeners.forEach(l => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {
    // не сохранилось — права сверятся с RuStore при следующем запуске
  });
}

export const getMoney = (): Money => state;
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** Состояние денег для экрана — перерисовка при каждом изменении. */
export const useMoney = (): Money => useSyncExternalStore(subscribe, getMoney, getMoney);

/** SDK рекламы упал при запуске — реклама выключена до перезапуска игры. */
let adsBroken = false;
let started: Promise<void> | null = null;

let loaded: Promise<void> | null = null;

/** При запуске, до первого экрана: сохранённые права и счётчики, день установки. Быстро — только чтение. */
export function loadMoney(today: string): Promise<void> {
  loaded ??= (async () => {
    let raw: string | null = null;
    try {
      raw = await AsyncStorage.getItem(KEY);
    } catch {
      // нет — начнём с пустого
    }
    const m = parseMoney(raw);
    set({ ...m, counters: withInstallDay(m.counters, today) });
  })();
  return loaded;
}

/** После первого экрана: SDK рекламы (без показа) и сверка прав с RuStore — игрок их не ждёт. */
export function startMoney(personal: boolean, today: string): Promise<void> {
  started ??= (async () => {
    await loadMoney(today);
    try {
      await adsSdk.init(personal);
    } catch {
      adsBroken = true;
    }
    void syncRights();
  })();
  return started;
}

/** Сверить права с RuStore. `ok` — сверено; иначе — почему нет (права остаются сохранённые). */
export async function syncRights(): Promise<Availability> {
  try {
    const a = await billing.availability();
    if (!a.ok) return a;
    const owned = await billing.owned();
    if (!owned) return { ok: false, why: 'error' };
    set({ ...state, plus: owned.plus, plusCheckedAt: Date.now() });
    return { ok: true };
  } catch {
    return { ok: false, why: 'error' };
  }
}

export async function buyPlus(): Promise<BuyResult> {
  try {
    const r = await billing.purchase('bukvitsa_plus');
    // и после отмены: игрок мог заплатить и закрыть шторку — права покажет сверка (так советует RuStore)
    if (r.ok || r.why === 'cancelled') await syncRights();
    return r;
  } catch {
    return { ok: false, why: 'failed' };
  }
}

export function setPersonalAds(personal: boolean): void {
  if (!adsBroken) adsSdk.setPersonal(personal);
}

/** Решена задача тетради: в счётчики; межстраничный — грузить заранее, чтобы к «Ещё» был готов. */
export function notebookTaskSolved(): void {
  set({ ...state, counters: afterSolved(state.counters) });
  if (!adsBroken && !state.plus) adsSdk.loadInterstitial();
}

/** Можно ли показать межстраничный ролик сейчас — правила движка и ролик уже загружен. */
export function interstitialDue(place: AdPlace, today: string): boolean {
  return !adsBroken && adAllowed(state.counters, place, today, Date.now(), state.plus) && adsSdk.interstitialReady();
}

/** Показать межстраничный ролик; `false` — показывать нечего. Переход дальше игрок не ждёт. */
export function showInterstitial(): boolean {
  if (adsBroken) return false;
  return adsSdk.showInterstitial(() => set({ ...state, counters: afterAd(state.counters, Date.now(), 'interstitial') }));
}

/** Загрузить ролик по желанию (обложка закрытой тетради); `onReady` — когда готов. */
export function prepareRewarded(onReady: () => void): void {
  if (!adsBroken) adsSdk.loadRewarded(onReady);
}
export const rewardedReady = (): boolean => !adsBroken && adsSdk.rewardedReady();

/** «Десять задач за ролик»: досмотрен — следующие десять задач тетради открыты навсегда. */
export async function watchForTens(book: string, total: number): Promise<boolean> {
  if (adsBroken) return false;
  const r = await adsSdk.showRewarded();
  if (r !== 'rewarded') return false;
  set({ ...state, counters: afterAd(state.counters, Date.now(), 'rewarded'), opened: { ...state.opened, [book]: afterTens(state.opened[book] ?? 0, total) } });
  return true;
}

/** Сколько задач открывает один ролик — для подписи кнопки. */
export const TENS = AD_RULES.tens;

/** Где помочь с покупкой: вход в RuStore, сам RuStore или его страница. */
const RUSTORE_URL = 'https://www.rustore.ru/catalog/app/games.gornitsa.bukvitsa';
export function openRuStore(why: Unavailable): void {
  void why;
  void Linking.openURL(RUSTORE_URL).catch(() => {});
}
