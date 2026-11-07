// «Меньше движения» для рисунков (ADR устава 0023, правило 6): снег и дым стоят, страницы
// комикса и коробки кладовой появляются сразу. Значение ставит партия (src/state/game.ts) из
// настроек игрока или системы; рисунки читают его хуком, без передачи через экраны.
import { useSyncExternalStore } from 'react';

let less = false;
const subs = new Set<() => void>();

export function setLessMotion(value: boolean): void {
  if (value === less) return;
  less = value;
  subs.forEach(f => f());
}

function subscribe(f: () => void): () => void {
  subs.add(f);
  return () => { subs.delete(f); };
}

const get = () => less;

export function useLessMotion(): boolean {
  return useSyncExternalStore(subscribe, get, get);
}
