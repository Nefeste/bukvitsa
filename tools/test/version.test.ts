// из shelter: tools/test/version.test.ts @ fa04538 (оттуда — из nardy @ fd9b37c) — номер версии одинаков в app.json, package.json,
// package-lock.json, src/version.ts и STATUS.md, всегда X.Y.Z (docs/05-process.md, «Версии»), и у
// текущей версии есть раздел в README.md.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import app from '../../app.json';
import pkg from '../../package.json';
import lock from '../../package-lock.json';
import { APP_BUILD, APP_VERSION } from '../../src/version';

const SEMVER = /^\d+\.\d+\.\d+$/;
const root = join(import.meta.dir, '../..');

test('версия одна на всех', () => {
  expect(app.expo.version).toBe(APP_VERSION);
  expect(pkg.version).toBe(APP_VERSION);
  expect(lock.version).toBe(APP_VERSION);
  expect(lock.packages[''].version).toBe(APP_VERSION);
  expect(app.expo.android.versionCode).toBe(APP_BUILD);
  const status = readFileSync(join(root, 'STATUS.md'), 'utf8');
  expect(status.match(/^\*\*Версия:\*\* (\d+\.\d+\.\d+)/m)?.[1]).toBe(APP_VERSION);
});

test('версия — три числа X.Y.Z, у каждой в README свой раздел, у текущей тоже', () => {
  expect(APP_VERSION).toMatch(SEMVER);
  const readme = readFileSync(join(root, 'README.md'), 'utf8');
  const sections = [...readme.matchAll(/^### (\S+) — /gm)].map(m => m[1]);
  expect(sections.length).toBeGreaterThan(0);
  for (const v of sections) expect(v).toMatch(SEMVER);
  expect(sections).toContain(APP_VERSION);
});
