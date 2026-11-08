// Материалы для RuStore и сайта (store/README.md; устав, docs/08-publishing.md, «Формат store/site/»): длины
// текстов карточки, поля страницы сайта и их пределы, картинки нужной формы, значок без прозрачности, 3–8 снимков 9 : 16.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { pngInfo } from '../store/png';

const ROOT = join(import.meta.dir, '../..');
const STORE = join(ROOT, 'store');
const png = (path: string) => pngInfo(new Uint8Array(readFileSync(join(STORE, path))));

function sections(file: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const part of readFileSync(join(STORE, file), 'utf8').split(/^## /m).slice(1)) {
    const [title, ...body] = part.split('\n');
    out.set(title.replace(/\s*\(.*\)$/, '').trim(), body.join('\n').trim());
  }
  return out;
}

describe('карточка RuStore', () => {
  test('разделы есть, длины в пределах RuStore', () => {
    const s = sections('listing.ru.md');
    for (const [title, max] of [['Название', 50], ['Краткое описание', 80], ['Полное описание', 4000], ['Что нового', 500]] as const) {
      const text = s.get(title);
      expect(text, `нет раздела «${title}»`).toBeDefined();
      expect(text!.length, `«${title}»: ${text!.length} знаков`).toBeLessThanOrEqual(max);
      expect(text!.length).toBeGreaterThan(0);
    }
    expect(s.get('Ключевые слова')).toBeDefined();
  });
  test('в текстах нет того, чего нет в игре: загадок Садовникова и обещания «без слежки»', () => {
    for (const f of ['listing.ru.md', 'site/page.ru.md']) {
      const t = readFileSync(join(STORE, f), 'utf8');
      expect(t, f).not.toContain('Садовников');
      expect(t, f).not.toContain('слежки');
    }
  });
});

describe('страница на сайте', () => {
  for (const lang of ['ru', 'en']) {
    const raw = readFileSync(join(STORE, `site/page.${lang}.md`), 'utf8');
    const [, front, body] = raw.split(/^---$/m);
    const f = parse(front) as Record<string, unknown> & { shots: { file: string; caption: string; alt: string }[]; card: { text: string; points: string[] } };
    test(`${lang}: поля и их пределы`, () => {
      const lim: [string, number][] = [['title', 60], ['description', 220], ['kind', 40], ['lead', 160]];
      for (const [k, max] of lim) expect(String(f[k] ?? '').length, k).toBeLessThanOrEqual(max);
      expect(['dev', 'test', 'live']).toContain(f.status as string);
      expect(f.card.text.length).toBeLessThanOrEqual(240);
      expect(f.card.points.length).toBeGreaterThanOrEqual(2);
      expect(f.card.points.length).toBeLessThanOrEqual(4);
      for (const p of f.card.points) expect(p.length, p).toBeLessThanOrEqual(80);
      expect(body).not.toMatch(/<[a-z]/i);
      for (const m of body.matchAll(/\]\(([^)]+)\)/g)) expect(m[1]).toMatch(/^(https:\/\/|mailto:)/);
    });
    test(`${lang}: значок, баннер, 3–8 снимков 9 : 16 с подписью и alt`, () => {
      expect(png(f.icon as string)).toEqual({ width: 512, height: 512, colorType: 2 });
      expect(png(f.feature as string)).toMatchObject({ width: 1024, height: 500 });
      expect(f.shots.length).toBeGreaterThanOrEqual(3);
      expect(f.shots.length).toBeLessThanOrEqual(8);
      for (const s of f.shots) {
        expect(existsSync(join(STORE, s.file)), s.file).toBe(true);
        const { width, height } = png(s.file);
        expect(width * 16, s.file).toBe(height * 9);
        expect(width).toBeGreaterThanOrEqual(540);
        expect(s.caption.length, s.caption).toBeLessThanOrEqual(30);
        expect(s.alt.length, s.alt).toBeGreaterThan(0);
        expect(s.alt.length, s.alt).toBeLessThanOrEqual(160);
      }
    });
  }
  test('все снимки папки — на странице, и не больше 3 МБ', () => {
    const files = readdirSync(join(STORE, 'screenshots/ru')).filter(f => f.endsWith('.png'));
    const ru = readFileSync(join(STORE, 'site/page.ru.md'), 'utf8');
    for (const f of files) {
      expect(ru, f).toContain(`screenshots/ru/${f}`);
      expect(readFileSync(join(STORE, 'screenshots/ru', f)).length).toBeLessThan(3 * 1024 * 1024);
    }
  });
});
