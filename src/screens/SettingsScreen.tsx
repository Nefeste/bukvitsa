// Настройки: «Меньше движения» — как в телефоне, включено или выключено (ADR устава 0023, правило 6).
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { T } from '../i18n';
import type { Game } from '../state/game';
import { Button, Card, Header, Txt } from '../ui/kit';
import { C } from '../ui/theme';

export function SettingsScreen({ game }: { game: Game }) {
  const v = game.settings.lessMotion;
  const opts: { label: string; value: boolean | undefined; id: string }[] = [
    { label: T.settings.system, value: undefined, id: 'system' },
    { label: T.settings.on, value: true, id: 'on' },
    { label: T.settings.off, value: false, id: 'off' },
  ];
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.settings.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.motion}</Txt>
        <Txt dim>{T.settings.motionAbout}</Txt>
        {opts.map(o => (
          <Button key={o.id} testID={`motion-${o.id}`} kind={v === o.value ? 'primary' : 'ghost'} label={o.label} onPress={() => game.setSettings(o.value === undefined ? {} : { lessMotion: o.value })} />
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1 } });
