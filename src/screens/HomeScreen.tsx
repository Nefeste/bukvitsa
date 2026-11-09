// Главная (08-game-design.md, «Игровой цикл»): сверху задача дня, ниже тетради, внизу «Архив»,
// «Настройки», «Об игре»; «Буквица+» — одно из трёх мест, где игра говорит о покупке.
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { daily } from '../engine';
import { content, task as taskById } from '../content';
import { T, howSolved, shareText } from '../i18n';
import { useMoney } from '../money';
import { counts } from '../state/progress';
import { shareOrCopy } from '../state/share';
import type { Game } from '../state/game';
import { Button, Card, Txt } from '../ui/kit';
import { Cover } from '../ui/Cover';
import { Initial } from '../ui/Initial';
import { S, themed, useLook } from '../ui/theme';

export function HomeScreen({ game }: { game: Game }) {
  const styles = useStyles();
  const look = useLook();
  const { results, today, setScreen } = game;
  const id = daily(content.calendar, today);
  const t = id ? taskById(id) : undefined;
  const r = id ? results[id] : undefined;
  const [copied, setCopied] = useState(false);
  const money = useMoney();
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.title}>
        <Initial letter={T.app.initial} />
        <View style={{ flex: 1 }}>
          <Txt title style={{ fontSize: look.z(S.hero), lineHeight: look.z(42) }}>{T.app.name}</Txt>
          <Txt dim>{T.app.tagline}</Txt>
        </View>
      </View>

      <Card testID="daily">
        {t && id ? (
          <>
            <Txt style={{ fontWeight: '600' }}>{T.home.daily(today, t.kind)}</Txt>
            {r?.done ? (
              <>
                <Txt testID="daily-result" style={{ color: r.peeked ? look.c.inkSoft : look.c.spruce }}>{howSolved(r)}</Txt>
                <Button
                  testID="daily-share"
                  label={copied ? T.home.copied : T.home.share}
                  onPress={() => {
                    game.shared(id);
                    void shareOrCopy(shareText(today, t.kind, r)).then(setCopied);
                  }}
                />
              </>
            ) : (
              <Button testID="daily-solve" label={T.home.solve} onPress={() => setScreen({ name: 'task', flow: { from: 'daily', date: today }, id })} />
            )}
          </>
        ) : (
          <Txt dim>{T.home.beyond}</Txt>
        )}
      </Card>

      <Txt title style={{ fontSize: look.z(S.lead), lineHeight: look.z(28) }}>{T.home.notebooks}</Txt>
      {content.notebooks.map(b => {
        // тетрадь с задачами открывается всегда: закрытые задачи видны внутри, с «Буквицей+» и роликом
        const open = b.tasks.length > 0;
        const c = counts(results, b.tasks);
        return (
          <Pressable key={b.key} testID={`notebook-${b.key}`} disabled={!open} onPress={() => setScreen({ name: 'notebook', key: b.key })} style={({ pressed }) => [styles.book, !open && styles.closed, pressed && { opacity: 0.8 }]}>
            <Cover initial={b.initial} motif={b.motif} size={look.z(48)} dim={!open} testID={`cover-${b.key}`} />
            <View style={{ flex: 1, gap: 4 }}>
              <Txt style={{ fontWeight: '600' }}>{b.title}</Txt>
              <Txt dim>{b.blurb}</Txt>
              <Txt dim>{open ? T.home.progress(c.done, b.tasks.length, c.peeked) : T.home.later}</Txt>
            </View>
          </Pressable>
        );
      })}

      {money.plus ? (
        <Txt dim testID="plus-home">{T.money.thanks}</Txt>
      ) : (
        <Button testID="plus-home" kind="ghost" label={T.money.plusHome} onPress={() => setScreen({ name: 'plus' })} />
      )}
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button testID="archive" kind="ghost" label={T.home.archive} onPress={() => setScreen({ name: 'archive' })} />
        </View>
      </View>
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Button testID="settings" kind="ghost" label={T.home.settings} onPress={() => setScreen({ name: 'settings' })} />
        </View>
        <View style={{ flex: 1 }}>
          <Button testID="about" kind="ghost" label={T.home.about} onPress={() => setScreen({ name: 'about' })} />
        </View>
      </View>
    </ScrollView>
  );
}

const useStyles = themed((c, z) =>
  StyleSheet.create({
    wrap: { padding: 16, gap: 12, backgroundColor: c.linen, flexGrow: 1 },
    title: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
    row: { flexDirection: 'row', gap: 10 },
    book: { backgroundColor: c.paper, borderRadius: 10, borderWidth: 1, borderColor: c.line, padding: 14, gap: 14, flexDirection: 'row', alignItems: 'flex-start' },
    closed: { backgroundColor: c.cell, borderColor: c.cell },
  }),
);
