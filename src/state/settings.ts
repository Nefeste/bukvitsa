// из shelter: src/state/settings.ts @ fa04538 — свои поля: тема и «ещё крупнее» (08-game-design.md, «Экраны»).
// Настройки игрока: «меньше движения» (ADR устава 0023, правило 6 — docs/02-architecture.md, «Графика»).
// Чистые функции: разбор сохранённой строки и что действует, если игрок «меньше движения» не трогал, —
// как в системе телефона. Читает и пишет их src/state/storage.ts.

export interface Settings {
  /** «меньше движения»; не задано — как в системе телефона */
  lessMotion?: boolean;
  /** персональная реклама (specs/2026-10-money.md, «Экран согласия»); не задано — ещё не спрашивали, ролики обычные */
  adsConsent?: 'yes' | 'no';
  /** тема; не задано — как в телефоне */
  theme?: 'light' | 'dark';
  /** «ещё крупнее» — текст и плашки ×1,25 */
  bigger?: boolean;
}

export const DEFAULT_SETTINGS: Settings = {};

/** Сохранённая строка → настройки; мусор и пусто — по умолчанию. */
export function parseSettings(raw: string | null): Settings {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : {};
    const s = v && typeof v === 'object' ? (v as Partial<Settings>) : {};
    const out: Settings = {};
    if (typeof s.lessMotion === 'boolean') out.lessMotion = s.lessMotion;
    if (s.adsConsent === 'yes' || s.adsConsent === 'no') out.adsConsent = s.adsConsent;
    if (s.theme === 'light' || s.theme === 'dark') out.theme = s.theme;
    if (typeof s.bigger === 'boolean') out.bigger = s.bigger;
    return out;
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Действует ли «меньше движения»: выбор игрока, а если он не выбирал — системная настройка. */
export function lessMotionOf(s: Settings, system: boolean): boolean {
  return s.lessMotion ?? system;
}

/** Тёмная ли тема сейчас: выбор игрока, а если он не выбирал — тема телефона. */
export function darkOf(s: Settings, systemDark: boolean): boolean {
  return s.theme ? s.theme === 'dark' : systemDark;
}
