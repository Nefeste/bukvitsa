// Первый экран: буквица-заставка, задачи дня, тетради, прошлые дни.
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { dailyTasks } from '../engine';
import { content } from '../content';
import { T, humanDate } from '../i18n';
import { doneCount, nextOpen } from '../state/progress';
import { marksOf, type Game } from '../state/game';
import { Button, Card, Marks, Txt } from '../ui/kit';
import { Initial } from '../ui/Initial';
import { C, S } from '../ui/theme';

export function HomeScreen({ game }: { game: Game }) {
  const { results, today, setScreen } = game;
  const ids = dailyTasks(content.calendar, today);
  const done = doneCount(results, ids);
  const open = nextOpen(results, ids);
  const flow = { from: 'day' as const, date: today };
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <View style={styles.title}>
        <Initial letter={T.app.initial} />
        <View style={{ flex: 1 }}>
          <Txt title style={{ fontSize: S.hero, lineHeight: 42 }}>{T.app.name}</Txt>
          <Txt dim>{T.app.tagline}</Txt>
        </View>
      </View>

      <Card testID="today">
        <Txt style={{ fontWeight: '600' }}>{T.home.today(humanDate(today))}</Txt>
        <Txt dim>{T.home.todayAbout}</Txt>
        <Marks marks={marksOf(results, ids)} testID="today-marks" />
        {open ? (
          <Button testID="today-start" label={done ? T.home.resume : T.home.start} onPress={() => setScreen({ name: 'task', flow, id: open })} />
        ) : (
          <Button testID="today-done" label={T.home.done} onPress={() => setScreen({ name: 'day', date: today })} />
        )}
      </Card>

      <Card testID="notebooks" onPress={() => setScreen({ name: 'notebooks' })}>
        <Txt style={{ fontWeight: '600' }}>{T.home.notebooks}</Txt>
        <Txt dim>{T.home.notebooksAbout}</Txt>
      </Card>

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
  wrap: { padding: 16, gap: 14, backgroundColor: C.linen, flexGrow: 1 },
  title: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 8 },
  row: { flexDirection: 'row', gap: 10 },
});
