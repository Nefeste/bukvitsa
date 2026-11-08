// «Тайнопись» (ADR 0009, specs/2026-11-cipher.md): движок — буква на все клетки числа, одна буква — одно число,
// открытые не меняются, проверка при заполненном поле, три подсказки; сборка — числа и открытые буквы от
// sha256(id:version) по правилу 08-game-design.md; «виртуальный игрок» ловит второй ответ.
import { describe, expect, test } from 'bun:test';
import { cipherKey, eraseLetter, hint, nextHint, pinnedLetters, putLetter, selectCode, startPlay, textLetters, weekday, type Task } from '../../src/engine';
import { CIPHER, cipherOf, cipherProblem } from '../content/cipher';
import { cipherRivals } from '../content/play';
import { PACK } from '../../src/content/generated/pack';
import { words } from '../../src/engine/words';

const TEXT = 'Не пори, когда шить не знаешь.';
/** Задача вручную: Н=1 Е=2 П=3 О=4 Р=5 И=6 К=7 Г=8 Д=9 А=10 Ш=11 Т=12 З=13 Ь=14; открыты Е и О. */
function task(open = [2, 4]): Task {
  const letters = textLetters(TEXT);
  const order = [...new Set(letters)];
  return { id: 'cipher-test', version: 1, kind: 'cipher', prompt: '', answer: letters.join(''), text: TEXT, about: '', source: '', code: letters.map(c => order.indexOf(c) + 1), open };
}
/** Поставить буквы по порядку текста, кроме открытых. */
function fill(t: Task, wrongAt?: string) {
  let p = startPlay(t);
  const key = cipherKey(t);
  for (let n = 1; n <= key.length; n++) {
    if (p.pinned[n - 1]) continue;
    p = selectCode(p, n);
    p = putLetter(t, p, wrongAt === key[n - 1] ? 'Я' : key[n - 1]);
  }
  return p;
}

describe('движок', () => {
  test('открытые с начала — на местах; выбор — первая пустая клетка', () => {
    const t = task();
    const p = startPlay(t);
    expect(p.marks[1]).toBe('Е');
    expect(p.marks[3]).toBe('О');
    expect(p.pinned.filter(Boolean)).toHaveLength(2);
    expect(p.sel).toBe(1);
    expect(selectCode(p, 2)).toBe(p); // открытое не выбирается
    expect([...pinnedLetters(p)].sort()).toEqual(['Е', 'О']);
  });
  test('буква — во все клетки числа; одна буква — одно число; открытую не поставить; «Стереть»', () => {
    const t = task();
    let p = startPlay(t);
    p = putLetter(t, p, 'н');
    expect(p.marks[0]).toBe('Н');
    expect(p.sel).toBe(3); // дальше по тексту: «Не» — Е открыта, следом П
    p = putLetter(t, p, 'Н');
    expect(p.marks[0]).toBeNull(); // Н переехала на 3
    expect(p.marks[2]).toBe('Н');
    expect(putLetter(t, p, 'О')).toBe(p);
    p = selectCode(p, 3);
    p = eraseLetter(p);
    expect(p.marks[2]).toBeNull();
  });
  test('заполнено верно — решена с первой попытки; неверно — встряхивание, буквы остаются, попытка засчитана', () => {
    const ok = fill(task());
    expect(ok.result).toEqual({ done: true, tries: 1, hints: 0, peeked: false });
    const bad = fill(task(), 'Т');
    expect(bad.result.done).toBe(false);
    expect(bad.shake).toBe(true);
    expect(bad.result.tries).toBe(1);
    expect(bad.marks.every(m => m != null)).toBe(true);
  });
  test('подсказки: убрать неверные (или «всё верно»), открыть букву по тексту, показать ответ', () => {
    const t = task();
    let p = startPlay(t);
    expect(nextHint(t, p)).toBe(1);
    p = putLetter(t, p, 'Я'); // на число 1 (Н) — неверно
    p = hint(t, p);
    expect(p.marks[0]).toBeNull();
    expect(p.clean).toBe(false);
    expect(nextHint(t, p)).toBe(2);
    p = hint(t, p);
    expect(p.marks[0]).toBe('Н'); // первая по тексту пустая — «Н»
    expect(p.pinned[0]).toBe(true);
    expect(nextHint(t, p)).toBe(3);
    p = hint(t, p);
    expect(p.result).toMatchObject({ done: true, peeked: true, hints: 2 });
    expect(p.marks).toEqual(cipherKey(t));
    const clean = hint(t, putLetter(t, startPlay(t), 'Н'));
    expect(clean.clean).toBe(true);
  });
  test('решённая открывается с ответом, подсмотренная — заново', () => {
    const t = task();
    expect(startPlay(t, { done: true, tries: 1, hints: 0, peeked: false }).marks).toEqual(cipherKey(t));
    expect(startPlay(t, { done: true, tries: 1, hints: 2, peeked: true }).marks.filter(Boolean)).toHaveLength(2);
  });
});

