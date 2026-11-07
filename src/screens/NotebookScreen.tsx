// Одна тетрадь: клетки задач с кружками; касание — к задаче. «Открыть» — к первой нерешённой.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { content } from '../content';
import { T } from '../i18n';
import { doneCount, nextOpen } from '../state/progress';
import { marksOf, type Game } from '../state/game';
import { Button, Header, Txt } from '../ui/kit';
import { FONTS } from '../ui/fonts';
import { C, R } from '../ui/theme';

export function NotebookScreen({ game, id }: { game: Game; id: string }) {
  const b = content.notebooks.find(x => x.id === id);
  if (!b) return null;
  const flow = { from: 'notebook' as const, id };
  const open = nextOpen(game.results, b.tasks);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={b.title} onBack={() => game.setScreen({ name: 'notebooks' })} back={T.notebook.title} />
      <Txt dim>{`${b.about} · ${T.notebook.progress(doneCount(game.results, b.tasks), b.tasks.length)}`}</Txt>
      {open ? <Button testID="notebook-open" label={T.notebook.open} onPress={() => game.setScreen({ name: 'task', flow, id: open })} /> : <Txt>{T.notebook.complete}</Txt>}
      <View style={styles.grid}>
        {b.tasks.map((t, i) => (
          <Pressable key={t} testID={`cell-${i}`} accessibilityRole="button" onPress={() => game.setScreen({ name: 'task', flow, id: t })} style={({ pressed }) => [styles.cell, pressed && { opacity: 0.8 }]}>
            <Text style={styles.num}>{i + 1}</Text>
            <Text style={styles.mark}>{marksOf(game.results, [t])}</Text>
          </Pressable>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 56, height: 56, borderRadius: R.tile, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  num: { color: C.inkSoft, fontFamily: FONTS.body, fontSize: 13 },
  mark: { color: C.spruce, fontFamily: FONTS.body, fontSize: 18 },
});
