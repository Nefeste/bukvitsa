// из shelter: src/ui/kit.tsx @ fa04538 — текст, кнопка, карточка на токенах студии (src/ui/theme.ts).
import React from 'react';
import { Pressable, type StyleProp, StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';
import { R, S, themed, useLook } from './theme';
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
  const styles = useStyles();
  return <Text testID={testID} style={[styles.text, dim && styles.dim, title && styles.title, style, face(style, !!title)]}>{children}</Text>;
}

export function Button({ label, onPress, kind = 'primary', disabled, testID }: { label: string; onPress: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean; testID?: string }) {
  const styles = useStyles();
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
  const styles = useStyles();
  if (!onPress) return <View testID={testID} style={[styles.card, style]}>{children}</View>;
  return (
    <Pressable testID={testID} onPress={onPress} style={({ pressed }) => [styles.card, style, pressed && styles.pressed]}>
      {children}
    </Pressable>
  );
}

const useStyles = themed((c, z) =>
  StyleSheet.create({
    text: { color: c.ink, fontSize: z(S.body), lineHeight: z(24) },
    dim: { color: c.inkSoft, fontSize: z(S.small), lineHeight: z(20) },
    title: { fontSize: z(S.title), lineHeight: z(34) },
    button: { backgroundColor: c.kumach, borderRadius: R.button, paddingVertical: 14, paddingHorizontal: 18, alignItems: 'center' },
    ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: c.line },
    disabled: { opacity: 0.45 },
    pressed: { opacity: 0.8 },
    buttonText: { color: c.kumachInk, fontSize: z(S.body), fontFamily: FONTS.bold },
    ghostText: { color: c.ink },
    card: { backgroundColor: c.paper, borderRadius: R.card, borderWidth: 1, borderColor: c.line, padding: 14, gap: 6 },
    header: { gap: 4, paddingBottom: 4 },
    backText: { color: c.inkSoft, fontSize: z(S.body), fontFamily: FONTS.medium },
  }),
);

/** Строка с заголовком экрана и «Назад». */
export function Header({ title, onBack, back }: { title: string; onBack?: () => void; back?: string }) {
  const styles = useStyles();
  const look = useLook();
  return (
    <View style={styles.header}>
      {onBack ? (
        <Pressable accessibilityRole="button" onPress={onBack} hitSlop={12} testID="back">
          <Text style={styles.backText}>{`‹ ${back ?? ''}`}</Text>
        </Pressable>
      ) : null}
      <Txt title style={{ fontSize: look.z(S.lead), lineHeight: look.z(28) }}>
        {title}
      </Txt>
    </View>
  );
}
