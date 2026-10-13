import { createManualClock, type Engine, openEngine } from '@expense/engine';
import { createUlidGenerator } from '@expense/system';
import { IDBFactory } from 'fake-indexeddb';
import { describe, expect, it } from 'vitest';
import { type IndexedDbStore, openIndexedDbStore } from '../src/index';

// Criterio di completamento della Fase 2 (PLANNING §11.4): creare un gruppo, i membri e le spese,
// chiudere l'app, riaprire i dati da IndexedDB e ottenere gli stessi saldi.

async function openApp(indexedDB: IDBFactory): Promise<{ engine: Engine; store: IndexedDbStore }> {
  const clock = createManualClock();
  const store = await openIndexedDbStore({ indexedDB, name: 'expense-calcolator' });
  const engine = await openEngine({ store, clock, ids: createUlidGenerator(clock) });
  return { engine, store };
}

function unwrap<T>(result: { ok: true; value: T } | { ok: false; error: unknown }): T {
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

describe('dalla creazione alla riapertura, su IndexedDB', () => {
  it('chiudendo e riaprendo l’app si ritrovano gruppo, spese e saldi, e si può continuare', async () => {
    const indexedDB = new IDBFactory();
    const first = await openApp(indexedDB);
    const { engine } = first;

    const { groupId, memberId: anna } = unwrap(
      await engine.execute({ type: 'CreateGroup', name: 'Weekend', me: { name: 'Anna' } }),
    );
    if (anna === null) throw new Error('manca Anna');
    const { memberId: luca } = unwrap(
      await engine.execute({ type: 'AddMember', groupId, name: 'Luca' }),
    );
    const { memberId: sara } = unwrap(
      await engine.execute({ type: 'AddMember', groupId, name: 'Sara' }),
    );
    const eur = (minor: number) => ({ minor, currency: 'EUR' });
    unwrap(
      await engine.execute({
        type: 'AddExpense',
        groupId,
        description: 'Cena',
        date: '2026-10-12',
        amounts: {
          total: eur(9000),
          paidBy: [{ memberId: anna, amount: eur(9000) }],
          split: { method: 'equal', memberIds: [anna, luca, sara] },
        },
      }),
    );
    unwrap(
      await engine.execute({
        type: 'AddSettlement',
        groupId,
        transfer: { from: luca, to: anna, amount: eur(3000) },
        date: '2026-10-13',
      }),
    );
    const before = {
      group: engine.query({ type: 'GetGroup', groupId }),
      balances: engine.query({ type: 'GetBalances', groupId }),
    };
    first.store.close();

    const second = await openApp(indexedDB);
    expect(second.engine.deviceId).toBe(engine.deviceId);
    expect(second.engine.query({ type: 'GetGroup', groupId })).toEqual(before.group);
    expect(second.engine.query({ type: 'GetBalances', groupId })).toEqual(before.balances);
    expect(
      unwrap(second.engine.query({ type: 'GetBalances', groupId })).simplifiedTransfers,
    ).toEqual([{ from: sara, to: anna, amount: eur(3000) }]);

    // L'orologio è stato salvato: i nuovi eventi vengono dopo i precedenti anche dopo il riavvio.
    unwrap(
      await second.engine.execute({ type: 'UpdateGroup', groupId, changes: { name: 'Montagna' } }),
    );
    const hlcs = second.engine.exportEvents(groupId).map(({ hlc }) => hlc);
    expect(hlcs.at(-1)).toBe([...hlcs].sort().at(-1));
    second.store.close();
  });
});
