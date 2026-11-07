// Типы собранного набора (docs/04-data-model.md, «Сборка контента»): tools/content/build.ts пишет
// src/content/generated/pack.ts.
import type { Calendar } from '../engine/day';
import type { Task } from '../engine/types';

export interface Notebook {
  key: string;
  title: string;
  blurb: string;
  free: boolean;
  tasks: string[];
}

export interface Pack {
  tasks: Task[];
  notebooks: Notebook[];
  calendar: Calendar;
  /** выпущенные версии записей (content/released.json) */
  released: Record<string, number>;
  /** сколько записей ещё не проверено человеком */
  draft: number;
}
