// Сохранение на телефоне (docs/04-data-model.md, «Телефон»): одна запись `bukvitsa.save` со схемой 1 в
// AsyncStorage — как хранилище «Вотчины» и «Нард» (nardy: src/state/storage.ts @ 1d2bdff, сбой хранилища
// не роняет игру). На Android AsyncStorage — база `RKStorage` в папке приложения, её и берёт автобэкап
// (plugins/with-backup.js, как в «Нардах»); в веб-сборке — localStorage. Не прочиталось — игра идёт без него.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { parseResults } from './progress';
import { emptySave, eventsOfResults, parseSave, withEvent, type Save } from './save';
import { parseSettings } from './settings';

export const KEYS = {
  save: 'bukvitsa.save',
  /** нечитаемая запись — для «Сообщить об ошибке» (specs/2026-10-screens.md, «Неудачные случаи») */
  broken: 'bukvitsa.broken',
  /** итоги и настройки 0.1 — читаются один раз, при переносе в схему 1 */
  legacyResults: 'bukvitsa.results.v1',
  legacySettings: 'bukvitsa.settings.v1',
} as const;

async function get(key: string): Promise<string | null | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      // одна повторная попытка — сбой бывает мгновенным
    }
  }
  return undefined;
}

/**
 * При запуске. `writable: false` — запись не прочиталась (сбой хранилища, не «пусто»): игра идёт с чистого
 * листа, но не пишет поверх, чтобы не стереть прогресс, который прочитается при следующем запуске.
 */
export async function loadSave(today: string): Promise<{ save: Save; writable: boolean }> {
  const raw = await get(KEYS.save);
  if (raw === undefined) return { save: emptySave(today), writable: false };
  const s = parseSave(raw, today);
  if (s === 'broken') {
    try {
      await AsyncStorage.setItem(KEYS.broken, raw ?? '');
    } catch {
      // не отложилось — не страшно
    }
    return { save: emptySave(today), writable: true };
  }
  if (s) return { save: s, writable: true };
  // записи ещё нет: первый запуск или обновление с 0.1 — перенос итогов и настроек
  const [r, st] = await Promise.all([get(KEYS.legacyResults), get(KEYS.legacySettings)]);
  let save = emptySave(today);
  save = { ...save, settings: parseSettings(st ?? null) };
  for (const e of eventsOfResults(parseResults(r ?? null), today)) save = withEvent(save, e);
  if (save.events.length || st) await writeSave(save);
  return { save, writable: true };
}

let queue: Promise<void> = Promise.resolve();

/** Записи идут по одной, в порядке вызова: последняя всегда ложится последней. */
export function writeSave(s: Save): Promise<void> {
  queue = queue.then(async () => {
    try {
      await AsyncStorage.setItem(KEYS.save, JSON.stringify(s));
    } catch {
      // хранилище полно или недоступно: прогресс живёт, пока игра открыта
    }
  });
  return queue;
}

/** «Удалить мои данные»: прогресс и настройки. «Буквица+» остаётся в RuStore и вернётся сверкой. */
export function removeSave(): Promise<void> {
  queue = queue.then(async () => {
    try {
      await AsyncStorage.multiRemove([KEYS.save, KEYS.broken, KEYS.legacyResults, KEYS.legacySettings]);
    } catch {
      // не удалилось — попробуется при следующем нажатии
    }
  });
  return queue;
}
