// «Буквица+» (08-game-design.md, «„Буквица+“ глазами игрока»; specs/2026-10-money.md): что входит, цена из
// RuStore, «Купить», «Восстановить покупки», почему покупка недоступна. Одно из трёх мест, где игра
// говорит о покупке: главная, закрытая тетрадь и короткий экран перед роликом.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { T } from '../i18n';
import { billing, buyPlus, openRuStore, syncRights, useMoney, type Availability } from '../money';
import type { Game } from '../state/game';
import { Button, Card, Header, Txt } from '../ui/kit';
import { C } from '../ui/theme';

export function PlusScreen({ game }: { game: Game }) {
  const money = useMoney();
  const [price, setPrice] = useState<string | null>(null);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let alive = true;
    billing.availability().then(a => alive && setAvail(a)).catch(() => alive && setAvail({ ok: false, why: 'error' }));
    billing.products().then(ps => alive && setPrice(ps.find(p => p.id === 'bukvitsa_plus')?.price ?? null)).catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const buy = async () => {
    setBusy(true);
    const r = await buyPlus();
    setBusy(false);
    setNote(r.ok ? null : r.why === 'cancelled' ? T.money.cancelled : r.why === 'unavailable' ? T.money.why['not-signed-in'] : T.money.failed);
  };
  const restore = async () => {
    setBusy(true);
    const a = await syncRights();
    setBusy(false);
    setNote(a.ok ? T.money.restored : T.money.why[a.why]);
  };
  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      <Header title={T.money.plus} onBack={() => game.setScreen({ name: 'home' })} back={T.task.back} />
      {money.plus ? (
        <Card testID="plus-thanks">
          <Txt style={{ color: C.spruce }}>{T.money.thanks}</Txt>
        </Card>
      ) : (
        <Card>
          {T.money.what.map(w => (
            <Txt key={w}>· {w}</Txt>
          ))}
          <Txt style={{ fontWeight: '600' }} testID="plus-price">{T.money.price(price)}</Txt>
          {avail && !avail.ok ? <Txt dim testID="plus-why">{T.money.why[avail.why]}</Txt> : null}
          <Button testID="plus-buy" label={T.money.buy} disabled={busy || !avail?.ok} onPress={() => void buy()} />
          {avail && !avail.ok && (avail.why === 'not-signed-in' || avail.why === 'no-rustore') ? <Button kind="ghost" label={T.money.openRuStore} onPress={() => openRuStore(avail.why)} /> : null}
          {billing.test ? <Txt dim>{T.money.test}</Txt> : null}
        </Card>
      )}
      <Button testID="plus-restore" kind="ghost" label={T.money.restore} disabled={busy} onPress={() => void restore()} />
      {note ? <Txt dim testID="plus-note">{note}</Txt> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({ wrap: { padding: 16, gap: 12, backgroundColor: C.linen, flexGrow: 1 } });
