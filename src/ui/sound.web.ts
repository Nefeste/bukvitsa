// Звук в браузере — тишина (ADR 0007: всё нативное — за адаптером с заглушкой): веб-сборка — для проверки и
// закрытого теста, а звук до первого касания браузер всё равно не даёт. Те же функции, что в sound.ts.
export type Cue = 'right' | 'hint';
export function setSoundOn(_v: boolean): void {}
export function preloadSounds(): void {}
export function cue(_what: Cue): void {}
