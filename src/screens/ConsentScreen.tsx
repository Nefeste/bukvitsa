// Экран согласия на персональную рекламу (specs/2026-10-money.md, «Что увидит игрок»): перед первым роликом,
// не при запуске. Две равноправные кнопки, ничего не отмечено; ответ — в настройках, его можно поменять.
import React from 'react';
import { Linking, ScrollView, StyleSheet } from 'react-native';
import { T } from '../i18n';
import type { Game, Screen } from '../state/game';
import { Button, Card, Txt } from '../ui/kit';
import { C, S } from '../ui/theme';

/** Раздел «Буквицы» в политике студии (store/site/privacy*, сайт gornitsa.games). */
const PRIVACY = 'https://gornitsa.games/privacy.html#bukvitsa';

export function ConsentScreen({ game, next }: { game: Game; next: Screen }) {
  const answer = (v: 'yes' | 'no') => {
    game.setSettings({ ...game.settings, adsConsent: v });
    game.setScreen(next);
  };
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Card testID="consent">
        <Txt title style={{ fontSize: S.lead, lineHeight: 28 }}>{T.money.consentTitle}</Txt>
        <Txt>{T.money.consentAsk}</Txt>
        <Button testID="consent-yes" kind="ghost" label={T.money.consentYes} onPress={() => answer('yes')} />
        <Button testID="consent-no" kind="ghost" label={T.money.consentNo} onPress={() => answer('no')} />
        <Txt dim>{T.money.consentLater}</Txt>
        <Button kind="ghost" label={T.money.privacy} onPress={() => void Linking.openURL(PRIVACY).catch(() => {})} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1, justifyContent: 'center' } });
