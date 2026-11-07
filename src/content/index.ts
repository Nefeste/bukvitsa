// Встроенный набор: задачи, тетради, календарь (npm run content).
import { PACK } from './generated/pack';
import type { Task } from '../engine/types';
import type { Notebook, Pack } from './types';

export const content: Pack = PACK;
const byId = new Map(PACK.tasks.map(t => [t.id, t]));

export function task(id: string): Task {
  const t = byId.get(id);
  if (!t) throw new Error(`no task ${id}`);
  return t;
}

export function notebook(key: string): Notebook | undefined {
  return PACK.notebooks.find(b => b.key === key);
}
