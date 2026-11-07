// Состояние приложения: какой экран, итоги задач, настройки. Экраны получают его одним объектом.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { dailyTasks, marksLine, type Result } from '../engine';
import { content } from '../content';
import { setLessMotion } from '../ui/motion';
import { lessMotionOf, type Settings } from './settings';
import type { Results } from './progress';
import { loadResults, loadSettings, saveResults, saveSettings } from './storage';
import { todayISO } from './today';

/** Откуда открыта задача: день календаря или тетрадь. */
export type Flow = { from: 'day'; date: string } | { from: 'notebook'; id: string };

export type Screen =
  | { name: 'home' }
  | { name: 'task'; flow: Flow; id: string }
  | { name: 'day'; date: string }
  | { name: 'archive' }
  | { name: 'notebooks' }
  | { name: 'notebook'; id: string }
  | { name: 'settings' }
  | { name: 'about' };

export function flowTasks(flow: Flow): string[] {
  return flow.from === 'day' ? dailyTasks(content.calendar, flow.date) : (content.notebooks.find(b => b.id === flow.id)?.tasks ?? []);
}

/** Кружки итога по списку задач. */
export function marksOf(rs: Results, ids: readonly string[]): string {
  return marksLine(ids.map(id => rs[id]));
}

export function useGame() {
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [results, setResults] = useState<Results>({});
  const [settings, setSettingsState] = useState<Settings>({});
  const [systemLess, setSystemLess] = useState(false);
  const [ready, setReady] = useState(false);
  const today = useMemo(() => todayISO(), []);

  useEffect(() => {
    let alive = true;
    Promise.all([loadResults(), loadSettings(), AccessibilityInfo.isReduceMotionEnabled().catch(() => false)]).then(([r, s, sys]) => {
      if (!alive) return;
      setResults(r);
      setSettingsState(s);
      setSystemLess(sys);
      setReady(true);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => setSystemLess(v));
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

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
    setSettingsState(s);
    void saveSettings(s);
  }, []);

  return { screen, setScreen, results, record, settings, setSettings, systemLess, ready, today };
}

export type Game = ReturnType<typeof useGame>;
