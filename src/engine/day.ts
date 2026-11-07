// Задача дня — из календаря «дата → id», собранного при сборке (ADR 0002); сервера нет. Дата —
// строка «ГГГГ-ММ-ДД» по часам телефона; здесь нет Date — только целая арифметика (days_from_civil).

/** «2026-11-12» → номер дня от 1970-01-01. Неверная строка — исключение. */
export function dayNumber(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) throw new Error(`date is not YYYY-MM-DD: ${date}`);
  let y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) throw new Error(`no such date: ${date}`);
  y -= mo <= 2 ? 1 : 0;
  const era = Math.floor(y / 400);
  const yoe = y - era * 400;
  const doy = Math.floor((153 * (mo + (mo > 2 ? -3 : 9)) + 2) / 5) + d - 1;
  const doe = yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy;
  return era * 146097 + doe - 719468;
}

/** Номер дня → «ГГГГ-ММ-ДД». */
export function dateOf(day: number): string {
  const z = day + 719468;
  const era = Math.floor(z / 146097);
  const doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const m = mp + (mp < 10 ? 3 : -9);
  const y = yoe + era * 400 + (m <= 2 ? 1 : 0);
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** День недели: 0 — понедельник … 6 — воскресенье (1970-01-01 — четверг). */
export function weekday(date: string): number {
  return (((dayNumber(date) + 3) % 7) + 7) % 7;
}

export interface Calendar {
  /** первый день календаря */
  from: string;
  /** 'ГГГГ-ММ-ДД' → id задачи */
  days: Record<string, string>;
}

/** Задача дня; за концом календаря или до начала — `undefined`. */
export function daily(cal: Calendar, today: string): string | undefined {
  return cal.days[today];
}

/** Прошлые задачи дня — от начала календаря до вчера, новые первыми. Будущих дней нет. */
export function archive(cal: Calendar, today: string): string[] {
  const t = dayNumber(today);
  return Object.keys(cal.days)
    .filter(d => dayNumber(d) < t && dayNumber(d) >= dayNumber(cal.from))
    .sort()
    .reverse();
}
