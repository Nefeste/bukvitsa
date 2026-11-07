// из shelter: src/ui/fonts.ts @ fa04538 (оттуда — из uzory: src/ui/fonts.ts @ 0c08f24) — шрифты студии (brand/README.md устава, «Шрифты»; SIL OFL 1.1,
// тексты лицензий — assets/fonts/). Каждое начертание — отдельным файлом: пакет целиком потянул бы в
// APK девять файлов Onest вместо трёх. Kurale — только заголовки от 21 px; Onest — всё остальное.
import { Kurale_400Regular } from '@expo-google-fonts/kurale/400Regular';
import { Onest_400Regular } from '@expo-google-fonts/onest/400Regular';
import { Onest_500Medium } from '@expo-google-fonts/onest/500Medium';
import { Onest_600SemiBold } from '@expo-google-fonts/onest/600SemiBold';

export const FONTS = {
  title: 'Kurale',
  body: 'Onest',
  medium: 'Onest-Medium',
  bold: 'Onest-SemiBold',
} as const;

export const FONT_FILES = {
  [FONTS.title]: Kurale_400Regular,
  [FONTS.body]: Onest_400Regular,
  [FONTS.medium]: Onest_500Medium,
  [FONTS.bold]: Onest_600SemiBold,
};
