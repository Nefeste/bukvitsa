// Содержание игры: задачи, тетради, календарь — из сборки (npm run content).
import { BUNDLE } from './generated/bundle';
import type { Task } from '../engine/types';
import type { Bundle, Notebook } from './types';

export const content: Bundle = BUNDLE;

export function task(id: string): Task {
  const t = BUNDLE.tasks[id];
  if (!t) throw new Error(`no task ${id}`);
  return t;
}

export function notebook(id: string): Notebook | undefined {
  return BUNDLE.notebooks.find(b => b.id === id);
}
