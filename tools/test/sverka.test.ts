// Лист сверки (tools/content/sverka.ts): первая тетрадь и задачи дня первых N дней, каждая запись — один раз, отмеченные
// `checked` — с галочкой; текст влезает в одну задачу GitHub (65 536 знаков).
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { sverka } from '../content/sverka';

const ROOT = join(import.meta.dir, '../..');

describe('лист сверки', () => {
  test('первая тетрадь и 70 дней задачи дня, без повторов; влезает в задачу GitHub', () => {
    const { md, total, done } = sverka(ROOT, 70);
    const ids = [...md.matchAll(/^- \[[ x]\] (?:\d{4}-\d\d-\d\d · )?`([^`]+)`/gm)].map(m => m[1]);
    expect(ids.length).toBe(total);
    expect(new Set(ids).size).toBe(ids.length);
    expect(md).toContain('## Первая тетрадь — 54 задачи');
    expect(md).toContain('(70 дней)');
    expect(done).toBe([...md.matchAll(/^- \[x\]/gm)].length);
    expect(md.length).toBeLessThan(65536);
  });
});
