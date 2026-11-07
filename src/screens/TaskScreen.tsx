// Экран задачи: вопрос сверху, ответ — в нижней половине экрана, под большой палец
// (docs/08-game-design.md, «Одной рукой»). После решения — пословица целиком и откуда она.
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  endingChoices,
  endingSplit,
  extraText,
  extraWords,
  gapAnswer,
  gapErase,
  gapTap,
  gapTiles,
  endingPick,
  extraPick,
  partsInOrder,
  partsPick,
  partsShuffled,
  showAnswer,
  startPlay,
  tokens,
  usedTiles,
  takeHint,
  type Play,
  type Task,
} from '../engine';
import { task as taskById } from '../content';
import { T } from '../i18n';
import { resultOf } from '../state/progress';
import { flowTasks, type Flow, type Game } from '../state/game';
import { Button, Card, Header, Txt } from '../ui/kit';
import { FONTS } from '../ui/fonts';
import { C, R, S } from '../ui/theme';

export function TaskScreen({ game, flow, id }: { game: Game; flow: Flow; id: string }) {
  const task = taskById(id);
  const ids = flowTasks(flow);
  const n = ids.indexOf(id);
  const [play, setPlay] = useState<Play>(() => startPlay(task, resultOf(game.results, id)));
  const { record, results } = game;
  // итог пишется один раз — когда задача решена впервые
  useEffect(() => {
    if (play.result.done && !results[id]?.done) record(id, play.result);
  }, [play.result, id, record, results]);
  const view = play;

  const next = ids[n + 1];
  const goNext = () => {
    if (next) game.setScreen({ name: 'task', flow, id: next });
    else if (flow.from === 'day') game.setScreen({ name: 'day', date: flow.date });
    else game.setScreen({ name: 'notebook', id: flow.id });
  };
  const back = () => (flow.from === 'day' ? game.setScreen({ name: 'home' }) : game.setScreen({ name: 'notebook', id: flow.id }));

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.top}>
        <Header title={T.kind[task.kind].name} onBack={back} back={T.task.back} />
        <Txt dim testID="task-of">{T.task.of(n + 1, ids.length)}</Txt>
        <Question task={task} play={view} />
        {view.result.done ? <Solved task={task} play={view} /> : <Txt dim>{T.kind[task.kind].ask}</Txt>}
      </ScrollView>
      <View style={styles.bottom}>
        {view.result.done ? (
          <Button testID="next" label={next ? T.task.next : T.task.finish} onPress={goNext} />
        ) : (
          <>
            <Answer task={task} play={view} setPlay={setPlay} />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Button testID="hint" kind="ghost" label={T.task.hint} onPress={() => setPlay(p => takeHint(task, p))} />
              </View>
              <View style={{ flex: 1 }}>
                <Button testID="show" kind="ghost" label={T.task.show} onPress={() => setPlay(p => showAnswer(task, p))} />
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

/** Пословица с местом для ответа. */
function Question({ task, play }: { task: Task; play: Play }) {
  if (task.kind === 'gap') {
    const tiles = gapTiles(task);
    const hidden = task.word;
    return (
      <Txt style={styles.proverb} testID="question">
        {tokens(task.text).map((t, i) =>
          t.word && t.n === hidden ? (
            <Text key={i} style={styles.blank}>
              {play.result.done ? gapAnswer(task) : play.slots.map(s => (s == null ? '_' : tiles[s].toLowerCase())).join(' ')}
            </Text>
          ) : (
            t.text
          ),
        )}
      </Txt>
    );
  }
  if (task.kind === 'ending') {
    const { head } = endingSplit(task);
    return (
      <Txt style={styles.proverb} testID="question">
        {play.result.done ? task.text : `${head} …`}
      </Txt>
    );
  }
  if (task.kind === 'parts') {
    const parts = partsInOrder(task);
    return (
      <Txt style={styles.proverb} testID="question">
        {play.chosen.length ? play.chosen.map(i => parts[i]).join(' ') : '…'}
      </Txt>
    );
  }
  if (play.result.done) return <Txt style={styles.proverb} testID="question">{task.text}</Txt>;
  return <ExtraWords task={task} play={play} />;
}

function ExtraWords({ task, play }: { task: Task; play: Play }) {
  return <Txt style={styles.proverb} testID="question">{extraText(task).map((t, i) => (t.word ? <Text key={i} style={play.dimmed.includes(String(t.n)) ? styles.dimWord : undefined}>{t.text}</Text> : t.text))}</Txt>;
}

/** Нижняя половина: плитки, варианты, части или слова. */
function Answer({ task, play, setPlay }: { task: Task; play: Play; setPlay: (f: (p: Play) => Play) => void }) {
  if (task.kind === 'gap') {
    const tiles = gapTiles(task);
    const used = usedTiles(play);
    return (
      <View style={{ gap: 12 }}>
        <View style={styles.slots}>
          {play.slots.map((s, i) => (
            <Pressable
              key={i}
              testID={`slot-${i}`}
              accessibilityRole="button"
              accessibilityLabel={T.task.slot(i + 1, s == null ? null : tiles[s])}
              onPress={() => setPlay(p => gapErase(p, i))}
              style={[styles.slot, play.locked[i] && styles.slotLocked, play.wrong && !play.locked[i] && styles.slotWrong]}>
              <Text style={styles.tileText}>{s == null ? '' : tiles[s]}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.tiles}>
          {tiles.map((c, i) => (
            <Pressable
              key={i}
              testID={`tile-${i}`}
              accessibilityRole="button"
              accessibilityLabel={T.task.tile(c)}
              disabled={used.has(i)}
              onPress={() => setPlay(p => gapTap(task, p, i))}
              style={({ pressed }) => [styles.tile, used.has(i) && styles.tileUsed, pressed && styles.pressed]}>
              <Text style={styles.tileText}>{used.has(i) ? '' : c}</Text>
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  if (task.kind === 'ending') {
    return (
      <View style={{ gap: 8 }}>
        {endingChoices(task).map((c, i) => (
          <Pressable
            key={i}
            testID={`choice-${i}`}
            accessibilityRole="button"
            disabled={play.dimmed.includes(c)}
            onPress={() => setPlay(p => endingPick(task, p, c))}
            style={({ pressed }) => [styles.choice, play.dimmed.includes(c) && styles.choiceDim, pressed && styles.pressed]}>
            <Text style={[styles.choiceText, play.dimmed.includes(c) && styles.dimWord]}>… {c}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  if (task.kind === 'parts') {
    const parts = partsInOrder(task);
    return (
      <View style={{ gap: 8 }}>
        {partsShuffled(task).map(i =>
          play.chosen.includes(i) ? null : (
            <Pressable key={i} testID={`part-${i}`} accessibilityRole="button" onPress={() => setPlay(p => partsPick(task, p, i))} style={({ pressed }) => [styles.choice, play.wrong && styles.choiceShake, pressed && styles.pressed]}>
              <Text style={styles.choiceText}>{parts[i]}</Text>
            </Pressable>
          ),
        )}
      </View>
    );
  }
  const ws = extraWords(task);
  return (
    <View style={styles.tiles}>
      {ws.map((w, i) => (
        <Pressable
          key={i}
          testID={`word-${i}`}
          accessibilityRole="button"
          disabled={play.dimmed.includes(String(i))}
          onPress={() => setPlay(p => extraPick(task, p, i))}
          style={({ pressed }) => [styles.word, play.dimmed.includes(String(i)) && styles.choiceDim, pressed && styles.pressed]}>
          <Text style={[styles.choiceText, play.dimmed.includes(String(i)) && styles.dimWord]}>{w}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** После решения: верно или ответ, сколько подсказок и ошибок, откуда пословица. */
function Solved({ task, play }: { task: Task; play: Play }) {
  const r = play.result;
  return (
    <Card testID="solved">
      <Txt style={{ fontWeight: '600', color: r.shown ? C.inkSoft : C.spruce }}>{r.shown ? T.task.shown : T.task.right}</Txt>
      {task.kind === 'extra' ? <Txt dim>{`${extraWords(task)[task.word ?? 0]} → ${tokens(task.text).find(t => t.word && t.n === task.word)?.text ?? ''}`}</Txt> : null}
      <Txt dim>{`${T.task.hints(r.hints)}, ${T.task.mistakes(r.mistakes)}`}</Txt>
      <Txt dim testID="source">{T.task.from(task.section)}</Txt>
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.linen },
  top: { padding: 16, gap: 12 },
  bottom: { padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.linen },
  row: { flexDirection: 'row', gap: 10 },
  proverb: { fontSize: S.lead, lineHeight: 32, fontFamily: FONTS.body },
  blank: { color: C.kumach, fontFamily: FONTS.bold, letterSpacing: 2 },
  slots: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  slot: { width: 40, height: 48, borderRadius: R.tile, backgroundColor: C.cell, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.cell },
  slotLocked: { borderColor: C.spruce, backgroundColor: C.paper },
  slotWrong: { borderColor: C.kumach },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  tile: { width: 42, height: 50, borderRadius: R.tile, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  tileUsed: { backgroundColor: C.cell, borderColor: C.cell },
  tileText: { fontSize: 24, color: C.ink, fontFamily: FONTS.title },
  choice: { borderRadius: R.button, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 14 },
  choiceDim: { backgroundColor: C.cell, borderColor: C.cell },
  choiceShake: { borderColor: C.line },
  choiceText: { fontSize: S.body, color: C.ink, fontFamily: FONTS.body, lineHeight: 24 },
  word: { borderRadius: R.button, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, paddingVertical: 10, paddingHorizontal: 12 },
  dimWord: { color: C.inkSoft, textDecorationLine: 'line-through' },
  pressed: { opacity: 0.8 },
});
