// Экран «Задача» (08-game-design.md, «Пять видов задач», «Подсказки», «Откуда это»): условие крупно,
// поле ответа, ряд букв / варианты / строка / части, три подсказки по порядку. Решил — «Верно» и
// карточка «Откуда это» с «Ещё» и «На главную».
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import {
  choose,
  hint,
  nextHint,
  openWord,
  pickPart,
  place,
  startPlay,
  tapLetter,
  unpickPart,
  unplace,
  usedTiles,
  type Play,
  type Task,
} from '../engine';
import { content, task as taskById } from '../content';
import { T, howSolved, shareText } from '../i18n';
import { interstitialDue, notebookTaskSolved } from '../money';
import { nextOpen, resultOf } from '../state/progress';
import { shareOrCopy } from '../state/share';
import type { Flow, Game } from '../state/game';
import { Button, Card, Header, Txt } from '../ui/kit';
import { FONTS } from '../ui/fonts';
import { C, R, S } from '../ui/theme';

export function TaskScreen({ game, flow, id }: { game: Game; flow: Flow; id: string }) {
  const task = taskById(id);
  const [play, setPlay] = useState<Play>(() => startPlay(task, resultOf(game.results, id)));
  const { record, results, setScreen } = game;
  // итог пишется, когда задача решена или подсмотрена; решённая заново подсмотренная — тоже
  useEffect(() => {
    const prev = results[id];
    if (play.result.done && (!prev?.done || (prev.peeked && !play.result.peeked))) {
      record(id, play.result);
      // реклама считает только задачи тетрадей; задача дня её не двигает (08-game-design.md, «Реклама»)
      if (flow.from === 'notebook' && !prev?.done) notebookTaskSolved();
    }
  }, [play.result, id, record, results, flow.from]);
  const h = nextHint(task, play);
  const hintLabel = (n: number) =>
    n === 2 && task.kind === 'parts' ? T.task.hintPart : n === 2 && task.kind === 'ending' ? T.task.hintFirstWord : n === 1 && task.kind === 'extra-letter' ? T.task.hintWord : T.task.hint[n];
  const back = () => setScreen(flow.from === 'daily' ? { name: 'home' } : { name: 'notebook', key: flow.key });
  const more = () => {
    if (flow.from !== 'notebook') return;
    const ids = content.notebooks.find(b => b.key === flow.key)?.tasks ?? [];
    const next = nextOpen({ ...results, [id]: play.result }, ids, id);
    const to = next ? { name: 'task' as const, flow, id: next } : { name: 'notebook' as const, key: flow.key };
    // межстраничный ролик — только здесь, между задачами тетради, и только если движок разрешил
    if (interstitialDue('between', game.today)) {
      const ad = { name: 'ad' as const, next: to };
      setScreen(game.settings.adsConsent ? ad : { name: 'consent', next: ad });
      return;
    }
    setScreen(to);
  };

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.top}>
        <Header title={T.kind[task.kind].name} onBack={back} back={T.task.back} />
        {play.result.done ? <Source task={task} play={play} flow={flow} /> : <Question task={task} play={play} setPlay={setPlay} />}
      </ScrollView>
      <View style={styles.bottom}>
        {play.result.done ? (
          <View style={styles.row}>
            {flow.from === 'notebook' ? (
              <View style={{ flex: 1 }}>
                <Button testID="more" label={T.task.more} onPress={more} />
              </View>
            ) : null}
            <View style={{ flex: 1 }}>
              <Button testID="home" kind={flow.from === 'notebook' ? 'ghost' : 'primary'} label={T.task.home} onPress={() => setScreen({ name: 'home' })} />
            </View>
          </View>
        ) : (
          <>
            <Answer task={task} play={play} setPlay={setPlay} />
            {h != null ? <Button testID={`hint-${h}`} kind="ghost" label={hintLabel(h)} onPress={() => setPlay(p => hint(task, p))} /> : null}
          </>
        )}
      </View>
    </View>
  );
}

