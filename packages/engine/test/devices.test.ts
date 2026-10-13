import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Engine, GroupView } from '../src/index';
import { type Device, device, equalSplit, eur, unwrap, weekend } from './helpers';

// Più dispositivi che modificano lo stesso gruppo e si scambiano gli eventi, come faranno i canali di
// condivisione (ADR 0006). Alla fine devono vedere tutti lo stesso gruppo e gli stessi saldi (ADR 0007).

/** Invia a `to` tutti gli eventi del gruppo che `from` conosce. */
async function sync(from: Engine, to: Engine, groupId: string): Promise<number> {
  return unwrap(await to.receiveEvents(from.exportEvents(groupId))).added;
}

/** La parte del gruppo uguale per tutti: "me" e la modalità dipendono dal profilo di ciascuno. */
function shared(view: GroupView): GroupView {
  return { ...view, me: null, mode: 'local' };
}

function groupOf(engine: Engine, groupId: string) {
  return shared(unwrap(engine.query({ type: 'GetGroup', groupId })));
}

async function twoDevices() {
  const a = await device('a');
  const b = await device('b');
  const ids = await weekend(a.engine);
  const { expenseId } = unwrap(
    await a.engine.execute({
      type: 'AddExpense',
      groupId: ids.groupId,
      description: 'Cena',
      date: '2026-10-12',
      amounts: equalSplit(ids.anna, 9000, [ids.anna, ids.luca]),
    }),
  );
  await sync(a.engine, b.engine, ids.groupId);
  unwrap(await b.engine.execute({ type: 'ClaimMember', groupId: ids.groupId, memberId: ids.luca }));
  return { a, b, ...ids, expenseId };
}

describe('due dispositivi', () => {
  it('chi riceve gli eventi vede lo stesso gruppo e gli stessi saldi', async () => {
    const { a, b, groupId } = await twoDevices();
    expect(groupOf(b.engine, groupId)).toEqual(groupOf(a.engine, groupId));
    expect(b.engine.query({ type: 'GetBalances', groupId })).toEqual(
      a.engine.query({ type: 'GetBalances', groupId }),
    );
    expect(unwrap(b.engine.query({ type: 'ListGroups' }))).toHaveLength(1);
  });

  it('ricevere due volte gli stessi eventi non cambia nulla', async () => {
    const { a, b, groupId } = await twoDevices();
    expect(await sync(a.engine, b.engine, groupId)).toBe(0);
  });

  it('modifiche contemporanee a campi diversi: dopo lo scambio entrambe valgono ovunque', async () => {
    const { a, b, groupId, expenseId, anna, luca } = await twoDevices();
    unwrap(
      await a.engine.execute({
        type: 'UpdateExpense',
        groupId,
        expenseId,
        changes: { description: 'Cena al rifugio' },
      }),
    );
    unwrap(
      await b.engine.execute({
        type: 'UpdateExpense',
        groupId,
        expenseId,
        changes: { amounts: equalSplit(anna, 9500, [anna, luca]) },
      }),
    );
    await sync(a.engine, b.engine, groupId);
    await sync(b.engine, a.engine, groupId);

    const expense = groupOf(a.engine, groupId).expenses[0];
    expect(expense).toMatchObject({
      description: 'Cena al rifugio',
      amounts: { total: eur(9500) },
      conflicts: [],
    });
    expect(groupOf(b.engine, groupId)).toEqual(groupOf(a.engine, groupId));
  });

  it('stesso campo: vince la stessa modifica su entrambi, e il conflitto è visibile a entrambi', async () => {
    const { a, b, groupId, expenseId, anna, luca } = await twoDevices();
    unwrap(
      await a.engine.execute({
        type: 'UpdateExpense',
        groupId,
        expenseId,
        changes: { description: 'Cena (Anna)' },
      }),
    );
    b.clock.advance(1000); // Luca modifica un secondo dopo, senza aver visto la modifica di Anna
    unwrap(
      await b.engine.execute({
        type: 'UpdateExpense',
        groupId,
        expenseId,
        changes: { description: 'Cena (Luca)' },
      }),
    );
    await sync(a.engine, b.engine, groupId);
    await sync(b.engine, a.engine, groupId);

    const expense = groupOf(a.engine, groupId).expenses[0];
    expect(expense?.description).toBe('Cena (Luca)');
    expect(expense?.conflicts).toEqual([
      expect.objectContaining({
        field: 'description',
        overwritten: 'Cena (Anna)',
        overwrittenBy: anna,
        by: luca,
      }) as unknown,
    ]);
    expect(groupOf(b.engine, groupId)).toEqual(groupOf(a.engine, groupId));
  });

  it('dopo aver visto eventi "dal futuro", le proprie modifiche vengono comunque dopo', async () => {
    const { a, b, groupId, expenseId } = await twoDevices();
    a.clock.advance(24 * 60 * 60 * 1000); // l'orologio di A è avanti di un giorno
    unwrap(
      await a.engine.execute({
        type: 'UpdateExpense',
        groupId,
        expenseId,
        changes: { notes: 'da A' },
      }),
    );
    await sync(a.engine, b.engine, groupId);
    unwrap(
      await b.engine.execute({
        type: 'UpdateExpense',
        groupId,
        expenseId,
        changes: { notes: 'da B, dopo' },
      }),
    );
    await sync(b.engine, a.engine, groupId);
    expect(groupOf(a.engine, groupId).expenses[0]?.notes).toBe('da B, dopo');
    expect(groupOf(a.engine, groupId).expenses[0]?.conflicts).toEqual([]);
  });

  it('conserva eventi di tipi sconosciuti (app più recenti) e scarta quelli malformati', async () => {
    const { a, b, groupId } = await twoDevices();
    const future = {
      ...a.engine.exportEvents(groupId)[0],
      id: 'ev_futuro',
      type: 'ExpenseSplitted',
      v: 2,
      payload: { x: 1 },
    };
    const before = groupOf(b.engine, groupId);
    expect(unwrap(await b.engine.receiveEvents([future, { rotto: true }]))).toEqual({
      added: 1,
      invalid: 1,
    });
    expect(b.engine.exportEvents(groupId).some(({ id }) => id === 'ev_futuro')).toBe(true);
    expect(groupOf(b.engine, groupId)).toEqual(before);
  });
});

