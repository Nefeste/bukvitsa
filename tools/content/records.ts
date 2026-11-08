// Записи задач (docs/09-content.md, §3): один файл YAML на задачу, `content/<папка>/<номер>.yaml`.
// Номер — вечный идентификатор: `proverbs/0012.yaml` ↔ `proverb-0012`.
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse, stringify } from 'yaml';

export type Kind = 'proverb' | 'riddle' | 'extra-letter' | 'old-word' | 'parts' | 'ending' | 'cipher';

/** Папка записей ↔ приставка идентификатора. */
export const FOLDERS: Record<Kind, { dir: string; prefix: string }> = {
  proverb: { dir: 'proverbs', prefix: 'proverb' },
  riddle: { dir: 'riddles', prefix: 'riddle' },
  'extra-letter': { dir: 'extra', prefix: 'extra-letter' },
  'old-word': { dir: 'words', prefix: 'word' },
  parts: { dir: 'parts', prefix: 'parts' },
  ending: { dir: 'endings', prefix: 'ending' },
  cipher: { dir: 'ciphers', prefix: 'cipher' },
};

export interface Source {
  work: string;
  edition: string;
  section?: string;
  page?: number;
  basis: string;
  url: string;
  checked_against: string;
}

export interface Rec {
  id: string;
  version: number;
  kind: Kind;
  review: 'draft' | 'checked';
  daily?: 'yes' | 'no' | boolean;
  notebooks?: string[];
  source: Source;
  /** пословица в скачанном источнике (`dal.<раздел>.<строка>.<n>`) — если запись сделана скриптом */
  proverb?: string;
  text?: string;
  answer?: string;
  /** proverb: номер скрытого слова с 1 */
  gap?: number;
  /** extra-letter: номер слова с 1, буква, позиция в слове с 1 */
  word?: number | string;
  letter?: string;
  position?: number;
  /** old-word */
  meaning?: string;
  /** old-word — три неверных слова; ending — три неверных конца из других пословиц Даля */
  options?: string[];
  page?: number;
  /** parts: части в правильном порядке */
  parts?: string[];
  about: string;
  notes?: string;
  /** путь файла — для сообщений сборки */
  file?: string;
}

export function idOf(kind: Kind, n: number): string {
  return `${FOLDERS[kind].prefix}-${String(n).padStart(4, '0')}`;
}

/** Все записи `content/` по папкам видов. */
export function readRecords(root: string): Rec[] {
  const out: Rec[] = [];
  for (const kind of Object.keys(FOLDERS) as Kind[]) {
    const dir = join(root, 'content', FOLDERS[kind].dir);
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter(x => /^\d{4}\.yaml$/.test(x)).sort()) {
      const r = parse(readFileSync(join(dir, f), 'utf8')) as Rec;
      out.push({ ...r, file: `content/${FOLDERS[kind].dir}/${f}` });
    }
  }
  return out;
}

/** Следующий свободный номер в папке вида. */
export function nextNumber(root: string, kind: Kind): number {
  const dir = join(root, 'content', FOLDERS[kind].dir);
  if (!existsSync(dir)) return 1;
  const ns = readdirSync(dir)
    .map(f => /^(\d{4})\.yaml$/.exec(f)?.[1])
    .filter((x): x is string => !!x)
    .map(Number);
  return ns.length ? Math.max(...ns) + 1 : 1;
}

export function writeRecord(root: string, r: Rec): void {
  const dir = join(root, 'content', FOLDERS[r.kind].dir);
  mkdirSync(dir, { recursive: true });
  const n = r.id.split('-').pop()!;
  const { file: _file, ...body } = r;
  void _file;
  writeFileSync(join(dir, `${n}.yaml`), stringify(body, { lineWidth: 0 }));
}
