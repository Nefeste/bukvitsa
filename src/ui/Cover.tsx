// Обложка тетради (08-game-design.md, «Тетради»; 09-content.md, §7): буквица темы в рамке льняной нити и под ней
// полоса-рушник — ромбы, кресты или ёлочка кумачом и елью, как полоса брендбука. Рисуется кодом, цвета — токены
// студии (ADR устава 0023). Тетрадь «В следующих версиях» — бледная.
import React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Initial } from './Initial';
import { useLook } from './theme';

/** Узоры полосы: ромб, крест, ёлочка — путь одного звена шириной `w` и высотой `h` с началом в `x`. */
const MOTIFS: ((x: number, w: number, h: number) => string)[] = [
  (x, w, h) => `M ${x + w / 2} 1 L ${x + w - 1} ${h / 2} L ${x + w / 2} ${h - 1} L ${x + 1} ${h / 2} Z`,
  (x, w, h) => `M ${x + w * 0.35} 1 H ${x + w * 0.65} V ${h * 0.35} H ${x + w - 1} V ${h * 0.65} H ${x + w * 0.65} V ${h - 1} H ${x + w * 0.35} V ${h * 0.65} H ${x + 1} V ${h * 0.35} H ${x + w * 0.35} Z`,
  (x, w, h) => `M ${x + 1} ${h - 1} L ${x + w / 2} 1 L ${x + w - 1} ${h - 1} L ${x + w - 3} ${h - 1} L ${x + w / 2} 5 L ${x + 3} ${h - 1} Z`,
];

export function Cover({ initial, motif, size = 56, dim = false, testID }: { initial: string; motif: number; size?: number; dim?: boolean; testID?: string }) {
  const look = useLook();
  const h = Math.round(size * 0.16);
  const n = 5;
  const w = size / n;
  const draw = MOTIFS[motif % MOTIFS.length];
  return (
    <View style={{ width: size, gap: 4, opacity: dim ? 0.45 : 1 }} testID={testID} accessible={false}>
      <Initial letter={initial} size={size} />
      <Svg width={size} height={h}>
        {Array.from({ length: n }, (_, i) => (
          <Path key={i} d={draw(i * w, w, h)} fill={i % 2 ? look.c.spruce : look.c.kumach} />
        ))}
      </Svg>
    </View>
  );
}
