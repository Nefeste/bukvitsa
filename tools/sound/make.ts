// из nardy: tools/sound/make.ts @ 1d2bdff. Пересобрать звуки: bun tools/sound/make.ts → assets/sounds/right.wav, hint.wav.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { SOUND_IDS, peakOf, synth, wav } from './synth';

const DIR = join(import.meta.dir, '..', '..', 'assets', 'sounds');
for (const id of SOUND_IDS) {
  const bytes = wav(synth(id), peakOf(id));
  writeFileSync(join(DIR, `${id}.wav`), bytes);
  console.log(`${id}.wav: ${(bytes.length / 1024).toFixed(1)} КБ`);
}