describe('сборка', () => {
  test('числа и открытые буквы — одинаковые при одинаковых id:version, другие при новой version', () => {
    const a = cipherOf(TEXT, 'cipher-0001', 1);
    expect(cipherOf(TEXT, 'cipher-0001', 1)).toEqual(a);
    expect(cipherOf(TEXT, 'cipher-0001', 2)).not.toEqual(a);
  });
  test('правило открытых букв: доля клеток, 2–5 букв, слово из трёх букв целиком не открыто', () => {
    for (const t of PACK.tasks.filter(x => x.kind === 'cipher')) {
      const ls = textLetters(t.text);
      const key = cipherKey(t);
      const open = new Set((t.open ?? []).map(n => key[n - 1]));
      expect(open.size).toBeGreaterThanOrEqual(CIPHER.open[0]);
      expect(open.size).toBeLessThanOrEqual(CIPHER.open[1]);
      expect(ls.filter(c => open.has(c)).length).toBeGreaterThanOrEqual(CIPHER.share * ls.length);
      for (const w of words(t.text).map(textLetters)) if (w.length >= CIPHER.wholeWord) expect(w.every(c => open.has(c))).toBe(false);
      // числа — перестановка 1…N
      expect([...new Set(t.code)].sort((x, y) => x - y)).toEqual(key.map((_, i) => i + 1));
    }
  });
  test('ограничения записи', () => {
    expect(cipherProblem(TEXT)).toBeNull();
    expect(cipherProblem('Не пори, коли шить.')).toMatch(/букв/);
    expect(cipherProblem('Не пори, когда шить «не» знаешь.')).toMatch(/кавычки/);
    expect(cipherProblem('Не перепортивши, никогда шить не выучишься')).toMatch(/длиннее/);
  });
  test('суббота календаря — тайнопись; в первой тетради — шесть', () => {
    const kinds = new Map(PACK.tasks.map(t => [t.id, t.kind]));
    const sat = Object.entries(PACK.calendar.days).filter(([d]) => weekday(d) === 5);
    expect(sat.every(([, id]) => kinds.get(id) === 'cipher')).toBe(true);
    expect(PACK.notebooks.find(b => b.key === 'first')!.tasks.filter(id => kinds.get(id) === 'cipher')).toHaveLength(6);
  });
});

describe('виртуальный игрок', () => {
  test('второй ответ с тем же узором чисел ловится; при отличающей открытой букве — нет', () => {
    const t = task([2, 4]);
    // «Не пури, кугда…» (все О заменены на У): О открыта — не подходит; без открытой О — подходит
    expect(cipherRivals(t, ['Не пури, кугда шить не знаешь.'])).toEqual([]);
    expect(cipherRivals(task([2]), ['Не пури, кугда шить не знаешь.'])).toEqual(['Не пури, кугда шить не знаешь.']);
    // одна буква на два числа — не соперник
    expect(cipherRivals(task([2]), ['Не пони, когда шить не знаешь.'])).toEqual([]);
  });
});
