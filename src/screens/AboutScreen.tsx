// Об игре: версия, откуда пословицы, сколько задач ещё на проверке, как написать студии.
import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { content } from '../content';
import { T } from '../i18n';
import type { Game } from '../state/game';
import { APP_BUILD, APP_VERSION } from '../version';
import { Card, Header, Txt } from '../ui/kit';
import { C } from '../ui/theme';

export function AboutScreen({ game }: { game: Game }) {
  const s = content.source;
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.about.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      <Card>
        <Txt testID="about-version">{T.about.version(APP_VERSION, APP_BUILD)}</Txt>
        <Txt dim>{T.about.source(s.author, s.title, s.year)}</Txt>
        {content.draft ? <Txt dim>{T.about.draft(content.draft)}</Txt> : null}
        <Txt dim>{T.about.noNet}</Txt>
        <Txt dim>{T.about.studio}</Txt>
        <Txt dim>{T.about.support}</Txt>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1 } });