describe('tre dispositivi, operazioni e sincronizzazioni casuali', () => {
  const step = fc.oneof(
    fc.record({
      kind: fc.constant('edit' as const),
      device: fc.nat({ max: 2 }),
      delay: fc.nat({ max: 5000 }),
      op: fc.constantFrom(
        'description',
        'amounts',
        'delete',
        'restore',
        'addExpense',
        'settle',
        'rename',
      ),
      value: fc.nat({ max: 3 }),
    }),
    fc.record({
      kind: fc.constant('sync' as const),
      from: fc.nat({ max: 2 }),
      to: fc.nat({ max: 2 }),
    }),
  );

  it('dopo uno scambio completo tutti vedono lo stesso gruppo e gli stessi saldi', async () => {
    await fc.assert(
      fc.asyncProperty(fc.array(step, { maxLength: 20 }), async (steps) => {
        const devices: Device[] = [await device('a'), await device('b'), await device('c')];
        const [first] = devices;
        if (first === undefined) throw new Error('nessun dispositivo');
        const { groupId, anna, luca } = await weekend(first.engine);
        const { memberId: sara } = unwrap(
          await first.engine.execute({ type: 'AddMember', groupId, name: 'Sara' }),
        );
        const members = [anna, luca, sara];
        const { expenseId } = unwrap(
          await first.engine.execute({
            type: 'AddExpense',
            groupId,
            description: 'Cena',
            date: '2026-10-12',
            amounts: equalSplit(anna, 9000, members),
          }),
        );
        for (const other of devices) await sync(first.engine, other.engine, groupId);

        for (const s of steps) {
          if (s.kind === 'sync') {
            const from = devices[s.from];
            const to = devices[s.to];
            if (from !== undefined && to !== undefined) await sync(from.engine, to.engine, groupId);
            continue;
          }
          const current = devices[s.device];
          if (current === undefined) continue;
          current.clock.advance(s.delay);
          const payer = members[s.value % members.length] ?? anna;
          const { engine } = current;
          switch (s.op) {
            case 'description':
              await engine.execute({
                type: 'UpdateExpense',
                groupId,
                expenseId,
                changes: { description: `Cena ${String(s.value)}` },
              });
              break;
            case 'amounts':
              await engine.execute({
                type: 'UpdateExpense',
                groupId,
                expenseId,
                changes: { amounts: equalSplit(payer, 1000 * (s.value + 1), members) },
              });
              break;
            case 'delete':
              await engine.execute({ type: 'DeleteExpense', groupId, expenseId });
              break;
            case 'restore':
              await engine.execute({ type: 'RestoreExpense', groupId, expenseId });
              break;
            case 'addExpense':
              await engine.execute({
                type: 'AddExpense',
                groupId,
                description: 'Extra',
                date: '2026-10-13',
                amounts: equalSplit(payer, 777, members),
              });
              break;
            case 'settle':
              await engine.execute({
                type: 'AddSettlement',
                groupId,
                transfer: { from: payer === anna ? luca : anna, to: payer, amount: eur(100) },
                date: '2026-10-14',
              });
              break;
            case 'rename':
              await engine.execute({
                type: 'UpdateGroup',
                groupId,
                changes: { name: `Gruppo ${String(s.value)}` },
              });
              break;
          }
        }

        // Scambio completo: ognuno manda tutto a tutti.
        for (const from of devices)
          for (const to of devices) await sync(from.engine, to.engine, groupId);

        const reference = groupOf(first.engine, groupId);
        const balances = first.engine.query({ type: 'GetBalances', groupId });
        for (const { engine } of devices) {
          expect(groupOf(engine, groupId)).toEqual(reference);
          expect(engine.query({ type: 'GetBalances', groupId })).toEqual(balances);
        }
      }),
      { numRuns: 60 },
    );
  });
});
