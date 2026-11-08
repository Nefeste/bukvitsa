// Выпуск (tools/content/release.ts, released.ts): после выпуска запись не меняется без новой version, дата календаря —
// никогда; release.ts дописывает, но не переписывает выпущенное. Проверяется на копии content/ во временной папке,
// где все записи отмечены checked (в настоящем content/ отметку ставит только человек).
import { describe, expect, test } from 'bun:test';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from '../content/build';
import { calendarErrors, lockErrors, taskHash } from '../content/released';
import { release } from '../content/release';
import { parse } from 'yaml';
import type { Task } from '../../src/engine/types';

const ROOT = join(import.meta.dir, '../..');
const task: Task = { id: 'proverb-0001', version: 1, kind: 'proverb', prompt: 'Делу ____, потехе час.', answer: 'время', row: ['в', 'р'], text: 'Делу время, потехе час.', about: 'о', source: 'Даль' };

describe('отпечатки', () => {
  test('та же version — тот же отпечаток; любое видимое изменение — ошибка; новая version — можно', () => {
    const lock = { 'proverb-0001': { tag: 'v1.0.0', version: 1, sha256: taskHash(task) } };
    expect(lockErrors([task], lock)).toEqual([]);
    for (const changed of [{ ...task, answer: 'дело' }, { ...task, row: ['р', 'в'] }, { ...task, about: 'иначе' }])
      expect(lockErrors([changed], lock)[0]).toContain('изменилась');
    expect(lockErrors([{ ...task, version: 2, answer: 'дело' }], lock)).toEqual([]);
    expect(lockErrors([{ ...task, version: 0 }], { 'proverb-0001': { ...lock['proverb-0001'], version: 1 } })[0]).toContain('меньше выпущенной');
  });
  test('календарь: выпущенная дата не пропадает и не меняет запись; новые даты — можно', () => {
    const released = { '2026-12-01': 'riddle-0009' };
    expect(calendarErrors({ '2026-12-01': 'riddle-0009', '2026-12-02': 'ending-0001' }, released)).toEqual([]);
    expect(calendarErrors({ '2026-12-01': 'riddle-0010' }, released)).toHaveLength(1);
    expect(calendarErrors({}, released)).toHaveLength(1);
  });
  test('в настоящем content/ выпущенное не тронуто (золотой файл календаря и отпечатки)', () => {
    expect(build(ROOT).errors.filter(e => /выпущен/.test(e))).toEqual([]);
  });
});

describe('release.ts на копии content/', () => {
  test('выпуск записывает версии, отпечатки и даты; после него правка записи без version — ошибка сборки', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'bukvitsa-release-'));
    try {
      cpSync(join(ROOT, 'content'), join(tmp, 'content'), { recursive: true });
      mkdirSync(join(tmp, 'tools', 'test', 'fixtures'), { recursive: true });
      writeFileSync(join(tmp, 'tools', 'test', 'fixtures', 'calendar-released.json'), '{}');
      // только в копии: все записи «сверены», иначе выпускной набор пуст
      for (const dir of readdirSync(join(tmp, 'content')).filter(d => !d.includes('.') && d !== 'sources'))
        for (const f of readdirSync(join(tmp, 'content', dir)).filter(f => f.endsWith('.yaml'))) {
          const p = join(tmp, 'content', dir, f);
          writeFileSync(p, readFileSync(p, 'utf8').replace(/^review: draft$/m, 'review: checked'));
        }
      const r = release(tmp, 'v1.0.0', { today: '2026-12-01' });
      expect(r.ok).toBe(true);
      const released = JSON.parse(readFileSync(join(tmp, 'content', 'released.json'), 'utf8')) as Record<string, number>;
      const days = JSON.parse(readFileSync(join(tmp, 'tools', 'test', 'fixtures', 'calendar-released.json'), 'utf8')) as Record<string, string>;
      expect(Object.keys(released).length).toBeGreaterThan(1000);
      expect(days['2026-12-01']).toBe('riddle-0009');
      // правка выпущенной записи без новой version
      const p = join(tmp, 'content', 'proverbs', '0001.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^about: >\n(\s+)/m, 'about: >\n$1Правка. '));
      expect(build(tmp).errors.some(e => e.startsWith('proverb-0001: выпущенная в v1.0.0'))).toBe(true);
      expect(release(tmp, 'v1.0.1', { today: '2026-12-01' }).ok).toBe(false);
      // с новой version — выпускается снова
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^version: 1$/m, 'version: 2'));
      const again = release(tmp, 'v1.0.1', { today: '2026-12-01' });
      expect(again.ok && again.bumped).toBe(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);
});

