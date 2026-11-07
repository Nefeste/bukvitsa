// из gornitsa: brand/tokens.css @ 66dcc2c (через shelter: src/ui/theme.ts @ fa04538) — не править здесь.
// Цвета названы нитями вышивки: лён и бумага — ткань, чернила — текст, кумач и ель — нити. Своих
// цветов у «Буквицы» нет (ADR устава 0023, правило 4): плитки букв — бумага, верное — ель, буквица — кумач.
export const C = {
  linen: '#ecede6',
  paper: '#f7f7f2',
  ink: '#1a1b1e',
  inkSoft: '#4b4f4c',
  line: '#cfd1c6',
  /** пустая клетка: место под букву */
  cell: '#d9dbd1',
  kumach: '#b3162f',
  kumachInk: '#ffffff',
  spruce: '#1f3c34',
  /** только украшение, не для текста на светлом */
  flax: '#a8904f',
} as const;

export const R = { button: 6, card: 10, tile: 6, pill: 999 } as const;

/** Шкала текста бренда в точках (1rem = 16). */
export const S = { small: 14, body: 17, lead: 21, title: 28, hero: 36 } as const;
