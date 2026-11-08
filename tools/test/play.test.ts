// Ход решения (src/engine/play.ts) по 08-game-design.md: ряд букв, выбор из четырёх, найти в строке,
// расставить части; три подсказки по порядку; подсмотренная задача.
import { describe, expect, test } from 'bun:test';
import { choose, hint, nextHint, openWord, pickPart, place, startPlay, tapLetter, unplace, unpickPart, usedTiles, type Task } from '../../src/engine';

const base = { version: 1, text: '', about: 'о', source: 'и' };
const proverb: Task = { ...base, id: 'proverb-9001', kind: 'proverb', prompt: 'Скучен день до вечера, коли делать ____.', answer: 'нечего', row: ['е', 'о', 'н', 'ч', 'т', 'г', 'е', 'а', 'о'] };
const tileOf = (t: Task, c: string, taken: Set<number>) => (t.row ?? []).findIndex((x, i) => x === c && !taken.has(i));

function type(t: Task, word: string, p = startPlay(t)) {
  for (const c of word) p = place(t, p, tileOf(t, c, usedTiles(p)));
  return p;
}

describe('ряд букв', () => {
  test('верно с первой попытки', () => {
    expect(type(proverb, 'нечего').result).toEqual({ done: true, tries: 1, hints: 0, peeked: false });
  });
  test('неверно — встряхивание, буквы остаются; игрок убирает сам; решена со второй попытки', () => {
    let p = type(proverb, 'нечеао');
    expect(p.shake).toBe(true);
    expect(p.result.tries).toBe(1);
    expect(p.slots.every(s => s != null)).toBe(true);
    p = unplace(p, 4);
    p = unplace(p, 5);
    p = type(proverb, 'го', p);
    expect(p.result).toEqual({ done: true, tries: 2, hints: 0, peeked: false });
  });
  test('подсказки по порядку: убрать лишние, открыть букву, показать ответ', () => {
    let p = startPlay(proverb);
    expect(nextHint(proverb, p)).toBe(1);
    p = hint(proverb, p);
    expect(p.hidden.length).toBe(3);
    expect(nextHint(proverb, p)).toBe(2);
    p = hint(proverb, p);
    expect(p.locked[0]).toBe(true);
    expect(unplace(p, 0)).toBe(p);
    p = type(proverb, 'ечего', p);
    expect(p.result).toEqual({ done: true, tries: 1, hints: 2, peeked: false });
  });
  test('третья подсказка — задача подсмотрена; подсмотренную можно решить заново', () => {
    let p = startPlay(proverb);
    for (let i = 0; i < 3; i++) p = hint(proverb, p);
    expect(p.result.peeked).toBe(true);
    expect(nextHint(proverb, p)).toBeNull();
    const again = startPlay(proverb, p.result);
    expect(again.result.done).toBe(false);
    const solved = startPlay(proverb, { done: true, tries: 1, hints: 0, peeked: false });
    expect(solved.slots.every(s => s != null)).toBe(true);
  });
});

describe('выбор из четырёх', () => {
  const word: Task = { ...base, id: 'word-9001', kind: 'old-word', prompt: 'стар. азбука, букварь', answer: 'буквица', options: ['пропись', 'буквица', 'устав', 'грамотка'] };
  test('неверный гаснет; после третьего неверного — подсмотрена', () => {
    let p = choose(word, startPlay(word), 0);
    expect(p.dimmed).toEqual([0]);
    p = choose(word, p, 2);
    p = choose(word, p, 3);
    expect(p.result.peeked).toBe(true);
  });
  test('подсказки: два неверных гаснут, потом первая буква; верный выбор', () => {
    let p = hint(word, startPlay(word));
    expect(p.dimmed.length).toBe(2);
    expect(p.dimmed).not.toContain(1);
    p = hint(word, p);
    expect(p.first).toBe('Б');
    p = choose(word, p, 1);
    expect(p.result).toEqual({ done: true, tries: 1, hints: 2, peeked: false });
  });
});

describe('найти в строке', () => {
  const extra: Task = { ...base, id: 'extra-letter-9001', kind: 'extra-letter', prompt: 'Не раброта сушит, а забота.', answer: '1:3', words: ['Не', 'раброта', 'сушит', 'а', 'забота'] };
  test('слово раскрывается по буквам, касание буквы — ответ; три неверных — подсмотрена', () => {
    let p = tapLetter(extra, startPlay(extra), 0);
    expect(p.result.tries).toBe(0); // слово не раскрыто — касание не считается
    p = openWord(p, 2);
    p = tapLetter(extra, p, 0);
    p = openWord(p, 1);
    p = tapLetter(extra, p, 3);
    expect(p.result).toEqual({ done: true, tries: 2, hints: 0, peeked: false });
    let q = openWord(startPlay(extra), 0);
    for (const k of [0, 1]) q = tapLetter(extra, q, k);
    q = openWord(q, 2);
    q = tapLetter(extra, q, 0);
    expect(q.result.peeked).toBe(true);
  });
  test('подсказка подсвечивает слово, вторая — ответ', () => {
    const p = hint(extra, startPlay(extra));
    expect(p.marked).toBe(1);
    expect(nextHint(extra, p)).toBe(3);
  });
});

describe('расставить части', () => {
  const parts: Task = { ...base, id: 'parts-9001', kind: 'parts', prompt: '', answer: '2,0,1', parts: ['что в поле, а то,', 'что в сусеке.', 'Не то хлеб,'] };
  test('всё собрано — проверка; неверно — части возвращаются', () => {
    let p = startPlay(parts);
    for (const i of [0, 1, 2]) p = pickPart(parts, p, i);
    expect(p.shake).toBe(true);
    expect(p.chosen).toEqual([]);
    for (const i of [2, 0, 1]) p = pickPart(parts, p, i);
    expect(p.result).toEqual({ done: true, tries: 2, hints: 0, peeked: false });
  });
  test('подсказка ставит первую часть, её не убрать', () => {
    let p = hint(parts, startPlay(parts));
    expect(p.chosen).toEqual([2]);
    expect(unpickPart(p, 0)).toBe(p);
    p = pickPart(parts, p, 0);
    p = pickPart(parts, p, 1);
    expect(p.result).toEqual({ done: true, tries: 1, hints: 1, peeked: false });
  });
});
