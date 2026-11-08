// Значок магазина и баннер RuStore — кодом (ADR устава 0023, правило 3), как значок приложения (tools/art/icon.ts):
// буквица «Б» кумачом в рамке льняной нити на бумаге; на баннере за ней — «уквица» шрифтом Kurale, строка о игре
// шрифтом Onest и полоса-рушник. Шрифты — те же файлы, что в игре (SIL OFL 1.1). Цвета — токены студии.
//
//   bun tools/store/graphics.ts   — store/graphics/icon-512.png, feature-1024x500.png (их же берёт tools/store/shots.ts)
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Browser } from 'playwright';
import { LIGHT as C } from '../../src/ui/theme';
import { svg as iconSvg } from '../art/icon';
import { opaquePng } from './png';

const ROOT = join(import.meta.dir, '..', '..');
const FONTS = {
  Kurale: 'node_modules/@expo-google-fonts/kurale/400Regular/Kurale_400Regular.ttf',
  Onest: 'node_modules/@expo-google-fonts/onest/400Regular/Onest_400Regular.ttf',
};

/** Баннер 1024 × 500: лён, буквица слева, «уквица» и строка о игре, полоса-рушник по низу. */
export function featureSvg(): string {
  const w = 1024;
  const h = 500;
  const s = 260;
  const x = 150;
  const y = (h - s) / 2 - 36;
  // рушник: ромбы кумачом и елью по льну — та же нить, что в брендбуке, без картинок
  const band = Array.from({ length: 32 }, (_, i) => {
    const cx = 16 + i * 32 + 8;
    const cy = h - 34;
    return `<path d="M ${cx} ${cy - 10} L ${cx + 10} ${cy} L ${cx} ${cy + 10} L ${cx - 10} ${cy} Z" fill="${i % 2 ? C.spruce : C.kumach}"/>`;
  }).join('');
  const icon = iconSvg(s, 1, null).replace(/<svg[^>]*>/, `<svg x="${x}" y="${y}" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">`);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<rect width="${w}" height="${h}" fill="${C.linen}"/>
${icon}
<text x="${x + s + 18}" y="${y + s * 0.62}" font-family="Kurale" font-size="${s * 0.5}" fill="${C.ink}">уквица</text>
<text x="${x + s + 26}" y="${y + s * 0.62 + 58}" font-family="Onest" font-size="32" fill="${C.inkSoft}">пословицы, загадки</text>
<text x="${x + s + 26}" y="${y + s * 0.62 + 100}" font-family="Onest" font-size="32" fill="${C.inkSoft}">и старые слова по Далю</text>
<rect x="0" y="${h - 58}" width="${w}" height="2" fill="${C.line}"/>
${band}
</svg>`;
}

export async function renderGraphics(browser: Browser): Promise<void> {
  mkdirSync(join(ROOT, 'store/graphics'), { recursive: true });
  const face = Object.entries(FONTS)
    .map(([name, file]) => `@font-face{font-family:${name};src:url(data:font/ttf;base64,${readFileSync(join(ROOT, file)).toString('base64')})}`)
    .join('');
  const page = await browser.newPage();
  const render = async (body: string, w: number, h: number) => {
    await page.setViewportSize({ width: w, height: h });
    await page.setContent(`<html><head><style>${face}html,body{margin:0}</style></head><body>${body}</body></html>`);
    await page.evaluate(() => document.fonts.ready);
    return opaquePng(await page.screenshot({ clip: { x: 0, y: 0, width: w, height: h } }));
  };
  writeFileSync(join(ROOT, 'store/graphics/icon-512.png'), await render(iconSvg(512, 0.84, C.linen), 512, 512));
  writeFileSync(join(ROOT, 'store/graphics/feature-1024x500.png'), await render(featureSvg(), 1024, 500));
  await page.close();
}

if (import.meta.main) {
  const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
  try {
    await renderGraphics(browser);
  } finally {
    await browser.close();
  }
  console.log('store/graphics: icon-512.png, feature-1024x500.png');
}
