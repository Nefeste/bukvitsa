// Главная (08-game-design.md, «Игровой цикл»): сверху задача дня, ниже тетради, внизу «Архив»,
// «Настройки», «Об игре». «Буквица+» появится с деньгами (0.5).
import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { daily } from '../engine';
import { content, task as taskById } from '../content';
import { T, howSolved, shareText } from '../i18n';
import { counts } from '../state/progress';
import { shareOrCopy } from '../state/share';
import type { Game } from '../state/game';
import { Button, Card, Txt } from '../ui/kit';
import { Initial } from '../ui/Initial';
import { C, S } from '../ui/theme';

export function HomeScreen({ game }: { game: Game }) {
  const { results, today, setScreen } = game;
  const id = daily(content.calendar, today);
  const t = id ? taskById(id) : undefined;
  const r = id ? results[id] : undefined;
  const [copied, setCopied] = useState(false);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.title}>
        <Initial letter={T.app.initial} />
        <View style={{ flex: 1 }}>
          <Txt title style={{ fontSize: S.hero, lineHeight: 42 }}>{T.app.name}</Txt>
          <Txt dim>{T.app.tagline}</Txt>
        </View>
      </View>

      <Card testID="daily">
        {t && id ? (
          <>
            <Txt style={{ fontWeight: '600' }}>{T.home.daily(today, t.kind)}</Txt>
            {r?.done ? (
              <>
                <Txt testID="daily-result" style={{ color: r.peeked ? C.inkSoft : C.spruce }}>{howSolved(r)}</Txt>
                <Button
                  testID="daily-share"
                  label={copied ? T.home.copied : T.home.share}
                  onPress={() => void shareOrCopy(shareText(today, t.kind, r)).then(setCopied)}
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

      <Txt title style={{ fontSize: S.lead, lineHeight: 28 }}>{T.home.notebooks}</Txt>
      {content.notebooks.map(b => {
        const open = b.free && b.tasks.length > 0;
        const c = counts(results, b.tasks);
        return (
          <Pressable key={b.key} testID={`notebook-${b.key}`} disabled={!open} onPress={() => setScreen({ name: 'notebook', key: b.key })} style={({ pressed }) => [styles.book, !open && styles.closed, pressed && { opacity: 0.8 }]}>
            <Txt style={{ fontWeight: '600' }}>{b.title}</Txt>
            <Txt dim>{b.blurb}</Txt>
            <Txt dim>{open ? T.home.progress(c.done, b.tasks.length, c.peeked) : T.home.later}</Txt>
          </Pressable>
        );
      })}

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

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 10 },
  book: { backgroundColor: C.paper, borderRadius: 10, borderWidth: 1, borderColor: C.line, padding: 14, gap: 4 },
  closed: { backgroundColor: C.cell, borderColor: C.cell },
});
