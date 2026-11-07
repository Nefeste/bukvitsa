// Тетради по темам: сколько решено в каждой. Все тетради открыты, без замков.
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { content } from '../content';
import { T } from '../i18n';
import { doneCount } from '../state/progress';
import type { Game } from '../state/game';
import { Card, Header, Txt } from '../ui/kit';
import { C } from '../ui/theme';

export function NotebooksScreen({ game }: { game: Game }) {
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.notebook.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      {content.notebooks.map(b => (
        <Card key={b.id} testID={`notebook-${b.id}`} onPress={() => game.setScreen({ name: 'notebook', id: b.id })}>
          <Txt style={{ fontWeight: '600' }}>{b.title}</Txt>
          <Txt dim>{b.about}</Txt>
          <Txt dim>{T.notebook.progress(doneCount(game.results, b.tasks), b.tasks.length)}</Txt>
        </Card>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1 } });
