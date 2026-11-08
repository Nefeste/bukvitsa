// из gornitsa: brand/tokens.css @ 66dcc2c (через shelter: src/ui/theme.ts @ fa04538) — не править здесь.
// Цвета названы нитями вышивки: лён и бумага — ткань, чернила — текст, кумач и ель — нити. Своих
// цветов у «Буквицы» нет (ADR устава 0023, правило 4): плитки букв — бумага, верное — ель, буквица — кумач.
// Тёмная тема — «горница вечером» из того же файла токенов: те же нити на тёмной ткани.
import { useSyncExternalStore } from 'react';

export interface Palette {
  linen: string;
  paper: string;
  ink: string;
  inkSoft: string;
  line: string;
  /** пустая клетка: место под букву */
  cell: string;
  kumach: string;
  kumachInk: string;
  spruce: string;
  /** только украшение, не для текста на светлом */
  flax: string;
  dark: boolean;
}

export const LIGHT: Palette = {
  linen: '#ecede6',
  paper: '#f7f7f2',
  ink: '#1a1b1e',
  inkSoft: '#4b4f4c',
  line: '#cfd1c6',
  cell: '#d9dbd1',
  kumach: '#b3162f',
  kumachInk: '#ffffff',
  spruce: '#1f3c34',
  flax: '#a8904f',
  dark: false,
};

export const DARK: Palette = {
  linen: '#111816',
  paper: '#18211e',
  ink: '#e9e8e0',
  inkSoft: '#a9aea7',
  line: '#2c3833',
  cell: '#1f2a26',
  kumach: '#e5566a',
  kumachInk: '#16090c',
  spruce: '#7fb3a3',
  flax: '#d2bd84',
  dark: true,
};

/** Светлые цвета — для значка, заставки и всего, что рисуется до первого экрана. */
export const C = LIGHT;

export const R = { button: 6, card: 10, tile: 6, pill: 999 } as const;

/** Шкала текста бренда в точках (1rem = 16). */
export const S = { small: 14, body: 17, lead: 21, title: 28, hero: 36 } as const;

/** «Ещё крупнее» (08-game-design.md, «Вид»): текст и плашки ×1,25. */
export const BIGGER = 1.25;

/** Что сейчас на экране: палитра и масштаб. `z(n)` — размер с учётом «ещё крупнее». */
export interface Look {
  c: Palette;
  k: number;
  z: (n: number) => number;
}

const make = (c: Palette, k: number): Look => ({ c, k, z: n => Math.round(n * k) });

let look: Look = make(LIGHT, 1);
const subs = new Set<() => void>();

/** Ставит партия (src/state/game.ts) из настроек игрока и темы телефона. */
export function setLook(dark: boolean, bigger: boolean): void {
  const c = dark ? DARK : LIGHT;
  const k = bigger ? BIGGER : 1;
  if (look.c === c && look.k === k) return;
  look = make(c, k);
  subs.forEach(f => f());
}

function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => {
    subs.delete(f);
  };
}

const get = () => look;

export function useLook(): Look {
  return useSyncExternalStore(subscribe, get, get);
}

/**
 * Стили экрана от палитры и масштаба: `const useStyles = themed((c, z) => StyleSheet.create({...}))`,
 * в компоненте — `const styles = useStyles()`. Считаются один раз на каждый вид.
 */
export function themed<T>(f: (c: Palette, z: (n: number) => number) => T): () => T {
  const cache = new Map<Look, T>();
  return function useStyles() {
    const l = useLook();
    let s = cache.get(l);
    if (!s) {
      cache.clear();
      s = f(l.c, l.z);
      cache.set(l, s);
    }
    return s;
  };
}
