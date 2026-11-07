// Задачи дня — одни на всех без сервера: день выбирает дата телефона, а набор задач на каждый
// день записан в календаре сборки (content/calendar.yaml). Дата приходит строкой «ГГГГ-ММ-ДД»;
// здесь нет Date — только целая арифметика календаря (алгоритм days_from_civil).
import { markOf } from './tasks';
import type { Mark, Result } from './types';

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

export interface Calendar {
  /** первый день календаря, «ГГГГ-ММ-ДД» */
  from: string;
  /** задачи каждого дня по порядку, начиная с `from` */
  days: string[][];
}

/**
 * Какой по счёту день календаря у даты. До начала — 0 (первый день). После конца календарь идёт
 * по кругу: вернее, чем пустой экран, а сборка следит, чтобы запас дней был (06-testing.md).
 */
export function calendarIndex(cal: Calendar, date: string): number {
  const i = dayNumber(date) - dayNumber(cal.from);
  if (i <= 0) return 0;
  return i % cal.days.length;
}

/** Задачи дня по дате. */
export function dailyTasks(cal: Calendar, date: string): string[] {
  return cal.days[calendarIndex(cal, date)] ?? [];
}

/** Дни архива — от начала календаря до сегодня, новые первыми. Пропущенный день ждёт. */
export function archiveDates(cal: Calendar, today: string): string[] {
  const from = dayNumber(cal.from);
  const to = dayNumber(today);
  const out: string[] = [];
  for (let d = to; d >= from; d--) out.push(dateOf(d));
  return out;
}

const GLYPH: Record<Mark, string> = { clean: '●', helped: '◐', shown: '○' };

/** Строка кружков итога: по одному на задачу; нерешённая — «·». Слова вокруг — в src/i18n. */
export function marksLine(results: readonly (Result | undefined)[]): string {
  return results.map(r => (r && r.done ? GLYPH[markOf(r)] : '·')).join('');
}

/** Сколько задач решено без подсказок и ошибок. */
export function cleanCount(results: readonly (Result | undefined)[]): number {
  return results.filter(r => r && r.done && markOf(r) === 'clean').length;
}
