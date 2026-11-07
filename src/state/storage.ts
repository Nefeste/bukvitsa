// Итоги задач и настройки — на телефоне. Не прочиталось — игра идёт без них (как в shelter: src/state/storage.ts @ fa04538).
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_SETTINGS, type Settings, parseSettings } from './settings';
import { parseResults, type Results } from './progress';

const RESULTS = 'bukvitsa.results.v1';
const SETTINGS = 'bukvitsa.settings.v1';

export async function loadResults(): Promise<Results> {
  try {
    return parseResults(await AsyncStorage.getItem(RESULTS));
  } catch {
    return {};
  }
}

export async function saveResults(rs: Results): Promise<void> {
  try {
    await AsyncStorage.setItem(RESULTS, JSON.stringify(rs));
  } catch {
    // не сохранилось — итоги живут, пока игра открыта
  }
}

export async function loadSettings(): Promise<Settings> {
  try {
    return parseSettings(await AsyncStorage.getItem(SETTINGS));
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS, JSON.stringify(s));
  } catch {
    // не сохранилось — настройка действует, пока игра открыта
  }
}
