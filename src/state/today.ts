// Сегодняшняя дата телефона — «ГГГГ-ММ-ДД» по местному времени. Только здесь, не в движке:
// движок получает дату аргументом. В веб-сборке для сценария — `?date=2026-12-24`.
import { Platform } from 'react-native';

export function todayISO(): string {
  if (Platform.OS === 'web' && typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('date');
    if (q && /^\d{4}-\d{2}-\d{2}$/.test(q)) return q;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
