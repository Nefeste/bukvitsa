// Сборник (08-game-design.md, «Сборник»): всё решённое игроком — звание, счёт по видам, сами пословицы и загадки,
// новые сверху. Только складывается: звание не теряется, пропущенный день ничего не отнимает.
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { Kind } from '../engine';
import { content, task as taskById } from '../content';
import { T } from '../i18n';
import { cleanCount, rankOf, solvedIds } from '../state/progress';
import type { Game } from '../state/game';
import { Button, Card, Header, Txt } from '../ui/kit';
import { themed, useLook } from '../ui/theme';

const PAGE = 30;
const KINDS: Kind[] = ['proverb', 'ending', 'riddle', 'extra-letter', 'parts', 'cipher', 'old-word'];

export function CollectionScreen({ game }: { game: Game }) {
  const styles = useStyles();
  const look = useLook();
  const [shown, setShown] = useState(PAGE);
  const { results, save } = game;
  const all = useMemo(() => content.tasks.map(t => t.id), []);
  const solved = useMemo(() => new Set(solvedIds(results, all)), [results, all]);
  // новые сверху: по последнему событию «решена» о задаче
  const list = useMemo(() => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (let i = save.events.length - 1; i >= 0; i--) {
      const e = save.events[i];
      if (e.t !== 'solved' || seen.has(e.id) || !solved.has(e.id)) continue;
      seen.add(e.id);
      out.push(e.id);
    }
    return out;
  }, [save.events, solved]);
  const { rank, next } = rankOf(solved.size);
  const share = next ? Math.min(1, solved.size / next) : 1;
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.collection.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      <Card testID="collection-rank">
        <Txt title testID="rank-name">{rank >= 0 ? T.collection.ranks[rank] : T.collection.none}</Txt>
        <Txt testID="collection-solved">{T.collection.solved(solved.size, all.length)}</Txt>
        <Txt dim>{T.collection.clean(cleanCount(results, all))}</Txt>
        <View style={styles.bar} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: next ?? solved.size, now: solved.size }}>
          <View style={[styles.fill, { width: `${Math.round(share * 100)}%` }]} />
        </View>
        <Txt dim testID="rank-next">{next ? T.collection.toNext(next - solved.size, T.collection.ranks[rank + 1]) : T.collection.top}</Txt>
        <Txt dim>{T.collection.about}</Txt>
      </Card>
      <Card>
        <Txt style={{ fontWeight: '600' }}>{T.collection.byKind}</Txt>
        {KINDS.map(k => {
          const ids = content.tasks.filter(t => t.kind === k).map(t => t.id);
          if (!ids.length) return null;
          return <Txt key={k} dim>{T.collection.kindRow(T.kind[k].name, ids.filter(id => solved.has(id)).length, ids.length)}</Txt>;
        })}
      </Card>
      <Txt title style={{ fontSize: look.z(20), lineHeight: look.z(28) }}>{T.collection.list}</Txt>
      {list.length === 0 ? <Txt dim testID="collection-empty">{T.collection.empty}</Txt> : null}
      {list.slice(0, shown).map(id => {
        const t = taskById(id);
        return (
          <View key={id} style={styles.item} testID="collection-item">
            <Txt>{t.kind === 'riddle' || t.kind === 'old-word' ? `${t.text} — ${t.answer}` : t.text}</Txt>
            <Txt dim>{T.kind[t.kind].name}</Txt>
          </View>
        );
      })}
      {list.length > shown ? <Button testID="collection-more" kind="ghost" label={T.collection.more} onPress={() => setShown(n => n + PAGE)} /> : null}
    </ScrollView>
  );
}

const useStyles = themed(c =>
  StyleSheet.create({
    wrap: { padding: 16, gap: 12, backgroundColor: c.linen, flexGrow: 1 },
    bar: { height: 8, borderRadius: 4, backgroundColor: c.cell, overflow: 'hidden' },
    fill: { height: 8, borderRadius: 4, backgroundColor: c.spruce },
    item: { backgroundColor: c.paper, borderRadius: 10, borderWidth: 1, borderColor: c.line, padding: 12, gap: 2 },
  }),
);
