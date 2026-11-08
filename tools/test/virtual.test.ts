// «Виртуальный игрок» (tools/content/play.ts): правила на образцах и весь content/ без ошибок.
import { describe, expect, test } from 'bun:test';
import type { Task } from '../../src/engine';
import { extraLetterTwins, gapNeighbours, optionProblems, partsRivals, play, rowAlternatives } from '../content/play';

const base = { version: 1, text: '', about: '', source: '' };
const t = (x: Partial<Task>): Task => ({ id: 'x', kind: 'proverb', prompt: '', answer: '', ...base, ...x }) as Task;

describe('виртуальный игрок', () => {
  test('ряд: другое слово той же длины из букв ряда', () => {
    const dict = new Map([[4, [['дело', 10], ['доля', 5], ['дуло', 3]] as [string, number][]]]);
    expect(rowAlternatives(t({ answer: 'дело', row: [...'ядиеол'] }), dict)).toEqual([['доля', 5]]);
    expect(gapNeighbours(t({ prompt: 'Делу время, ____ час.' }))).toEqual(['время', 'час']);
  });
  test('лишняя буква рядом с такой же — касание соседней даёт то же слово', () => {
    expect(extraLetterTwins(t({ kind: 'extra-letter', words: ['Не', 'спешша'], answer: '1:4' }))).toEqual([3]);
    expect(extraLetterTwins(t({ kind: 'extra-letter', words: ['Не', 'спеоша'], answer: '1:3' }))).toEqual([]);
  });
  test('варианты: четыре, разные, ответ один раз, длины не больше чем вдвое', () => {
    expect(optionProblems(t({ kind: 'ending', answer: 'мало спать', options: ['мало спать', 'к ненастью', 'все негодно', 'обойденыш'] }))).toEqual([]);
    expect(optionProblems(t({ kind: 'ending', answer: 'а', options: ['а', 'а', 'бб', 'в'] })).length).toBeGreaterThan(0);
    expect(optionProblems(t({ kind: 'ending', answer: 'кот', options: ['кот', 'пес', 'мышь', 'по подлавочью наваляется'] }))).toEqual(['длины вариантов 3–24: больше чем вдвое']);
  });
  test('части: порядок, который читается не хуже верного', () => {
    const parts = ['Тише едешь —', 'дальше будешь.', 'Дальше едешь —'];
    expect(partsRivals(t({ kind: 'parts', parts, answer: '0,1,2' }), new Map()).length).toBeGreaterThan(0);
    expect(partsRivals(t({ kind: 'parts', parts: ['Тише', 'едешь —', 'дальше будешь.'], answer: '0,1,2' }), new Map([['тише едешь', 5], ['едешь дальше', 5]]))).toEqual([]);
  });
  test('весь content/: ошибок нет', () => {
    const { findings, total } = play();
    expect(total).toBeGreaterThan(1000);
    expect(findings.filter(f => f.level === 'error')).toEqual([]);
  }, 30000);
});
