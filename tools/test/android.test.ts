// Плагины Android из «Нард» (nardy @ 1d2bdff): резервная копия — только база AsyncStorage (docs/04-data-model.md,
// «Как сделано в 0.2»); заставка без белой вспышки — правило устава «Заставка при запуске» (решение владельца 07.11.2026).
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(import.meta.dir, '../..');
const app = JSON.parse(readFileSync(join(ROOT, 'app.json'), 'utf8')) as {
  expo: { userInterfaceStyle: string; android: { allowBackup: boolean }; plugins: (string | unknown[])[] };
};
const names = app.expo.plugins.map(p => (Array.isArray(p) ? (p[0] as string) : p));

describe('резервная копия', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { transforms: t } = require('../../plugins/with-backup.js') as {
    transforms: { manifest: (m: object) => { manifest: { $: Record<string, string>; application: { $: Record<string, string> }[] } }; LEGACY: string; RULES: string; FILES: string[] };
  };

  test('в копию — только база AsyncStorage с журналами, и в облако, и при переносе на новый телефон', () => {
    expect(t.FILES).toEqual(['RKStorage', 'RKStorage-journal', 'RKStorage-wal']);
    const includes = (xml: string) => [...xml.matchAll(/<include domain="([a-z]+)" path="([^"]+)" \/>/g)].map(m => `${m[1]}:${m[2]}`);
    const db = t.FILES.map(f => `database:${f}`);
    expect(includes(t.LEGACY)).toEqual(db);
    expect(includes(t.RULES)).toEqual([...db, ...db]);
    for (const xml of [t.LEGACY, t.RULES]) expect(xml).not.toContain('<exclude');
  });

  test('манифест: копия включена, наши правила главнее правил библиотек', () => {
    const m = { manifest: { $: {}, application: [{ $: { 'android:name': '.MainApplication', 'android:allowBackup': 'false' } }] } };
    const a = t.manifest(m).manifest.application[0].$;
    expect(a['android:allowBackup']).toBe('true');
    expect(a['android:fullBackupContent']).toBe('@xml/bukvitsa_backup_rules');
    expect(a['android:dataExtractionRules']).toBe('@xml/bukvitsa_data_extraction_rules');
    expect(a['tools:replace'].split(',').sort()).toEqual(['android:allowBackup', 'android:dataExtractionRules', 'android:fullBackupContent']);
  });

  test('app.json: копия включена и плагин подключён', () => {
    expect(app.expo.android.allowBackup).toBe(true);
    expect(names).toContain('./plugins/with-backup');
  });
});

describe('заставка и тема', () => {
  test('у темы заставки фон окна — фон заставки; плагин стоит перед expo-splash-screen', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { transforms: t } = require('../../plugins/with-splash-window.js') as {
      transforms: { styles: (x: { resources: { style: { $: { name: string }; item?: { $: { name: string }; _: string }[] }[] } }) => { resources: { style: { $: { name: string }; item?: { $: { name: string }; _: string }[] }[] } }; THEME: string; ITEM: string };
    };
    const xml = { resources: { style: [{ $: { name: t.THEME }, item: [{ $: { name: t.ITEM }, _: '@android:color/white' }] }] } };
    expect(t.styles(xml).resources.style[0].item!.filter(i => i.$.name === t.ITEM).map(i => i._)).toEqual(['@color/splashscreen_background']);
    expect(names.indexOf('./plugins/with-splash-window')).toBeGreaterThanOrEqual(0);
    expect(names.indexOf('./plugins/with-splash-window')).toBeLessThan(names.indexOf('expo-splash-screen'));
  });

  test('тема — как в телефоне: без этого Android всегда отвечает «светлая» (src/state/game.ts, useColorScheme)', () => {
    expect(app.expo.userInterfaceStyle).toBe('automatic');
  });
});
