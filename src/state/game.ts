// Состояние приложения: какой экран, сохранение (события, настройки), вид. Экраны получают его одним объектом.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, useColorScheme } from 'react-native';
import type { Result } from '../engine';
import { loadMoney, setPersonalAds, startMoney } from '../money';
import { setLessMotion } from '../ui/motion';
import { setSoundOn } from '../ui/sound';
import { setLook } from '../ui/theme';
import { darkOf, lessMotionOf, soundOf, type Settings } from './settings';
import { emptySave, eventOfResult, resultsOf, withEvent, type Save } from './save';
import { loadSave, removeSave, writeSave } from './storage';
import { todayISO } from './today';

/** Откуда открыта задача: задача дня (с датой) или тетрадь. */
export type Flow = { from: 'daily'; date: string } | { from: 'notebook'; key: string };

export type Screen =
  | { name: 'home' }
  | { name: 'task'; flow: Flow; id: string }
  | { name: 'archive' }
  | { name: 'notebook'; key: string }
  | { name: 'settings' }
  | { name: 'about' }
  | { name: 'plus' }
  /** экран согласия на персональную рекламу — перед первым роликом; ответ — и дальше `next` */
  | { name: 'consent'; next: Screen }
  /** короткий экран «Реклама» перед межстраничным роликом, потом `next` */
  | { name: 'ad'; next: Screen }
  /** «Сообщить об ошибке»: из настроек или из «Откуда это» с номером задачи; `back` — куда вернуться */
  | { name: 'report'; task: string | null; screen: string; back: Screen };

export function useGame() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const today = useMemo(() => todayISO(), []);
  const [save, setSave] = useState<Save>(() => emptySave(today));
  const [systemLess, setSystemLess] = useState(false);
  const [ready, setReady] = useState(false);
  const writable = useRef(false);
  const systemDark = useColorScheme() === 'dark';

  useEffect(() => {
    let alive = true;
    Promise.all([loadSave(today), AccessibilityInfo.isReduceMotionEnabled().catch(() => false), loadMoney(today)]).then(([loaded, sys]) => {
      if (!alive) return;
      writable.current = loaded.writable;
      setSave(loaded.save);
      setSystemLess(sys);
      setReady(true);
      void startMoney(loaded.save.settings.adsConsent === 'yes', today);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setSystemLess(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, [today]);

  const settings = save.settings;
  useEffect(() => {
    setLessMotion(lessMotionOf(settings, systemLess));
    setLook(darkOf(settings, systemDark), settings.bigger === true);
    setSoundOn(soundOf(settings));
  }, [settings, systemLess, systemDark]);

  /** Изменить сохранение и записать его; запись не прочиталась при запуске — не писать поверх. */
  const update = useCallback((f: (s: Save) => Save) => {
    setSave(prev => {
      const next = f(prev);
      if (next !== prev && writable.current) void writeSave(next);
      return next;
    });
  }, []);

  const results = useMemo(() => resultsOf(save.events), [save.events]);

  /** Задача решена или подсмотрена — событие в сохранение. */
  const record = useCallback(
    (id: string, r: Result) => {
      const e = eventOfResult(id, r, today);
      if (e) update(s => withEvent(s, e));
    },
    [today, update],
  );

  /** Игрок поделился итогом задачи дня. */
  const shared = useCallback((id: string) => update(s => withEvent(s, { t: 'shared', id, day: today })), [today, update]);

  const setSettings = useCallback(
    (next: Settings) => {
      update(s => {
        if (next.adsConsent && next.adsConsent !== s.settings.adsConsent) setPersonalAds(next.adsConsent === 'yes');
        return { ...s, settings: next };
      });
    },
    [update],
  );

  /** Форму оценки RuStore показали — больше не просить. */
  const markRated = useCallback(() => update(s => (s.rateAsked ? s : { ...s, rateAsked: true })), [update]);

  /** «Удалить мои данные»: прогресс и настройки с нуля; день установки и права «Буквицы+» остаются. */
  const wipe = useCallback(async () => {
    await removeSave();
    writable.current = true;
    update(s => ({ ...emptySave(today), installedOn: s.installedOn }));
  }, [today, update]);

  return { screen, setScreen, results, record, shared, settings, setSettings, systemLess, systemDark, ready, today, save, markRated, wipe };
}

export type Game = ReturnType<typeof useGame>;
