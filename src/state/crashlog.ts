// из votchina: src/state/crashlog.ts @ b6da04a — своё хранилище (запись `bukvitsa.crashlog`), без сети и ключа устройства.
// Журнал сбоев: последние ошибки на телефоне — чтобы игрок мог прислать не «вылетело», а что и где.
// Никуда не уходит сам: только в отчёт «Сообщить об ошибке», который игрок видит целиком и отправляет своими руками.
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CrashKind = 'crash' | 'error' | 'web';
export interface CrashEntry {
  at: number;
  kind: CrashKind;
  message: string;
}

export const CRASH_KEY = 'bukvitsa.crashlog';
/** Сколько записей хранить и какой длины каждая. */
export const CRASH_MAX = 30;
const LEN = 1000;
const STACK_LINES = 8;

/** Текст ошибки для журнала: имя, сообщение и начало стека. */
export function crashText(err: unknown, where?: string): string {
  const e = err as { name?: string; message?: string; stack?: string } | null;
  const head = e && typeof e === 'object' ? `${e.name ?? 'Error'}: ${e.message ?? ''}` : String(err);
  const stack = e && typeof e === 'object' && e.stack ? e.stack.split('\n').slice(1, 1 + STACK_LINES).join('\n') : '';
  return [where, head, stack].filter(Boolean).join('\n').slice(0, LEN);
}

/** Сохранённое → записи; мусор отбрасывается. */
export function parseCrashlog(raw: string | null): CrashEntry[] {
  try {
    const v = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(v)) return [];
    return v
      .filter((e): e is CrashEntry => !!e && typeof e === 'object' && typeof e.at === 'number' && typeof e.message === 'string')
      .map(e => ({ at: e.at, kind: (['crash', 'error', 'web'] as const).includes(e.kind) ? e.kind : 'error', message: e.message.slice(0, LEN) }))
      .slice(-CRASH_MAX);
  } catch {
    return [];
  }
}

// записи идут друг за другом: две ошибки подряд не должны затереть друг друга
let queue: Promise<void> = Promise.resolve();

export function logError(kind: CrashKind, err: unknown, where?: string): void {
  const entry: CrashEntry = { at: Date.now(), kind, message: crashText(err, where) };
  queue = queue
    .then(async () => {
      const list = parseCrashlog(await AsyncStorage.getItem(CRASH_KEY));
      await AsyncStorage.setItem(CRASH_KEY, JSON.stringify([...list, entry].slice(-CRASH_MAX)));
    })
    .catch(() => {});
}

/** Журнал; `null` — не прочитался (в отчёте так и будет сказано). */
export async function readCrashlog(): Promise<CrashEntry[] | null> {
  try {
    await queue;
    return parseCrashlog(await AsyncStorage.getItem(CRASH_KEY));
  } catch {
    return null;
  }
}

/**
 * Ловушки при запуске. `ErrorUtils` есть в React Native (на вебе — нет); прежний обработчик вызывается
 * дальше — поведение сбоя не меняется. На вебе — `error` и `unhandledrejection`.
 */
export function installCrashHandlers(): void {
  const EU = (globalThis as { ErrorUtils?: { getGlobalHandler?: () => (e: unknown, fatal?: boolean) => void; setGlobalHandler?: (h: (e: unknown, fatal?: boolean) => void) => void } }).ErrorUtils;
  if (EU?.getGlobalHandler && EU.setGlobalHandler) {
    const prev = EU.getGlobalHandler();
    EU.setGlobalHandler((e, fatal) => {
      logError(fatal ? 'crash' : 'error', e);
      prev?.(e, fatal);
    });
  }
  const w = (globalThis as { window?: { addEventListener?: (t: string, f: (e: { error?: unknown; message?: string; reason?: unknown }) => void) => void } }).window;
  if (w?.addEventListener) {
    w.addEventListener('error', e => logError('web', e.error ?? e.message));
    w.addEventListener('unhandledrejection', e => logError('web', e.reason));
  }
}
