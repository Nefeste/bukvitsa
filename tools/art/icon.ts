// Значок и заставка «Буквицы» — рисунок кодом (ADR устава 0023, правило 3: рисунок — скрипт с паспортом).
// Буквица «Б» шрифтом Kurale (OFL, как в игре) кумачом на бумаге, уголки — льняная нить, как у src/ui/Initial.tsx.
// Цвета — токены студии (src/ui/theme.ts). Рисует Chromium без окна (Playwright); паспорт — assets/LICENSES.md.
//
//   bun tools/art/icon.ts      — assets/icon.png, assets/adaptive-icon.png, assets/splash-icon.png и паспорт
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { C } from '../../src/ui/theme';

const ROOT = join(import.meta.dir, '..', '..');
const FONT = join(ROOT, 'node_modules/@expo-google-fonts/kurale/400Regular/Kurale_400Regular.ttf');

/** Буквица в квадрате `size`: доля `scale` — сколько занимает рамка (у адаптивного значка — внутри безопасного круга). */
export function svg(size: number, scale: number, background: string | null, frame = true): string {
  const s = size * scale;
  const o = (size - s) / 2;
  const c = s * 0.18;
  const w = Math.max(2, s * 0.028);
  const corner = ([x, y, dx, dy]: number[]) =>
    `<path d="M ${x + dx * w * 2} ${y + dy * (c + w * 2)} L ${x + dx * w * 2} ${y + dy * w * 2} L ${x + dx * (c + w * 2)} ${y + dy * w * 2} M ${x + dx * w * 4} ${y + dy * w * 4} q ${dx * c * 0.5} 0 ${dx * c * 0.5} ${dy * c * 0.5}" stroke="${C.flax}" stroke-width="${w}" fill="none" stroke-linecap="round"/>`;
  const corners = [
    [o, o, 1, 1],
    [o + s, o, -1, 1],
    [o, o + s, 1, -1],
    [o + s, o + s, -1, -1],
  ].map(corner).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
${background ? `<rect width="${size}" height="${size}" fill="${background}"/>` : ''}
${frame ? `<rect x="${o}" y="${o}" width="${s}" height="${s}" rx="${s * 0.1}" fill="${C.paper}" stroke="${C.line}" stroke-width="${w * 0.6}"/>${corners}` : ''}
<text x="${size / 2}" y="${size / 2}" dy="0.35em" text-anchor="middle" font-family="Kurale" font-size="${s * 0.66}" fill="${C.kumach}">Б</text>
</svg>`;
}

const FILES: { file: string; size: number; scale: number; background: string | null; frame?: boolean }[] = [
  // значок магазина и старых Android — во весь квадрат на льне
  { file: 'icon.png', size: 1024, scale: 0.84, background: C.linen },
  // передний слой адаптивного значка: 108 dp, безопасный круг — 66 dp (радиус 0,306 стороны); углы рамки
  // 0,43 стороны — на радиусе 0,304, внутри круга; фон слоя — лён (app.json)
  { file: 'adaptive-icon.png', size: 1024, scale: 0.43, background: null },
  // заставка Android 12+: картинка в круге на льне
  { file: 'splash-icon.png', size: 512, scale: 0.7, background: null },
];

async function main() {
  const font = readFileSync(FONT).toString('base64');
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  const lines: string[] = [];
  try {
    const page = await browser.newPage();
    for (const f of FILES) {
      await page.setViewportSize({ width: f.size, height: f.size });
      await page.setContent(
        `<html><head><style>@font-face{font-family:Kurale;src:url(data:font/ttf;base64,${font})}html,body{margin:0;background:transparent}</style></head><body>${svg(f.size, f.scale, f.background, f.frame ?? true)}</body></html>`,
      );
      await page.evaluate(() => document.fonts.ready);
      const png = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: f.size, height: f.size } });
      writeFileSync(join(ROOT, 'assets', f.file), png);
      lines.push(`| \`assets/${f.file}\` | ${f.size} × ${f.size} | \`${createHash('sha256').update(png).digest('hex')}\` |`);
    }
  } finally {
    await browser.close();
  }
  writeFileSync(
    join(ROOT, 'assets', 'LICENSES.md'),
    `# Паспорт картинок «Буквицы»

Сделано скриптом \`bun tools/art/icon.ts\` (ADR устава 0023, правило 3) — не править руками. Буква — шрифт Kurale
(SIL OFL 1.1, пакет \`@expo-google-fonts/kurale\`, тот же, что в игре), цвета — токены студии (\`src/ui/theme.ts\`).
Рисует Chromium без окна (Playwright ${(await import('playwright/package.json')).version}); другая версия Chromium может дать другие байты —
тогда паспорт пересобирается этим же скриптом.

| Файл | Размер | SHA-256 |
|---|---|---|
${lines.join('\n')}
`,
  );
  console.log(lines.join('\n'));
}

if (import.meta.main) await main();
