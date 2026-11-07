// Тетрадь (08-game-design.md, «Тетради»): название, «12 из 40 · 2 подсмотрены», задачи значками
// (решена, подсмотрена, не тронута); касание — к задаче, решать можно в любом порядке.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { content, task as taskById } from '../content';
import { T } from '../i18n';
import { counts } from '../state/progress';
import type { Game } from '../state/game';
import { Header, Txt } from '../ui/kit';
import { FONTS } from '../ui/fonts';
import { C, R } from '../ui/theme';

export function NotebookScreen({ game, book }: { game: Game; book: string }) {
  const b = content.notebooks.find(x => x.key === book);
  if (!b) return null;
  const c = counts(game.results, b.tasks);
  const flow = { from: 'notebook' as const, key: book };
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={b.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      <Txt dim>{b.blurb}</Txt>
      <Txt dim testID="notebook-progress">{c.done === b.tasks.length ? T.notebook.done : T.home.progress(c.done, b.tasks.length, c.peeked)}</Txt>
      <View style={styles.grid}>
        {b.tasks.map((id, i) => {
          const r = game.results[id];
          const mark = r?.done ? (r.peeked ? '○' : '●') : '·';
          return (
            <Pressable
              key={id}
              testID={`cell-${i}`}
              accessibilityRole="button"
              accessibilityLabel={`${T.notebook.item(i + 1)}: ${T.kind[taskById(id).kind].lower}, ${r?.done ? (r.peeked ? T.notebook.peeked : T.notebook.solved) : T.notebook.open}`}
              onPress={() => game.setScreen({ name: 'task', flow, id })}
              style={({ pressed }) => [styles.cell, pressed && { opacity: 0.8 }]}>
              <Text style={styles.num}>{i + 1}</Text>
              <Text style={styles.mark}>{mark}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: 52, height: 52, borderRadius: R.tile, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  num: { color: C.inkSoft, fontFamily: FONTS.body, fontSize: 13 },
  mark: { color: C.spruce, fontFamily: FONTS.body, fontSize: 18 },
});