function Question({ task, play, setPlay }: { task: Task; play: Play; setPlay: (f: (p: Play) => Play) => void }) {
  if (task.kind === 'extra-letter') {
    // найти в строке: слова плашками; раскрытое слово — по буквам
    return (
      <View style={{ gap: 12 }}>
        <Txt dim>{T.kind[task.kind].ask}</Txt>
        <View style={styles.wrapRow} testID="question">
          {(task.words ?? []).map((w, i) => (
            <Pressable
              key={i}
              testID={`word-${i}`}
              accessibilityRole="button"
              accessibilityLabel={T.task.word(w)}
              onPress={() => setPlay(p => openWord(p, i))}
              style={[styles.word, play.open === i && styles.wordOpen, play.marked === i && styles.wordMarked]}>
              <Text style={styles.wordText}>{w}</Text>
            </Pressable>
          ))}
        </View>
        {play.open != null ? (
          <View style={[styles.wrapRow, play.shake && styles.shake]}>
            {[...(task.words?.[play.open] ?? '')].map((c, k) => {
              const miss = play.missed.includes(`${play.open}:${k}`);
              return (
                <Pressable key={k} testID={`letter-${k}`} accessibilityRole="button" accessibilityLabel={T.task.letter(c)} disabled={miss} onPress={() => setPlay(p => tapLetter(task, p, k))} style={[styles.tile, miss && styles.tileUsed]}>
                  <Text style={[styles.tileText, miss && { color: C.inkSoft }]}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    );
  }
  if (task.kind === 'parts') {
    const parts = task.parts ?? [];
    return (
      <View style={{ gap: 10 }}>
        <Txt dim>{T.kind[task.kind].ask}</Txt>
        <View style={[styles.answerBox, play.shake && styles.shake]} testID="question">
          {play.chosen.length ? (
            play.chosen.map((c, k) => (
              <Pressable key={k} testID={`placed-${k}`} accessibilityRole="button" onPress={() => setPlay(p => unpickPart(p, k))}>
                <Text style={[styles.proverbText, k < play.fixed && { color: C.spruce }]}>{parts[c]}</Text>
              </Pressable>
            ))
          ) : (
            <Text style={styles.proverbText}>…</Text>
          )}
        </View>
      </View>
    );
  }
  return (
    <View style={{ gap: 10 }}>
      <Txt style={styles.proverbText} testID="question">
        {task.prompt}
      </Txt>
      <Txt dim>{play.first ? (task.kind === 'ending' ? T.task.firstWord(play.first) : T.task.first(play.first)) : T.kind[task.kind].ask}</Txt>
    </View>
  );
}

/** Нижняя половина экрана — под большой палец. */
function Answer({ task, play, setPlay }: { task: Task; play: Play; setPlay: (f: (p: Play) => Play) => void }) {
  if (task.kind === 'proverb' || task.kind === 'riddle') {
    const row = task.row ?? [];
    const used = usedTiles(play);
    return (
      <View style={{ gap: 12 }}>
        <View style={[styles.wrapRow, play.shake && styles.shake]}>
          {play.slots.map((s, i) => (
            <Pressable
              key={i}
              testID={`slot-${i}`}
              accessibilityRole="button"
              accessibilityLabel={T.task.slot(i + 1, s == null ? null : row[s].toUpperCase())}
              onPress={() => setPlay(p => unplace(p, i))}
              style={[styles.slot, play.locked[i] && styles.slotLocked]}>
              <Text style={styles.tileText}>{s == null ? '' : row[s].toUpperCase()}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.wrapRow}>
          {row.map((c, i) => {
            const off = used.has(i) || play.hidden.includes(i);
            return (
              <Pressable key={i} testID={`tile-${i}`} accessibilityRole="button" accessibilityLabel={T.task.tile(c.toUpperCase())} disabled={off} onPress={() => setPlay(p => place(task, p, i))} style={({ pressed }) => [styles.tile, off && styles.tileUsed, pressed && styles.pressed]}>
                <Text style={styles.tileText}>{off ? '' : c.toUpperCase()}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    );
  }
  if (task.kind === 'old-word' || task.kind === 'ending') {
    return (
      <View style={{ gap: 8 }}>
        {(task.options ?? []).map((o, i) => {
          const off = play.dimmed.includes(i);
          return (
            <Pressable key={i} testID={`option-${i}`} accessibilityRole="button" disabled={off} onPress={() => setPlay(p => choose(task, p, i))} style={({ pressed }) => [styles.choice, off && styles.choiceOff, pressed && styles.pressed]}>
              <Text style={[styles.choiceText, off && styles.off]}>{o}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  if (task.kind === 'parts') {
    const parts = task.parts ?? [];
    return (
      <View style={{ gap: 8 }}>
        {parts.map((t, i) =>
          play.chosen.includes(i) ? null : (
            <Pressable key={i} testID={`part-${i}`} accessibilityRole="button" onPress={() => setPlay(p => pickPart(task, p, i))} style={({ pressed }) => [styles.choice, pressed && styles.pressed]}>
              <Text style={styles.choiceText}>{t}</Text>
            </Pressable>
          ),
        )}
      </View>
    );
  }
  return null;
}

/** «Откуда это»: «Верно» или «Подсмотрена», полный текст, источник, строка о значении. */
function Source({ task, play, flow }: { task: Task; play: Play; flow: Flow }) {
  const r = play.result;
  const [copied, setCopied] = useState(false);
  return (
    <View style={{ gap: 12 }}>
      <Txt style={{ fontWeight: '600', color: r.peeked ? C.inkSoft : C.spruce }} testID="verdict">
        {r.peeked ? T.task.peeked : T.task.right}
      </Txt>
      <Card testID="source">
        <Txt dim>{T.task.from}</Txt>
        <Txt style={styles.proverbText}>{task.kind === 'riddle' ? `${task.text} — ${task.answer}` : task.text}</Txt>
        <Txt dim>{task.source}</Txt>
        <Txt>{task.about}</Txt>
      </Card>
      {flow.from === 'daily' ? (
        <>
          <Txt dim>{howSolved(r)}</Txt>
          <Button testID="share" kind="ghost" label={copied ? T.home.copied : T.home.share} onPress={() => void shareOrCopy(shareText(flow.date, task.kind, r)).then(setCopied)} />
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.linen },
  top: { padding: 16, gap: 12 },
  bottom: { padding: 16, gap: 12, borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.linen },
  row: { flexDirection: 'row', gap: 10 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, justifyContent: 'center' },
  proverbText: { fontSize: 22, lineHeight: 32, fontFamily: FONTS.body, color: C.ink },
  answerBox: { minHeight: 64, gap: 4, padding: 12, borderRadius: R.card, borderWidth: 1, borderColor: C.line, backgroundColor: C.paper },
  slot: { width: 48, height: 52, borderRadius: R.tile, backgroundColor: C.cell, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.cell },
  slotLocked: { borderColor: C.spruce, backgroundColor: C.paper },
  tile: { width: 48, height: 52, borderRadius: R.tile, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  tileUsed: { backgroundColor: C.cell, borderColor: C.cell },
  tileText: { fontSize: 24, color: C.ink, fontFamily: FONTS.title },
  /** неверная проверка: рамка кумачом вокруг поля — отклик на касание игрока, без движения */
  shake: { borderWidth: 2, borderColor: C.kumach, borderRadius: R.card, padding: 4 },
  word: { borderRadius: R.button, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, paddingVertical: 10, paddingHorizontal: 12 },
  wordOpen: { borderColor: C.ink },
  wordMarked: { borderColor: C.spruce, borderWidth: 2 },
  wordText: { fontSize: S.body, color: C.ink, fontFamily: FONTS.body },
  choice: { borderRadius: R.button, backgroundColor: C.paper, borderWidth: 1, borderColor: C.line, paddingVertical: 12, paddingHorizontal: 14 },
  choiceOff: { backgroundColor: C.cell, borderColor: C.cell },
  choiceText: { fontSize: S.body, color: C.ink, fontFamily: FONTS.body, lineHeight: 24 },
  off: { color: C.inkSoft, textDecorationLine: 'line-through' },
  pressed: { opacity: 0.8 },
});
