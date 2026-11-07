// Ход решения (src/engine/play.ts): ошибка считается, верные буквы остаются, подсказка бесплатна
// и считается, «Показать ответ» решает за игрока (docs/08-game-design.md, «Как решается задача»).
import { describe, expect, test } from 'bun:test';
import { endingChoices, endingPick, extraPick, gapErase, gapTap, gapTiles, partsPick, partsShuffled, showAnswer, startPlay, takeHint, type Task } from '../../src/engine';

const base = { level: 1 as const, proverb: 'dal.test.1.1', section: 'Проба' };
const gap: Task = { ...base, id: 't.test.1', kind: 'gap', text: 'Тише едешь — дальше будешь.', word: 2 };

/** номер свободной плитки с буквой */
const tileOf = (task: Task, c: string, taken: (number | null)[]) => gapTiles(task).findIndex((t, i) => t === c && !taken.includes(i));

describe('пропущенное слово', () => {
  test('верно с первой попытки — без ошибок', () => {
    let p = startPlay(gap);
    for (const c of 'ДАЛЬШЕ') p = gapTap(gap, p, tileOf(gap, c, p.slots));
    expect(p.result).toEqual({ done: true, hints: 0, mistakes: 0, shown: false });
  });
  test('ошибка: верные буквы запираются, неверные возвращаются; стереть запертую нельзя', () => {
    let p = startPlay(gap);
    const tiles = gapTiles(gap);
    const wrong = tiles.findIndex(c => !'ДАЛЬШЕ'.includes(c));
    for (const c of 'ДАЛЬШ') p = gapTap(gap, p, tileOf(gap, c, p.slots));
    p = gapTap(gap, p, wrong);
    expect(p.result.mistakes).toBe(1);
    expect(p.wrong).toBe(true);
    expect(p.locked).toEqual([true, true, true, true, true, false]);
    expect(p.slots[5]).toBeNull();
    expect(gapErase(p, 0)).toBe(p);
    p = gapTap(gap, p, tileOf(gap, 'Е', p.slots));
    expect(p.result).toEqual({ done: true, hints: 0, mistakes: 1, shown: false });
  });
  test('подсказки до конца решают задачу и считаются', () => {
    let p = startPlay(gap);
    for (let i = 0; i < 6; i++) p = takeHint(gap, p);
    expect(p.result).toEqual({ done: true, hints: 6, mistakes: 0, shown: false });
    expect(takeHint(gap, p)).toBe(p);
  });
  test('показать ответ; решённая открывается с ответом и прежним итогом', () => {
    const p = showAnswer(gap, startPlay(gap));
    expect(p.result.shown).toBe(true);
    expect(p.slots.every(s => s != null)).toBe(true);
    const again = startPlay(gap, p.result);
    expect(again.result).toEqual(p.result);
    expect(again.slots).toEqual(p.slots);
  });
});

describe('другие виды', () => {
  const ending: Task = { ...base, id: 't.test.2', kind: 'ending', text: 'Тише едешь — дальше будешь.', cut: 2, wrong: ['не беда платить.', 'и каши не сварить.', 'к оттепели.'] };
  test('конец: неверный гаснет и считается, подсказка гасит два', () => {
    const wrong = endingChoices(ending).find(c => c !== 'дальше будешь.')!;
    let p = endingPick(ending, startPlay(ending), wrong);
    expect(p.result.mistakes).toBe(1);
    expect(endingPick(ending, p, wrong)).toBe(p);
    p = takeHint(ending, p);
    expect(new Set(p.dimmed).size).toBeGreaterThanOrEqual(2);
    expect(p.dimmed).not.toContain('дальше будешь.');
    p = endingPick(ending, p, 'дальше будешь.');
    expect(p.result.done).toBe(true);
  });
  const parts: Task = { ...base, id: 't.test.3', kind: 'parts', text: 'Не то хлеб, что в поле, а то, что в сусеке.', starts: [0, 3, 8] };
  test('по частям: неверная часть не встаёт', () => {
    let p = partsPick(parts, startPlay(parts), 1);
    expect(p.chosen).toEqual([]);
    expect(p.result.mistakes).toBe(1);
    for (const i of [0, 1, 2]) p = partsPick(parts, p, i);
    expect(p.result.done).toBe(true);
    expect(partsShuffled(parts).length).toBe(3);
  });
  const extra: Task = { ...base, id: 't.test.4', kind: 'extra', text: 'Тише едешь — дальше будешь.', word: 2, at: 2, letter: 'о' };
  test('лишняя буква: касание слова', () => {
    let p = extraPick(extra, startPlay(extra), 0);
    expect(p.result.mistakes).toBe(1);
    p = extraPick(extra, p, 2);
    expect(p.result).toEqual({ done: true, hints: 0, mistakes: 1, shown: false });
  });
});
