// «Сообщить об ошибке» (08-game-design.md, «Экраны»; устроено как ReportSheet «Вотчины», votchina @ b6da04a, только
// экраном, а не всплывающим окном): игрок пишет, что не так, видит отчёт целиком и сам решает, отправлять ли. На
// телефоне — письмо на support@, не открылось — «Поделиться»; в браузере — копия в буфер. Игра ничего не отправляет сама.
// Из «Откуда это» отчёт открывается с номером задачи: задачи — черновики, и ошибку в тексте проще всего найти так.
import React, { useEffect, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { T } from '../i18n';
import { readCrashlog, type CrashEntry } from '../state/crashlog';
import type { Game, Screen } from '../state/game';
import { buildReport } from '../state/report';
import { shareOrCopy } from '../state/share';
import { KEYS } from '../state/storage';
import { APP_BUILD, APP_VERSION } from '../version';
import { Button, Card, Header, Txt } from '../ui/kit';
import { FONTS } from '../ui/fonts';
import { R, themed, useLook } from '../ui/theme';

/** Почта студии — та же, что в «Об игре» и в карточке RuStore. */
const EMAIL = 'support@gornitsa.games';
/** Предел адреса `mailto:`: кириллица в адресе — шесть знаков на букву; длиннее — сразу «Поделиться». */
const MAILTO_MAX = 16000;
const WEB = Platform.OS === 'web';

/** «Android 14 · Xiaomi 23053RN02Y»; в браузере — начало строки браузера. */
function deviceLine(): string {
  if (WEB) return typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 160) : 'web';
  const c = Platform.constants as { Release?: string; Manufacturer?: string; Model?: string };
  return `${Platform.OS === 'android' ? 'Android' : Platform.OS} ${c.Release ?? Platform.Version} · ${[c.Manufacturer, c.Model].filter(Boolean).join(' ')}`;
}

export function ReportScreen({ game, task, screen, back }: { game: Game; task: string | null; screen: string; back: Screen }) {
  const styles = useStyles();
  const look = useLook();
  const [what, setWhat] = useState('');
  const [log, setLog] = useState<CrashEntry[] | null>([]);
  const [broken, setBroken] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    void readCrashlog().then(setLog);
    AsyncStorage.getItem(KEYS.broken)
      .then(v => setBroken(!!v))
      .catch(() => {});
  }, []);
  const L = T.report;
  const text = buildReport({ what, version: APP_VERSION, build: APP_BUILD, device: deviceLine(), screen, task, broken, log, labels: L.labels });

  // `canOpenURL('mailto:')` на Android 11+ врёт из-за видимости пакетов — просто пробуем
  const send = async () => {
    if (!WEB) {
      const url = `mailto:${EMAIL}?subject=${encodeURIComponent(L.subject(APP_VERSION))}&body=${encodeURIComponent(text)}`;
      if (url.length <= MAILTO_MAX) {
        try {
          await Linking.openURL(url);
          game.setScreen(back);
          return;
        } catch {
          // нет почты — «Поделиться»
        }
      }
    }
    setCopied(await shareOrCopy(text));
  };

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Header title={L.title} onBack={() => game.setScreen(back)} back={T.task.back} />
      <Txt dim>{WEB ? L.noteWeb : L.note}</Txt>
      <Txt style={{ fontWeight: '600' }}>{L.what}</Txt>
      <TextInput
        testID="report-what"
        value={what}
        onChangeText={t => setWhat(t.slice(0, 600))}
        placeholder={L.whatPlaceholder}
        placeholderTextColor={look.c.inkSoft}
        multiline
        style={styles.input}
      />
      <Card>
        <Txt dim>{L.preview}</Txt>
        <Txt dim testID="report-text">
          {text}
        </Txt>
      </Card>
      <Button testID="report-send" label={copied ? T.home.copied : WEB ? L.copy : L.send} onPress={() => void send()} />
    </ScrollView>
  );
}

const useStyles = themed((c, z) =>
  StyleSheet.create({
    wrap: { padding: 16, gap: 12, backgroundColor: c.linen, flexGrow: 1 },
    input: { minHeight: z(88), borderWidth: 1, borderColor: c.line, borderRadius: R.card, backgroundColor: c.paper, color: c.ink, padding: 12, fontSize: z(17), fontFamily: FONTS.body, textAlignVertical: 'top' },
  }),
);
