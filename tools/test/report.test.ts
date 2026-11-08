// «Сообщить об ошибке» (src/state/report.ts, crashlog.ts): отчёт целиком из подписей, задача и журнал; что написал
// игрок — в начале и не обрезается; журнал — последние записи, мусор из хранилища отбрасывается.
import { describe, expect, test } from 'bun:test';
import { CRASH_MAX, crashText, parseCrashlog } from '../../src/state/crashlog';
import { buildReport, REPORT_LOG, REPORT_MAX } from '../../src/state/report';
import { T } from '../../src/i18n';

const base = { what: '', version: '0.2.0', build: 1, device: 'Android 14 · Xiaomi', screen: 'settings', task: null, broken: false, log: [], labels: T.report.labels };

describe('отчёт', () => {
  test('подписи, версия, телефон, экран; без журнала — «сбоев не было»', () => {
    const t = buildReport(base);
    expect(t).toContain('Версия: 0.2.0 (1)');
    expect(t).toContain('Телефон: Android 14 · Xiaomi');
    expect(t).toContain('Экран: settings');
    expect(t).toContain('сбоев не было');
    expect(t).not.toContain('Задача');
  });
  test('задача, текст игрока первым, отложенное сохранение', () => {
    const t = buildReport({ ...base, what: '  опечатка в ответе  ', task: 'proverb-0123 (1)', broken: true });
    expect(t.startsWith('Что не так\nопечатка в ответе')).toBe(true);
    expect(t).toContain('Задача: proverb-0123 (1)');
    expect(t).toContain(T.report.labels.broken);
  });
  test('журнал — последние записи; не прочитался — так и сказано; длина ограничена', () => {
    const log = Array.from({ length: 15 }, (_, i) => ({ at: Date.UTC(2026, 10, 8, 12, 0, i), kind: 'error' as const, message: `сбой ${i}` }));
    const t = buildReport({ ...base, log });
    expect(t).toContain(`сбой 14`);
    expect(t).not.toContain('сбой 4\n');
    expect(t.match(/\[2026-11-08/g)?.length).toBe(REPORT_LOG);
    expect(buildReport({ ...base, log: null })).toContain('журнал не прочитался');
    const long = buildReport({ ...base, what: 'игрок', log: [{ at: 0, kind: 'crash', message: 'x'.repeat(REPORT_MAX) }] });
    expect(long.length).toBe(REPORT_MAX);
    expect(long.startsWith('Что не так\nигрок')).toBe(true);
  });
});

describe('журнал сбоев', () => {
  test('текст ошибки: имя, сообщение, начало стека', () => {
    const e = new TypeError('нет задачи');
    expect(crashText(e, 'TaskScreen')).toMatch(/^TaskScreen\nTypeError: нет задачи/);
    expect(crashText('строка')).toBe('строка');
  });
  test('из хранилища: мусор отбрасывается, записей не больше предела', () => {
    expect(parseCrashlog(null)).toEqual([]);
    expect(parseCrashlog('{')).toEqual([]);
    expect(parseCrashlog('[null, {"at":1}, {"at":2,"kind":"zzz","message":"m"}]')).toEqual([{ at: 2, kind: 'error', message: 'm' }]);
    const many = JSON.stringify(Array.from({ length: CRASH_MAX + 5 }, (_, i) => ({ at: i, kind: 'crash', message: String(i) })));
    expect(parseCrashlog(many)).toHaveLength(CRASH_MAX);
  });
});
