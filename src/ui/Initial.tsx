// Буквица — заглавная буква старой книги: кумачовая буква в рамке льняной нити с уголками.
// Рисуется кодом (ADR устава 0023, правило 3: рисунок — скрипт), цвета — токены студии.
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { FONTS } from './fonts';
import { C, R } from './theme';

export function Initial({ letter, size = 72 }: { letter: string; size?: number }) {
  const c = size * 0.18;
  return (
    <View style={[styles.box, { width: size, height: size }]} accessible={false}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        {/* уголки — завитки нити по четырём углам */}
        {[
          [0, 0, 1, 1],
          [size, 0, -1, 1],
          [0, size, 1, -1],
          [size, size, -1, -1],
        ].map(([x, y, dx, dy], i) => (
          <Path
            key={i}
            d={`M ${x + dx * 4} ${y + dy * (c + 4)} L ${x + dx * 4} ${y + dy * 4} L ${x + dx * (c + 4)} ${y + dy * 4} M ${x + dx * 8} ${y + dy * 8} q ${dx * c * 0.5} 0 ${dx * c * 0.5} ${dy * c * 0.5}`}
            stroke={C.flax}
            strokeWidth={2}
            fill="none"
          />
        ))}
      </Svg>
      <Text style={[styles.letter, { fontSize: size * 0.62, lineHeight: size * 0.8 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: C.paper, borderRadius: R.card, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  letter: { color: C.kumach, fontFamily: FONTS.title },
});
