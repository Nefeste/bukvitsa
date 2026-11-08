// из votchina: src/state/report.ts @ b6da04a — без партии; вместо неё задача, о которой пишет игрок.
// Отчёт об ошибке: один текст, который игрок видит целиком до отправки. Уходит только его руками — письмом
// или через «Поделиться». Чистая функция: подписи приходят из src/i18n, время — числом.
import type { CrashEntry } from './crashlog';

export interface ReportInput {
  what: string;
  version: string;
  build: number;
  /** «Android 14 · Xiaomi 23053RN02Y» — с телефона; в вебе — браузер */
  device: string;
  /** экран, с которого открыли отчёт */
  screen: string;
  /** задача, о которой отчёт: «proverb-0123 (версия 1)», или null */
  task: string | null;
  /** отложена ли нечитаемая запись сохранения (src/state/storage.ts) */
  broken: boolean;
  log: CrashEntry[] | null;
  labels: { what: string; version: string; device: string; screen: string; task: string; broken: string; log: string; noLog: string; logUnread: string };
}

/** Предел тела письма: `mailto` длиннее многие почтовые приложения обрезают. */
export const REPORT_MAX = 8000;
/** Сколько последних записей журнала идёт в отчёт. */
export const REPORT_LOG = 10;

const time = (t: number) => new Date(t).toISOString().replace('T', ' ').slice(0, 19);

export function buildReport(r: ReportInput): string {
  const L = r.labels;
  const log = r.log === null ? L.logUnread : !r.log.length ? L.noLog : r.log.slice(-REPORT_LOG).map(e => `[${time(e.at)} ${e.kind}] ${e.message}`).join('\n\n');
  const text = [
    r.what.trim() ? `${L.what}\n${r.what.trim()}` : '',
    r.task ? `${L.task}: ${r.task}` : '',
    `${L.version}: ${r.version} (${r.build})`,
    `${L.device}: ${r.device}`,
    `${L.screen}: ${r.screen}`,
    r.broken ? L.broken : '',
    `${L.log}:\n${log}`,
  ]
    .filter(Boolean)
    .join('\n\n');
  // обрезается журнал, а не то, что написал игрок: он — в начале
  return text.length > REPORT_MAX ? `${text.slice(0, REPORT_MAX - 1)}…` : text;
}
