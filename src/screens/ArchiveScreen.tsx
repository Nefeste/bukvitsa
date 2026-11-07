// Прошлые дни: с начала календаря до сегодня. Пропущенный день ждёт — без отметок «пропущено».
import React from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { archiveDates, dailyTasks } from '../engine';
import { content } from '../content';
import { T, humanDate } from '../i18n';
import { nextOpen } from '../state/progress';
import { marksOf, type Game } from '../state/game';
import { Card, Header, Marks, Txt } from '../ui/kit';
import { C } from '../ui/theme';

export function ArchiveScreen({ game }: { game: Game }) {
  const dates = archiveDates(content.calendar, game.today);
  return (
    <View style={styles.root}>
      <View style={{ padding: 16, paddingBottom: 4 }}>
        <Header title={T.archive.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      </View>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10 }}
        data={dates}
        keyExtractor={d => d}
        renderItem={({ item, index }) => {
          const ids = dailyTasks(content.calendar, item);
          const open = nextOpen(game.results, ids);
          const flow = { from: 'day' as const, date: item };
          return (
            <Card testID={`day-${item}`} onPress={() => game.setScreen(open ? { name: 'task', flow, id: open } : { name: 'day', date: item })}>
              <Txt style={{ fontWeight: '600' }}>{`${humanDate(item)}${index === 0 ? ` · ${T.archive.today}` : ''}`}</Txt>
              <Marks marks={marksOf(game.results, ids)} />
            </Card>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: C.linen } });
