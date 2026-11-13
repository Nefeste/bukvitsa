// Ход решения (src/engine/play.ts) по 08-game-design.md: ряд букв, выбор из четырёх, найти в строке,
// расставить части; три подсказки по порядку; подсмотренная задача.
import { describe, expect, test } from 'bun:test';
import { EMPTY_RESULT, choose, clearRow, openHints, tapSlot, hint, nextHint, openWord, pickPart, place, startPlay, tapLetter, unplace, unpickPart, usedTiles, type Task } from '../../src/engine';

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
  test('буква встаёт на выбранное место; занятое место по касанию освобождается и остаётся выбранным', () => {
    let p = tapSlot(startPlay(proverb), 3);
    expect(p.at).toBe(3);
    p = place(proverb, p, tileOf(proverb, 'е', usedTiles(p)));
    expect(p.slots.map(s => (s == null ? '' : proverb.row![s]))).toEqual(['', '', '', 'е', '', '']);
    expect(p.at).toBeNull();
    // без выбора — на первое свободное
    p = place(proverb, p, tileOf(proverb, 'н', usedTiles(p)));
    expect(p.slots[0]).not.toBeNull();
    p = tapSlot(p, 3);
    expect(p.slots[3]).toBeNull();
    expect(p.at).toBe(3);
    expect(tapSlot(tapSlot(startPlay(proverb), 2), 2).at).toBeNull();
    // слово, набранное не по порядку, проверяется так же
    let q = startPlay(proverb);
    for (const [slot, c] of [[5, 'о'], [0, 'н'], [4, 'г'], [1, 'е'], [3, 'е'], [2, 'ч']] as [number, string][]) q = place(proverb, tapSlot(q, slot), tileOf(proverb, c, usedTiles(q)));
    expect(q.result).toEqual({ done: true, tries: 1, hints: 0, peeked: false });
  });
  test('подсказки на выбор: сперва «Открыть букву» на выбранном месте, потом «Убрать лишние»; ответ — после обеих', () => {
    let p = startPlay(proverb);
    expect(openHints(proverb, p)).toEqual([1, 2]);
    p = hint(proverb, tapSlot(p, 2), 2);
    expect(p.locked).toEqual([false, false, true, false, false, false]);
    expect(proverb.row![p.slots[2]!]).toBe('ч');
    expect(openHints(proverb, p)).toEqual([1]);
    expect(hint(proverb, p, 2)).toBe(p);
    expect(hint(proverb, p, 3)).toBe(p);
    p = hint(proverb, p, 1);
    expect(p.slots[2]).not.toBeNull();
    expect(openHints(proverb, p)).toEqual([3]);
    p = type(proverb, 'неего', p);
    expect(p.result).toEqual({ done: true, tries: 1, hints: 2, peeked: false });
  });
  test('«Очистить» возвращает буквы игрока; открытая подсказкой остаётся', () => {
    let p = hint(proverb, startPlay(proverb), 2);
    p = type(proverb, 'ече', p);
    p = clearRow(p);
    expect(p.slots.filter(s => s != null)).toHaveLength(1);
    expect(p.locked[0]).toBe(true);
    expect(clearRow(p)).toBe(p);
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

describe('конец пословицы — тот же выбор из четырёх', () => {
  const ending: Task = { ...base, id: 'ending-9001', kind: 'ending', prompt: 'Тише едешь — …', answer: 'дальше будешь', options: ['не в руке', 'дальше будешь', 'зубам здорово', 'лишние слезы'] };
  test('подсказки: два неверных гаснут, потом первое слово, потом ответ', () => {
    let p = hint(ending, startPlay(ending));
    expect(p.dimmed.length).toBe(2);
    expect(p.dimmed).not.toContain(1);
    p = hint(ending, p);
    expect(p.first).toBe('дальше');
    p = choose(ending, p, 1);
    expect(p.result).toEqual({ done: true, tries: 1, hints: 2, peeked: false });
  });
  test('три неверных — подсмотрена', () => {
    let p = startPlay(ending);
    for (const i of [0, 2, 3]) p = choose(ending, p, i);
    expect(p.result.peeked).toBe(true);
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

describe('по частям: равноправные части', () => {
  const t: Task = { id: 'parts-9002', version: 1, kind: 'parts', prompt: '', answer: '0,1,2', also: ['0,2,1'], parts: ['бабка надвое сказала', 'либо сын', 'либо дочь'], text: 'Бабка надвое сказала: либо сын, либо дочь.', about: 'о', source: 'Даль' };
  const put = (order: number[]) => order.reduce((p, i) => pickPart(t, p, i), startPlay(t, EMPTY_RESULT));
  test('оба порядка равноправных частей верны, третий — нет', () => {
    expect(put([0, 1, 2]).result.done).toBe(true);
    expect(put([0, 2, 1]).result.done).toBe(true);
    expect(put([1, 0, 2]).result.done).toBe(false);
  });
});
