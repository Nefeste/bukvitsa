// Звук (08-game-design.md, «Вид»; решение владельца #14): короткий тихий звук верного ответа и подсказки.
// Устроено как src/ui/feedback.ts «Нард» (nardy @ 1d2bdff): проигрыватели expo-audio через src/ui/voices.ts —
// заводятся заранее, когда открылась задача, и чинятся после ошибки Android. Вибрации нет (VIBRATE вырезан
// в app.json). Ничто здесь не бросает: без звука игра та же. В браузере — sound.web.ts, тишина.
import { createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import { logError } from '../state/crashlog';
import { Voices } from './voices';

export type Cue = 'right' | 'hint';

const FILES: Record<Cue, number> = {
  right: require('../../assets/sounds/right.wav'),
  hint: require('../../assets/sounds/hint.wav'),
};
const SIZES: Record<Cue, number> = { right: 1, hint: 1 };

let on = true;
let ready = false;

/** Проигрыватель (expo-audio); ошибка Android на нём — `fail`, файл откроется заново. */
const voices = new Voices<Cue>(SIZES, (id, _k, fail) => {
  if (!ready) {
    ready = true;
    // игра не перебивает музыку и молчит, когда телефон на беззвучном
    setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers', shouldPlayInBackground: false }).catch(() => {});
  }
  const file = FILES[id];
  const p = createAudioPlayer(file);
  p.addListener('playbackStatusUpdate', st => { if (st.error) fail(st.error); });
  return {
    play(volume) {
      p.volume = volume;
      void p.seekTo(0).catch(() => {});
      p.play();
    },
    reload() { p.replace(file); },
  };
}, (key, why) => logError('error', why, `sound ${key}`));

/** Включён ли звук — из настроек игрока (src/state/game.ts). */
export function setSoundOn(v: boolean): void {
  on = v;
}

/** Завести проигрыватели заранее, по одному за шаг, — при открытии задачи. */
export function preloadSounds(): void {
  if (!on) return;
  voices.warm(['right', 'hint'], next => { setTimeout(next, 150); });
}

/** Сыграть звук события задачи. */
export function cue(what: Cue): void {
  if (!on) return;
  voices.play(what, 0, 1);
}
