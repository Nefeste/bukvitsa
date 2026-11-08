// Тетрадь (08-game-design.md, «Тетради»): название, «12 из 40 · 2 подсмотрены», задачи значками
// (решена, подсмотрена, не тронута); касание — к задаче, решать можно в любом порядке. Первая тетрадь
// бесплатна; в остальных без «Буквицы+» открыты задачи, открытые роликами по желанию — по десять,
// навсегда (canOpen в движке). Закрытая — «Открыть в „Буквице+“» и «Десять задач за ролик».
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { canOpen } from '../engine';
import { content, task as taskById } from '../content';
import { T } from '../i18n';
import { prepareRewarded, rewardedReady, TENS, useMoney, watchForTens } from '../money';
import { counts } from '../state/progress';
import type { Game } from '../state/game';
import { Button, Header, Txt } from '../ui/kit';
import { FONTS } from '../ui/fonts';
import { R, themed } from '../ui/theme';

export function NotebookScreen({ game, book }: { game: Game; book: string }) {
  const styles = useStyles();
  const money = useMoney();
  const [ready, setReady] = useState(() => rewardedReady());
  const b = content.notebooks.find(x => x.key === book);
  const opened = money.opened[book] ?? 0;
  const locked = !!b && !b.free && !money.plus && opened < b.tasks.length;
  const { setScreen, settings } = game;
  useEffect(() => {
    if (locked) prepareRewarded(() => setReady(true));
  }, [locked]);
  // перед первым роликом — экран согласия; ответ вернёт сюда же, кнопка ждёт второго касания
  const tens = async () => {
    if (!b) return;
    if (!settings.adsConsent) {
      setScreen({ name: 'consent', next: { name: 'notebook', key: book } });
      return;
    }
    setReady(false);
    await watchForTens(book, b.tasks.length);
    prepareRewarded(() => setReady(true));
  };
  if (!b) return null;
  const c = counts(game.results, b.tasks);
  const flow = { from: 'notebook' as const, key: book };
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={b.title} onBack={() => setScreen({ name: 'home' })} back={T.task.back} />
      <Txt dim>{b.blurb}</Txt>
      <Txt dim testID="notebook-progress">{c.done === b.tasks.length ? T.notebook.done : T.home.progress(c.done, b.tasks.length, c.peeked)}</Txt>
      {locked ? <Txt dim testID="notebook-opened">{T.money.opened(opened, b.tasks.length)}</Txt> : null}
      <View style={styles.grid}>
        {b.tasks.map((id, i) => {
          const r = game.results[id];
          const open = canOpen(i, b.free, money.plus, opened) === 'open';
          const mark = !open ? '' : r?.done ? (r.peeked ? '○' : '●') : '·';
          return (
            <Pressable
              key={id}
              testID={`cell-${i}`}
              accessibilityRole="button"
              accessibilityState={{ disabled: !open }}
              disabled={!open}
              accessibilityLabel={`${T.notebook.item(i + 1)}: ${open ? `${T.kind[taskById(id).kind].lower}, ${r?.done ? (r.peeked ? T.notebook.peeked : T.notebook.solved) : T.notebook.open}` : T.money.locked}`}
              onPress={() => setScreen({ name: 'task', flow, id })}
              style={({ pressed }) => [styles.cell, !open && styles.cellLocked, pressed && { opacity: 0.8 }]}>
              <Text style={[styles.num, !open && { opacity: 0.5 }]}>{i + 1}</Text>
              <Text style={styles.mark}>{mark}</Text>
            </Pressable>
          );
        })}
      </View>
      {locked ? (
        <View style={{ gap: 8 }}>
          <Button testID="open-plus" label={T.money.openPlus} onPress={() => setScreen({ name: 'plus' })} />
          <Button testID="tens" kind="ghost" label={ready ? T.money.tens(TENS) : T.money.needNet} disabled={!ready} onPress={() => void tens()} />
        </View>
      ) : null}
    </ScrollView>
  );
}

const useStyles = themed((c, z) =>
  StyleSheet.create({
    wrap: { padding: 16, gap: 12, backgroundColor: c.linen, flexGrow: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cell: { width: z(52), height: z(52), borderRadius: R.tile, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
    cellLocked: { backgroundColor: c.cell, borderColor: c.cell },
    num: { color: c.inkSoft, fontFamily: FONTS.body, fontSize: z(13) },
    mark: { color: c.spruce, fontFamily: FONTS.body, fontSize: z(18) },
  }),
);