describe('выпуск по ADR 0008 на копии content/', () => {
  /** Копия content/, где сверены первая тетрадь и задачи дня первых `days` дней календаря. */
  function partly(days: number): string {
    const tmp = mkdtempSync(join(tmpdir(), 'bukvitsa-adr8-'));
    cpSync(join(ROOT, 'content'), join(tmp, 'content'), { recursive: true });
    mkdirSync(join(tmp, 'tools', 'test', 'fixtures'), { recursive: true });
    writeFileSync(join(tmp, 'tools', 'test', 'fixtures', 'calendar-released.json'), '{}');
    const cal = parse(readFileSync(join(tmp, 'content', 'calendar.yaml'), 'utf8')) as { days: Record<string, string> };
    const want = new Set(Object.keys(cal.days).sort().slice(0, days).map(d => cal.days[d]));
    for (const dir of readdirSync(join(tmp, 'content')).filter(d => !d.includes('.') && d !== 'sources'))
      for (const f of readdirSync(join(tmp, 'content', dir)).filter(f => f.endsWith('.yaml'))) {
        const p = join(tmp, 'content', dir, f);
        const text = readFileSync(p, 'utf8');
        const id = /^id: (.+)$/m.exec(text)?.[1] ?? '';
        if (want.has(id) || /^notebooks:\s*(?:\[first|\n\s*- first)/m.test(text)) writeFileSync(p, text.replace(/^review: draft$/m, 'review: checked'));
      }
    return tmp;
  }

  test('сверены первая тетрадь и 61 день — выпуск проходит; в наборе ровно эти дни, черновики дальше не вошли', () => {
    const tmp = partly(61);
    try {
      const { pack, errors, report } = build(tmp, { release: true, today: '2026-12-01' });
      expect(errors).toEqual([]);
      expect(Object.keys(pack.calendar.days)).toHaveLength(61);
      expect(report.some(l => l.startsWith('выпуск: в календаре 61 сверенных дней подряд, с 2027-01-31 — черновик'))).toBe(true);
      expect(pack.notebooks.find(b => b.key === 'first')!.tasks.length).toBe(54);
      // остальные тетради не сверены целиком — пусты («В следующих версиях»), хоть одна запись и общая с первой
      expect(pack.notebooks.filter(b => b.key !== 'first').every(b => b.tasks.length === 0)).toBe(true);
      expect(report).toContain('выпуск: тетради first; остальные — «В следующих версиях»');
      const r = release(tmp, 'v1.0.0', { today: '2026-12-01' });
      expect(r.ok && r.days).toBe(61);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('в бесплатной тетради черновик — выпуск красный', () => {
    const tmp = partly(61);
    try {
      const p = join(tmp, 'content', 'ciphers', '0001.yaml');
      writeFileSync(p, readFileSync(p, 'utf8').replace(/^review: checked$/m, 'review: draft'));
      expect(build(tmp, { release: true, today: '2026-12-01' }).errors).toContain('тетрадь first: бесплатная, а не сверено 1 — в выпуск она идёт целиком');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);

  test('сверено 30 дней — запаса меньше 60, выпуск красный', () => {
    const tmp = partly(30);
    try {
      expect(build(tmp, { release: true, today: '2026-12-01' }).errors.some(e => e.startsWith('календарь: запас меньше 60 дней'))).toBe(true);
      expect(release(tmp, 'v1.0.0', { today: '2026-12-01' }).ok).toBe(false);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  }, 60000);
});
