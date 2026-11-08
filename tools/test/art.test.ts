// Значок и заставка — из скрипта с паспортом (ADR устава 0023, правило 3): файл совпадает с SHA-256 паспорта,
// а app.json берёт именно эти файлы. Перерисовать — `bun tools/art/icon.ts`.
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');

describe('значок и заставка', () => {
  test('файлы совпадают с паспортом assets/LICENSES.md', () => {
    const rows = [...readFileSync(join(ROOT, 'assets/LICENSES.md'), 'utf8').matchAll(/\| `(assets\/[^`]+)` \| [^|]+ \| `([0-9a-f]{64})` \|/g)];
    expect(rows.length).toBe(3);
    for (const [, file, sha] of rows) expect({ file, sha: createHash('sha256').update(readFileSync(join(ROOT, file))).digest('hex') }).toEqual({ file, sha });
  });
  test('app.json: значок, адаптивный значок и заставка — эти файлы, фон — лён', () => {
    const e = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')).expo;
    expect(e.icon).toBe('./assets/icon.png');
    expect(e.android.adaptiveIcon).toEqual({ foregroundImage: './assets/adaptive-icon.png', backgroundColor: '#ECEDE6' });
    const splash = e.plugins.find((p: unknown) => Array.isArray(p) && p[0] === 'expo-splash-screen');
    expect(splash?.[1]?.image).toBe('./assets/splash-icon.png');
  });
});
