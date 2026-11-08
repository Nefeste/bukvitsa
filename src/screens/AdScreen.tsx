// Короткий экран перед межстраничным роликом (specs/2026-10-money.md): «Реклама · „Буквица+“ убирает её
// навсегда» на секунду — единственное упоминание покупки у рекламы. Потом ролик и сразу `next`: ждать
// окончания ролика игра не заставляет — он сам лежит поверх.
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../i18n';
import { showInterstitial } from '../money';
import type { Game, Screen } from '../state/game';
import { Txt } from '../ui/kit';
import { S, themed, useLook } from '../ui/theme';

export function AdScreen({ game, next }: { game: Game; next: Screen }) {
  const styles = useStyles();
  const look = useLook();
  const { setScreen } = game;
  useEffect(() => {
    const t = setTimeout(() => {
      showInterstitial();
      setScreen(next);
    }, 1000);
    return () => clearTimeout(t);
  }, [next, setScreen]);
  return (
    <View style={styles.wrap} testID="ad-note">
      <Txt title style={{ fontSize: look.z(S.lead), lineHeight: look.z(28) }}>{T.money.ad}</Txt>
      <Txt dim>{T.money.adNote}</Txt>
    </View>
  );
}

const useStyles = themed((c, z) =>
  StyleSheet.create({ wrap: { flex: 1, backgroundColor: c.linen, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 } }),
);
