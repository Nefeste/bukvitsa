// Состояние приложения: какой экран, итоги задач, настройки. Экраны получают его одним объектом.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import type { Result } from '../engine';
import { loadMoney, setPersonalAds, startMoney } from '../money';
import { setLessMotion } from '../ui/motion';
import { lessMotionOf, type Settings } from './settings';
import type { Results } from './progress';
import { loadResults, loadSettings, saveResults, saveSettings } from './storage';
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
  | { name: 'ad'; next: Screen };

export function useGame() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [results, setResults] = useState<Results>({});
  const [settings, setSettingsState] = useState<Settings>({});
  const [systemLess, setSystemLess] = useState(false);
  const [ready, setReady] = useState(false);
  const today = useMemo(() => todayISO(), []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadResults(), loadSettings(), AccessibilityInfo.isReduceMotionEnabled().catch(() => false), loadMoney(today)]).then(([r, s, sys]) => {
      if (!alive) return;
      setResults(r);
      setSettingsState(s);
      setSystemLess(sys);
      setReady(true);
      void startMoney(s.adsConsent === 'yes', today);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setSystemLess(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, [today]);

  useEffect(() => {
    setLessMotion(lessMotionOf(settings, systemLess));
  }, [settings, systemLess]);

  const record = useCallback((id: string, r: Result) => {
    setResults(prev => {
      const next = { ...prev, [id]: r };
      void saveResults(next);
      return next;
    });
  }, []);

  const setSettings = useCallback((s: Settings) => {
    setSettingsState(prev => {
      if (s.adsConsent && s.adsConsent !== prev.adsConsent) setPersonalAds(s.adsConsent === 'yes');
      return s;
    });
    void saveSettings(s);
  }, []);

  return { screen, setScreen, results, record, settings, setSettings, systemLess, ready, today };
}

export type Game = ReturnType<typeof useGame>;
