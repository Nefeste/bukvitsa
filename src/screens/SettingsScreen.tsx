// Настройки (08-game-design.md, «Экраны»): звук, тема, «ещё крупнее», «Меньше движения» (ADR устава 0023, правило 6),
// персональная реклама, «Удалить мои данные» — с подтверждением на самом экране, без системного окна.
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { T } from '../i18n';
import type { Game } from '../state/game';
import { soundOf, type Settings } from '../state/settings';
import { Button, Card, Header, Txt } from '../ui/kit';
import { themed } from '../ui/theme';

/** Ряд кнопок «один из»: выбранная — главной кнопкой. */
function Choice<V>({ id, value, opts, onPick }: { id: string; value: V; opts: { label: string; value: V; key: string }[]; onPick: (v: V) => void }) {
  return (
    <>
      {opts.map(o => (
        <Button key={o.key} testID={`${id}-${o.key}`} kind={value === o.value ? 'primary' : 'ghost'} label={o.label} onPress={() => onPick(o.value)} />
      ))}
    </>
  );
}

export function SettingsScreen({ game }: { game: Game }) {
  const styles = useStyles();
  const s = game.settings;
  const set = (patch: Partial<Settings>) => game.setSettings({ ...s, ...patch });
  const [ask, setAsk] = useState(false);
  const [wiped, setWiped] = useState(false);
  const tri = { system: T.settings.system, on: T.settings.on, off: T.settings.off };
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.settings.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.sound}</Txt>
        <Txt dim>{T.settings.soundAbout}</Txt>
        <Choice
          id="sound"
          value={soundOf(s)}
          onPick={v => set({ sound: v })}
          opts={[
            { label: tri.on, value: true, key: 'on' },
            { label: tri.off, value: false, key: 'off' },
          ]}
        />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.theme}</Txt>
        <Choice<Settings['theme']>
          id="theme"
          value={s.theme}
          onPick={v => set({ theme: v })}
          opts={[
            { label: tri.system, value: undefined, key: 'system' },
            { label: T.settings.light, value: 'light', key: 'light' },
            { label: T.settings.dark, value: 'dark', key: 'dark' },
          ]}
        />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.bigger}</Txt>
        <Txt dim>{T.settings.biggerAbout}</Txt>
        <Choice
          id="bigger"
          value={s.bigger === true}
          onPick={v => set({ bigger: v })}
          opts={[
            { label: tri.on, value: true, key: 'on' },
            { label: tri.off, value: false, key: 'off' },
          ]}
        />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.motion}</Txt>
        <Txt dim>{T.settings.motionAbout}</Txt>
        <Choice
          id="motion"
          value={s.lessMotion}
          onPick={v => set({ lessMotion: v })}
          opts={[
            { label: tri.system, value: undefined, key: 'system' },
            { label: tri.on, value: true, key: 'on' },
            { label: tri.off, value: false, key: 'off' },
          ]}
        />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.ads}</Txt>
        <Txt dim>{T.settings.adsAbout}</Txt>
        <Choice<Settings['adsConsent']>
          id="ads"
          value={s.adsConsent}
          onPick={v => set({ adsConsent: v })}
          opts={[
            { label: T.money.consentYes, value: 'yes', key: 'yes' },
            { label: T.money.consentNo, value: 'no', key: 'no' },
          ]}
        />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.report}</Txt>
        <Txt dim>{T.settings.reportAbout}</Txt>
        <Button testID="report" kind="ghost" label={T.settings.report} onPress={() => game.setScreen({ name: 'report', task: null, screen: 'settings', back: { name: 'settings' } })} />
      </Card>
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.settings.wipe}</Txt>
        <Txt dim>{wiped ? T.settings.wiped : ask ? T.settings.wipeAsk : T.settings.wipeAbout}</Txt>
        {ask ? (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Button
                testID="wipe-yes"
                label={T.settings.wipeYes}
                onPress={() => {
                  setAsk(false);
                  void game.wipe().then(() => setWiped(true));
                }}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button testID="wipe-no" kind="ghost" label={T.settings.wipeNo} onPress={() => setAsk(false)} />
            </View>
          </View>
        ) : (
          <Button
            testID="wipe"
            kind="ghost"
            label={T.settings.wipe}
            onPress={() => {
              setWiped(false);
              setAsk(true);
            }}
          />
        )}
      </Card>
    </ScrollView>
  );
}

const useStyles = themed(c =>
  StyleSheet.create({
    wrap: { padding: 16, gap: 12, backgroundColor: c.linen, flexGrow: 1 },
    row: { flexDirection: 'row', gap: 10 },
  }),
);
