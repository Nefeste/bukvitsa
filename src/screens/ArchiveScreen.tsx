// Архив (specs/2026-10-daily.md): месяцы списком, дни плашками со значками; касание открывает задачу.
// Будущих дней нет; дни до начала календаря не показываются.
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { archive } from '../engine';
import { content, task as taskById } from '../content';
import { T, monthName } from '../i18n';
import type { Game } from '../state/game';
import { Header, Txt } from '../ui/kit';
import { FONTS } from '../ui/fonts';
import { R, themed } from '../ui/theme';

export function ArchiveScreen({ game }: { game: Game }) {
  const styles = useStyles();
  const dates = archive(content.calendar, game.today);
  const months = new Map<string, string[]>();
  for (const d of dates) months.set(d.slice(0, 7), [...(months.get(d.slice(0, 7)) ?? []), d]);
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.archive.title} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      {dates.length === 0 ? <Txt dim>{T.archive.none}</Txt> : null}
      {[...months.entries()].map(([m, ds]) => (
        <View key={m} style={{ gap: 8 }}>
          <Txt style={{ fontWeight: '600' }}>{monthName(m)}</Txt>
          <View style={styles.grid}>
            {ds.map(d => {
              const id = content.calendar.days[d];
              const r = game.results[id];
              const mark = r?.done ? (r.peeked ? '○' : '●') : '·';
              return (
                <Pressable
                  key={d}
                  testID={`day-${d}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${d}: ${T.kind[taskById(id).kind].lower}, ${r?.done ? (r.peeked ? T.archive.peeked : T.archive.solved) : T.archive.open}`}
                  onPress={() => game.setScreen({ name: 'task', flow: { from: 'daily', date: d }, id })}
                  style={({ pressed }) => [styles.day, pressed && { opacity: 0.8 }]}>
                  <Text style={styles.num}>{Number(d.slice(8))}</Text>
                  <Text style={styles.mark}>{mark}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const useStyles = themed((c, z) =>
  StyleSheet.create({
    wrap: { padding: 16, gap: 14, backgroundColor: c.linen, flexGrow: 1 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    day: { width: z(48), height: z(52), borderRadius: R.tile, backgroundColor: c.paper, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
    num: { color: c.inkSoft, fontFamily: FONTS.body, fontSize: z(13) },
    mark: { color: c.spruce, fontFamily: FONTS.body, fontSize: z(16) },
  }),
);
