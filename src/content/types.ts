// Типы собранного содержания (tools/content/build.ts пишет src/content/generated/bundle.ts).
import type { Task } from '../engine/types';

export interface Notebook {
  id: string;
  title: string;
  about: string;
  /** задачи тетради по порядку */
  tasks: string[];
}

export interface Bundle {
  tasks: Record<string, Task>;
  notebooks: Notebook[];
  calendar: { from: string; days: string[][] };
  source: { author: string; title: string; year: number; url: string };
  /** сколько задач ещё не проверено человеком */
  draft: number;
}
