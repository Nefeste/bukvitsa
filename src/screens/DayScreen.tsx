// Итог дня: кружки, сколько без подсказок, «Поделиться» текстом — без ответов.
import React from 'react';
import { ScrollView, Share, StyleSheet, Text } from 'react-native';
import { cleanCount, dailyTasks } from '../engine';
import { content } from '../content';
import { T, humanDate, shareText } from '../i18n';
import { marksOf, type Game } from '../state/game';
import { Button, Card, Header, Marks, Txt } from '../ui/kit';
import { C } from '../ui/theme';

export function DayScreen({ game, date }: { game: Game; date: string }) {
  const ids = dailyTasks(content.calendar, date);
  const rs = ids.map(id => game.results[id]);
  const text = shareText(date, rs);
  const clean = cleanCount(rs);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.day.title(humanDate(date))} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      <Card testID="day-result">
        <Marks marks={marksOf(game.results, ids)} size={32} testID="day-marks" />
        <Txt>{T.day.clean(clean, ids.length)}</Txt>
        <Txt dim>{T.day.legend}</Txt>
      </Card>
      <Button testID="share" label={T.day.share} onPress={() => void Share.share({ message: text }).catch(() => undefined)} />
      {/* текст «Поделиться» уходит в мессенджер; на экране вместо него — нарисованные кружки */}
      <Text testID="share-text" style={styles.hidden}>
        {text}
      </Text>
      <Txt dim>{T.day.tomorrow}</Txt>
      <Button testID="home" kind="ghost" label={T.day.home} onPress={() => game.setScreen({ name: 'home' })} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 14, backgroundColor: C.linen, flexGrow: 1 },
  hidden: { position: 'absolute', width: 1, height: 1, opacity: 0 },
});
