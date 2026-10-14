import type { CommandError, Engine, Result } from '@expense/engine';
import type { Translate } from '@expense/i18n';
import { type DemoKey, K } from './i18n';

// Il gruppo di esempio della demo: tre persone, quattro spese divise in modi diversi e un rimborso, così chi
// visita vede subito spese, saldi e storico. Si crea con i comandi pubblici dell'engine, gli stessi della UI.

/** Data di qualche giorno fa (AAAA-MM-GG), perché l'esempio abbia uno storico credibile. */
function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${String(date.getFullYear())}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const eur = (minor: number) => ({ minor, currency: 'EUR' });

/** Crea il gruppo e restituisce il suo id, oppure il primo errore. */
export async function createSampleGroup(
  engine: Engine,
  t: Translate<DemoKey>,
): Promise<Result<string, CommandError>> {
  const created = await engine.execute({
    type: 'CreateGroup',
    name: t(K.sample.group),
    baseCurrency: 'EUR',
    me: { name: t(K.sample.me) },
  });
  if (!created.ok) return created;
  const { groupId, memberId: anna } = created.value;
  if (anna === null) return { ok: false, error: { code: 'NoChanges' } };
  const member = async (name: string) => {
    const added = await engine.execute({ type: 'AddMember', groupId, name });
    return added.ok ? added.value.memberId : null;
  };
  const luca = await member('Luca');
  const sara = await member('Sara');
  if (luca === null || sara === null) return { ok: false, error: { code: 'NoChanges' } };

  const steps = [
    engine.execute({
      type: 'AddExpense',
      groupId,
      description: t(K.sample.dinner),
      date: daysAgo(2),
      time: '20:30',
      amounts: {
        total: eur(9600),
        paidBy: [{ memberId: anna, amount: eur(9600) }],
        split: { method: 'equal', memberIds: [anna, luca, sara] },
      },
    }),
    engine.execute({
      type: 'AddExpense',
      groupId,
      description: t(K.sample.fuel),
      date: daysAgo(2),
      amounts: {
        total: eur(6000),
        paidBy: [{ memberId: luca, amount: eur(6000) }],
        split: { method: 'equal', memberIds: [anna, luca] },
      },
    }),
    engine.execute({
      type: 'AddExpense',
      groupId,
      description: t(K.sample.groceries),
      date: daysAgo(1),
      amounts: {
        total: eur(4530),
        paidBy: [{ memberId: sara, amount: eur(4530) }],
        split: {
          method: 'shares',
          weights: [
            { memberId: anna, weight: 1 },
            { memberId: luca, weight: 2 },
            { memberId: sara, weight: 1 },
          ],
        },
      },
    }),
    engine.execute({
      type: 'AddExpense',
      groupId,
      description: t(K.sample.boat),
      date: daysAgo(1),
      amounts: {
        total: eur(3600),
        paidBy: [{ memberId: anna, amount: eur(3600) }],
        split: {
          method: 'exact',
          amounts: [
            { memberId: luca, amount: eur(1800) },
            { memberId: sara, amount: eur(1800) },
          ],
        },
      },
    }),
    engine.execute({
      type: 'AddSettlement',
      groupId,
      transfer: { from: luca, to: anna, amount: eur(2000) },
      date: daysAgo(0),
      notes: t(K.sample.paidBack),
    }),
  ];
  // L'engine esegue i comandi uno alla volta, nell'ordine in cui arrivano.
  for (const result of await Promise.all(steps)) {
    if (!result.ok) return result;
  }
  return { ok: true, value: groupId };
}
