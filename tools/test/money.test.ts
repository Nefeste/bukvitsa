// Деньги: границы рекламы (08-game-design.md, «Реклама»), тетради по правам (canOpen), права по списку
// покупок RuStore (src/money/rustoreRules.ts). Чистые функции — без телефона, SDK и сети.
import { describe, expect, test } from 'bun:test';
import { AD_RULES, adAllowed, afterAd, afterSolved, afterTens, canOpen, openCount, EMPTY_COUNTERS, normalizeCounters, withInstallDay, type AdCounters } from '../../src/engine/money';
import { ownedOf } from '../../src/money/rustoreRules';
import type { RsPurchase } from '@gornitsa/kit/rustore-pay';

const DAY1 = '2026-12-01';
const DAY2 = '2026-12-02';
const ready: AdCounters = { installDay: DAY1, solved: 12, sinceAd: 3, lastAdAt: 0 };
const NOW = 10 * 60_000;

describe('межстраничный ролик', () => {
  test('можно только между задачами тетради, со второго дня, после десятой задачи, через три задачи, не чаще трёх минут', () => {
    expect(adAllowed(ready, 'between', DAY2, NOW, false)).toBe(true);
    for (const place of ['daily', 'task', 'source', 'launch', 'archive'] as const) expect(adAllowed(ready, place, DAY2, NOW, false)).toBe(false);
    expect(adAllowed(ready, 'between', DAY1, NOW, false)).toBe(false); // первый день
    expect(adAllowed({ ...ready, installDay: '' }, 'between', DAY2, NOW, false)).toBe(false);
    expect(adAllowed({ ...ready, solved: AD_RULES.firstSolved - 1 }, 'between', DAY2, NOW, false)).toBe(false);
    expect(adAllowed({ ...ready, sinceAd: 2 }, 'between', DAY2, NOW, false)).toBe(false);
    expect(adAllowed({ ...ready, lastAdAt: NOW - AD_RULES.minGapMs + 1 }, 'between', DAY2, NOW, false)).toBe(false);
    expect(adAllowed({ ...ready, lastAdAt: NOW - AD_RULES.minGapMs }, 'between', DAY2, NOW, false)).toBe(true);
  });
  test('с «Буквицей+» — никогда', () => {
    expect(adAllowed(ready, 'between', DAY2, NOW, true)).toBe(false);
  });
  test('счётчики: день установки не меняется; ролик обнуляет счёт задач; мусор — пусто', () => {
    const c = withInstallDay(EMPTY_COUNTERS, DAY1);
    expect(withInstallDay(c, DAY2).installDay).toBe(DAY1);
    const s = afterSolved(afterSolved(c));
    expect([s.solved, s.sinceAd]).toEqual([2, 2]);
    const a = afterAd(s, NOW, 'interstitial');
    expect([a.sinceAd, a.lastAdAt, a.solved]).toEqual([0, NOW, 2]);
    expect(afterAd(s, NOW, 'rewarded').sinceAd).toBe(2);
    expect(normalizeCounters({ installDay: 'вчера', solved: -1, sinceAd: 'x' })).toEqual(EMPTY_COUNTERS);
  });
});

describe('тетради по правам', () => {
  test('первая — бесплатно; с «Буквицей+» — все; иначе — открытые роликами, по десять, не больше тетради', () => {
    expect(canOpen(39, true, false, 0)).toBe('open');
    expect(canOpen(39, false, true, 0)).toBe('open');
    // первые пять задач платной тетради открыты всем, ролики открывают по десять за ними
    expect(canOpen(4, false, false, 0)).toBe('open');
    expect(canOpen(5, false, false, 0)).toBe('locked');
    expect(canOpen(14, false, false, 10)).toBe('open');
    expect(canOpen(15, false, false, 10)).toBe('locked');
    expect(afterTens(0, 40)).toBe(10);
    expect(afterTens(30, 40)).toBe(35);
    expect(openCount(false, false, 0, 40)).toBe(5);
    expect(openCount(false, false, 35, 40)).toBe(40);
    expect(openCount(false, true, 0, 40)).toBe(40);
    expect(openCount(true, false, 0, 54)).toBe(54);
  });
});

describe('права по списку покупок RuStore', () => {
  const p = (productId: string, status: string) => ({ productPurchase: { productId, status } }) as unknown as RsPurchase;
  test('«Буквица+» — только оплаченная (CONFIRMED) покупка своего товара', () => {
    expect(ownedOf([])).toEqual({ plus: false });
    expect(ownedOf([p('bukvitsa_plus', 'CONFIRMED')])).toEqual({ plus: true });
    expect(ownedOf([p('bukvitsa_plus', 'CREATED')])).toEqual({ plus: false });
    expect(ownedOf([p('no_ads', 'CONFIRMED')])).toEqual({ plus: false });
  });
  test('отметки «товар выдан» в коде нет — в обёртке 11.1.0 она роняет приложение (опыт «Нард»)', async () => {
    const { readFileSync, readdirSync } = await import('node:fs');
    const { join } = await import('node:path');
    const dir = join(import.meta.dir, '../../src');
    for (const f of readdirSync(dir, { recursive: true }) as string[])
      if (/\.tsx?$/.test(f)) expect({ f, bad: readFileSync(join(dir, f), 'utf8').includes('updateAcknowledgementState(') }).toEqual({ f, bad: false });
  });
});
