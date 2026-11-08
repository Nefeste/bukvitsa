// Деньги в движке — чистые правила (docs/08-game-design.md, «Реклама», «Тетради»; ADR 0003; специфика —
// specs/2026-10-money.md). Здесь нет SDK, Date и сети: время и день — аргументы. Экран показывает
// межстраничный ролик только при `adAllowed(...) === true`, ролик по желанию — только с кнопки.

/** Границы рекламы — числа из 08-game-design.md, «Реклама»; меняются только вместе с ним. */
export const AD_RULES = {
  /** межстраничный — не раньше, чем решено столько задач тетрадей */
  firstSolved: 10,
  /** дальше — после каждой стольких решённой задачи тетради */
  every: 3,
  /** не чаще одного раза в столько мс */
  minGapMs: 3 * 60_000,
  /** ролик по желанию открывает столько задач закрытой тетради */
  tens: 10,
} as const;

export interface AdCounters {
  /** день установки «ГГГГ-ММ-ДД» (первый запуск); '' — ещё не записан */
  installDay: string;
  /** решено задач тетрадей всего */
  solved: number;
  /** решено задач тетрадей с прошлого межстраничного ролика */
  sinceAd: number;
  /** когда показан последний ролик (любой), мс; 0 — не было */
  lastAdAt: number;
}

export const EMPTY_COUNTERS: AdCounters = { installDay: '', solved: 0, sinceAd: 0, lastAdAt: 0 };

/** Где игрок сейчас. Межстраничный ролик возможен только `between` — между задачами тетради. */
export type AdPlace = 'between' | 'daily' | 'task' | 'source' | 'launch' | 'archive';

/** Можно ли сейчас показать межстраничный ролик. */
export function adAllowed(c: AdCounters, place: AdPlace, today: string, now: number, plus: boolean): boolean {
  if (plus || place !== 'between') return false;
  if (!c.installDay || c.installDay === today) return false;
  if (c.solved < AD_RULES.firstSolved) return false;
  if (c.sinceAd < AD_RULES.every) return false;
  return !(c.lastAdAt && now - c.lastAdAt < AD_RULES.minGapMs);
}

/** Первый запуск — день установки; потом он не меняется. */
export const withInstallDay = (c: AdCounters, today: string): AdCounters => (c.installDay ? c : { ...c, installDay: today });

/** Решена задача тетради (задача дня рекламы не двигает). */
export const afterSolved = (c: AdCounters): AdCounters => ({ ...c, solved: c.solved + 1, sinceAd: c.sinceAd + 1 });

/** Ролик показан: межстраничный обнуляет счёт задач; оба ставят время. */
export const afterAd = (c: AdCounters, now: number, kind: 'interstitial' | 'rewarded'): AdCounters =>
  kind === 'interstitial' ? { ...c, sinceAd: 0, lastAdAt: now } : { ...c, lastAdAt: now };

/** Сохранённое — поверх пустых счётчиков; мусор не проходит. */
export function normalizeCounters(raw: unknown): AdCounters {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
  const day = typeof r.installDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(r.installDay) ? r.installDay : '';
  return { installDay: day, solved: num(r.solved), sinceAd: num(r.sinceAd), lastAdAt: num(r.lastAdAt) };
}

/** Тетрадь глазами прав: открыта ли задача с номером `index` (с нуля). */
export type Access = 'open' | 'locked';

/**
 * Первая тетрадь — бесплатно; с «Буквицей+» — все; иначе открыты первые `opened` задач тетради —
 * их открывают ролики по желанию, по десять, навсегда (счётчик, не срок — ADR студии 0010).
 */
export function canOpen(index: number, free: boolean, plus: boolean, opened: number): Access {
  return free || plus || index < opened ? 'open' : 'locked';
}

/** Ролик по желанию досмотрен: ещё десять задач тетради открыты, не больше, чем в ней есть. */
export const afterTens = (opened: number, total: number): number => Math.min(total, opened + AD_RULES.tens);
