// из shelter: src/ui/kit.tsx @ fa04538 — текст, кнопка, карточка на токенах студии (src/ui/theme.ts).
import React from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { C, R, S } from './theme';
import { FONTS } from './fonts';

/**
 * Начертание — отдельный файл шрифта: жирность из стиля превращается в семейство Onest нужной
 * толщины (на Android `fontWeight` у своего шрифта не выбирает файл). Заголовок — Kurale, без жирности.
 */
function face(style: TextStyle | undefined, title: boolean): TextStyle {
  if (title) return { fontFamily: FONTS.title, fontWeight: 'normal' };
  const w = String(style?.fontWeight ?? '400');
  if (w === 'bold' || Number(w) >= 600) return { fontFamily: FONTS.bold, fontWeight: 'normal' };
  if (Number(w) === 500) return { fontFamily: FONTS.medium, fontWeight: 'normal' };
  return { fontFamily: FONTS.body };
}

export function Txt({ children, style, dim, title, testID }: { children: React.ReactNode; style?: TextStyle; dim?: boolean; title?: boolean; testID?: string }) {
  return <Text testID={testID} style={[styles.text, dim && styles.dim, title && styles.title, style, face(style, !!title)]}>{children}</Text>;
}

export function Button({ label, onPress, kind = 'primary', disabled, testID }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.button, kind === 'ghost' && styles.ghost, disabled && styles.disabled, pressed && styles.pressed]}>
      <Text style={[styles.buttonText, kind === 'ghost' && styles.ghostText]}>{label}</Text>
    </Pressable>
  );
}

export function Card({ children, style, onPress, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; onPress?: () => void; testID?: string }) {
  if (!onPress) return <View testID={testID} style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  text: { color: C.ink, fontSize: S.body, lineHeight: 24 },
  dim: { color: C.inkSoft, fontSize: S.small, lineHeight: 20 },
  title: { fontSize: S.title, lineHeight: 34 },
  button: { backgroundColor: C.kumach, borderRadius: R.button, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.line },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.8 },
  buttonText: { color: C.kumachInk, fontSize: S.body, fontFamily: FONTS.bold },
  ghostText: { color: C.ink },
  card: { backgroundColor: C.paper, borderRadius: R.card, borderWidth: 1, borderColor: C.line, padding: 14, gap: 6 },
  header: { gap: 4, paddingBottom: 4 },
  backText: { color: C.inkSoft, fontSize: S.body, fontFamily: FONTS.medium },
  /** текст строки кружков — для чтения с экрана и сценария, глазу не виден */
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});

/**
 * Строка кружков итога, нарисованная кодом: ● сами, ◐ с подсказкой или ошибкой, ○ ответ открыт,
 * · не решена. Значки шрифта рисуются по-разному на разных телефонах, поэтому — свои круги.
 */
export function Marks({ marks, size = 22, testID }: { marks: string; size?: number; testID?: string }) {
  const r = size / 2 - 2;
  return (
    <View testID={testID} accessibilityLabel={marks} style={{ flexDirection: 'row', gap: size / 3 }}>
      <Text style={styles.hidden}>{marks}</Text>
      {[...marks].map((m, i) => (
        <Svg key={i} width={size} height={size}>
          {m === '·' ? (
            <Circle cx={size / 2} cy={size / 2} r={2.5} fill={C.inkSoft} />
          ) : (
            <>
              <Circle cx={size / 2} cy={size / 2} r={r} stroke={C.spruce} strokeWidth={2} fill={m === '●' ? C.spruce : 'none'} />
              {m === '◐' ? <Path d={`M ${size / 2} ${size / 2 - r} A ${r} ${r} 0 0 0 ${size / 2} ${size / 2 + r} Z`} fill={C.spruce} /> : null}
            </>
          )}
        </Svg>
      ))}
    </View>
  );
}

/** Строка с заголовком экрана и «Назад». */
export function Header({ title, onBack, back }: { title: string; onBack?: () => void; back?: string }) {
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12} testID="back">
          <Text style={styles.backText}>{`‹ ${back ?? ''}`}</Text>
        </Pressable>
      ) : null}
      <Txt title style={{ fontSize: S.lead, lineHeight: 28 }}>
        {title}
      </Txt>
    </View>
  );
}
