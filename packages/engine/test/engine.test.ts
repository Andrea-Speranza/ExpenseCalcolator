import { describe, expect, it, vi } from 'vitest';
import {
  createManualClock,
  createMemoryStore,
  createSequentialIds,
  type LocalStore,
  openEngine,
} from '../src/index';
import { device, equalSplit, eur, unwrap, unwrapError, weekend } from './helpers';

describe('apertura', () => {
  it('alla prima apertura crea dispositivo e profilo, con le impostazioni predefinite', async () => {
    const { engine } = await device('a');
    expect(engine.deviceId).toBe('a_00001');
    expect(engine.profileId).toBe('a_00002');
    expect(unwrap(engine.query({ type: 'GetSettings' }))).toEqual({
      defaultCurrency: 'EUR',
      language: 'it',
      displayName: null,
    });
    expect(unwrap(engine.query({ type: 'ListGroups' }))).toEqual([]);
  });

  it('riaprendo lo stesso salvataggio ritrova dispositivo, gruppi e saldi', async () => {
    const store = createMemoryStore();
    const first = await device('a', store);
    const { groupId, anna, luca } = await weekend(first.engine);
    unwrap(
      await first.engine.execute({
        type: 'AddExpense',
        groupId,
        description: 'Cena',
        date: '2026-10-12',
        amounts: equalSplit(anna, 9000, [anna, luca]),
      }),
    );

    const reopened = await openEngine({
      store,
      clock: createManualClock(),
      ids: createSequentialIds('x'),
    });
    expect(reopened.deviceId).toBe(first.engine.deviceId);
    expect(reopened.query({ type: 'GetGroup', groupId })).toEqual(
      first.engine.query({ type: 'GetGroup', groupId }),
    );
    expect(reopened.query({ type: 'GetBalances', groupId })).toEqual(
      first.engine.query({ type: 'GetBalances', groupId }),
    );
  });
});

describe('gruppi e membri', () => {
  it('crea un gruppo con la creatrice come membro e la riconosce come "me"', async () => {
    const { engine } = await device('a');
    const { groupId, anna } = await weekend(engine);
    expect(unwrap(engine.query({ type: 'ListGroups' }))).toEqual([
      { groupId, name: 'Weekend', baseCurrency: 'EUR', archived: false, mode: 'local', me: anna },
    ]);
    const group = unwrap(engine.query({ type: 'GetGroup', groupId }));
    expect(group.members.map(({ name }) => name)).toEqual(['Anna', 'Luca']);
    expect(group.createdBy).toBe(anna);
  });

  it('la valuta di un nuovo gruppo viene dalle impostazioni dell’utente (ADR 0005)', async () => {
    const { engine } = await device('a');
    unwrap(await engine.execute({ type: 'UpdateSettings', changes: { defaultCurrency: 'CHF' } }));
    const { groupId } = unwrap(
      await engine.execute({ type: 'CreateGroup', name: 'Svizzera', me: null }),
    );
    expect(unwrap(engine.query({ type: 'GetGroup', groupId }))).toMatchObject({
      baseCurrency: 'CHF',
      me: null,
      members: [],
    });
  });

  it('modifica di gruppo e membri, e "chi sono io"', async () => {
    const { engine } = await device('a');
    const { groupId, luca } = await weekend(engine);
    unwrap(
      await engine.execute({
        type: 'UpdateGroup',
        groupId,
        changes: { name: 'Montagna', archived: true },
      }),
    );
    unwrap(
      await engine.execute({
        type: 'UpdateMember',
        groupId,
        memberId: luca,
        changes: { name: 'Luca B.' },
      }),
    );
    unwrap(await engine.execute({ type: 'ClaimMember', groupId, memberId: luca }));
    const group = unwrap(engine.query({ type: 'GetGroup', groupId }));
    expect(group).toMatchObject({ name: 'Montagna', archived: true, me: luca });
    expect(group.members.find(({ memberId }) => memberId === luca)?.name).toBe('Luca B.');
    unwrap(await engine.execute({ type: 'ClaimMember', groupId, memberId: null }));
    expect(unwrap(engine.query({ type: 'GetGroup', groupId })).me).toBeNull();
  });

  it('errori: gruppo o membro inesistenti, nessuna modifica', async () => {
    const { engine } = await device('a');
    const { groupId } = await weekend(engine);
    expect(
      unwrapError(await engine.execute({ type: 'AddMember', groupId: 'g_x', name: 'Zoe' })),
    ).toEqual({
      code: 'NotFound',
      entity: 'group',
      id: 'g_x',
    });
    expect(
      unwrapError(await engine.execute({ type: 'ClaimMember', groupId, memberId: 'm_x' })),
    ).toMatchObject({
      entity: 'member',
    });
    expect(
      unwrapError(
        await engine.execute({
          type: 'UpdateMember',
          groupId,
          memberId: 'm_x',
          changes: { name: 'X' },
        }),
      ),
    ).toMatchObject({
      entity: 'member',
    });
    expect(
      unwrapError(await engine.execute({ type: 'UpdateGroup', groupId, changes: {} })),
    ).toEqual({
      code: 'NoChanges',
    });
    expect(unwrapError(await engine.execute({ type: 'UpdateSettings', changes: {} }))).toEqual({
      code: 'NoChanges',
    });
  });
});

describe('spese e saldi', () => {
  it('aggiunge spese, calcola i saldi e registra autore e versione', async () => {
    const { engine } = await device('a');
    const { groupId, anna, luca } = await weekend(engine);
    const { expenseId } = unwrap(
      await engine.execute({
        type: 'AddExpense',
        groupId,
        description: '  Cena  ',
        date: '2026-10-12',
        amounts: equalSplit(anna, 9000, [anna, luca]),
        category: 'Cibo',
      }),
    );
    const expense = unwrap(engine.query({ type: 'GetGroup', groupId })).expenses[0];
    expect(expense).toMatchObject({
      expenseId,
      description: 'Cena',
      category: 'Cibo',
      notes: null,
      createdBy: anna,
    });

    const balances = unwrap(engine.query({ type: 'GetBalances', groupId }));
    expect(balances.balances[0]?.balances.map(({ amount }) => amount.minor)).toEqual([4500, -4500]);
    expect(balances.simplifiedTransfers).toEqual([{ from: luca, to: anna, amount: eur(4500) }]);
    expect(balances.excluded).toEqual([]);
  });

  it('rifiuta spese con membri sconosciuti o importi che non tornano', async () => {
    const { engine } = await device('a');
    const { groupId, anna, luca } = await weekend(engine);
    const base = { type: 'AddExpense' as const, groupId, description: 'Cena', date: '2026-10-12' };
    expect(
      unwrapError(
        await engine.execute({ ...base, amounts: equalSplit(anna, 9000, [anna, 'm_x']) }),
      ),
    ).toEqual({
      code: 'NotFound',
      entity: 'member',
      id: 'm_x',
    });
    const wrongTotal = { ...equalSplit(anna, 9000, [anna, luca]), total: eur(8000) };
    expect(unwrapError(await engine.execute({ ...base, amounts: wrongTotal }))).toMatchObject({
      code: 'TotalMismatch',
      field: 'paidBy',
    });
    expect(unwrap(engine.query({ type: 'GetGroup', groupId })).expenses).toEqual([]);
  });

  it('modifica, elimina e ripristina; le spese eliminate non contano nei saldi', async () => {
    const { engine } = await device('a');
    const { groupId, anna, luca } = await weekend(engine);
    const { expenseId } = unwrap(
      await engine.execute({
        type: 'AddExpense',
        groupId,
        description: 'Cena',
        date: '2026-10-12',
        amounts: equalSplit(anna, 9000, [anna, luca]),
      }),
    );
    unwrap(
      await engine.execute({
        type: 'UpdateExpense',
        groupId,
        expenseId,
        changes: { amounts: equalSplit(luca, 6000, [anna, luca]), notes: 'Corretta' },
      }),
    );
    expect(unwrap(engine.query({ type: 'GetBalances', groupId })).simplifiedTransfers).toEqual([
      { from: anna, to: luca, amount: eur(3000) },
    ]);

    unwrap(await engine.execute({ type: 'DeleteExpense', groupId, expenseId }));
    expect(unwrap(engine.query({ type: 'GetBalances', groupId })).balances).toEqual([]);
    unwrap(await engine.execute({ type: 'RestoreExpense', groupId, expenseId }));
    expect(unwrap(engine.query({ type: 'GetBalances', groupId })).balances).toHaveLength(1);

    expect(
      unwrapError(await engine.execute({ type: 'UpdateExpense', groupId, expenseId, changes: {} })),
    ).toEqual({ code: 'NoChanges' });
    expect(
      unwrapError(await engine.execute({ type: 'DeleteExpense', groupId, expenseId: 'e_x' })),
    ).toMatchObject({ entity: 'expense' });
    expect(
      unwrapError(
        await engine.execute({
          type: 'UpdateExpense',
          groupId,
          expenseId: 'e_x',
          changes: { notes: 'x' },
        }),
      ),
    ).toMatchObject({ entity: 'expense' });
    expect(
      unwrapError(
        await engine.execute({
          type: 'UpdateExpense',
          groupId,
          expenseId,
          changes: { amounts: equalSplit(anna, 1, ['m_x']) },
        }),
      ),
    ).toMatchObject({ entity: 'member' });
  });

  it('rimborsi: aggiunta, modifica, eliminazione e ripristino, con le stesse verifiche', async () => {
    const { engine } = await device('a');
    const { groupId, anna, luca } = await weekend(engine);
    unwrap(
      await engine.execute({
        type: 'AddExpense',
        groupId,
        description: 'Cena',
        date: '2026-10-12',
        amounts: equalSplit(anna, 9000, [anna, luca]),
      }),
    );
    const { settlementId } = unwrap(
      await engine.execute({
        type: 'AddSettlement',
        groupId,
        transfer: { from: luca, to: anna, amount: eur(4500) },
        date: '2026-10-13',
      }),
    );
    expect(unwrap(engine.query({ type: 'GetBalances', groupId })).simplifiedTransfers).toEqual([]);

    unwrap(
      await engine.execute({
        type: 'UpdateSettlement',
        groupId,
        settlementId,
        changes: { transfer: { from: luca, to: anna, amount: eur(2000) } },
      }),
    );
    expect(unwrap(engine.query({ type: 'GetBalances', groupId })).simplifiedTransfers).toEqual([
      { from: luca, to: anna, amount: eur(2500) },
    ]);
    unwrap(await engine.execute({ type: 'DeleteSettlement', groupId, settlementId }));
    unwrap(await engine.execute({ type: 'RestoreSettlement', groupId, settlementId }));
    expect(unwrap(engine.query({ type: 'GetGroup', groupId })).settlements[0]?.deleted).toBe(false);

    const same = { from: anna, to: anna, amount: eur(1) };
    expect(
      unwrapError(
        await engine.execute({
          type: 'AddSettlement',
          groupId,
          transfer: same,
          date: '2026-10-13',
        }),
      ),
    ).toEqual({ code: 'InvalidSettlement', reason: 'sameMember' });
    expect(
      unwrapError(
        await engine.execute({
          type: 'UpdateSettlement',
          groupId,
          settlementId,
          changes: { transfer: { ...same, to: 'm_x' } },
        }),
      ),
    ).toMatchObject({ entity: 'member' });
    expect(
      unwrapError(
        await engine.execute({ type: 'UpdateSettlement', groupId, settlementId, changes: {} }),
      ),
    ).toEqual({ code: 'NoChanges' });
    expect(
      unwrapError(
        await engine.execute({
          type: 'UpdateSettlement',
          groupId,
          settlementId: 's_x',
          changes: { notes: 'x' },
        }),
      ),
    ).toMatchObject({ entity: 'settlement' });
    expect(
      unwrapError(await engine.execute({ type: 'DeleteSettlement', groupId, settlementId: 's_x' })),
    ).toMatchObject({ entity: 'settlement' });
  });
});

describe('query, notifiche e robustezza', () => {
  it('rifiuta comandi e query malformati, indicando il campo', async () => {
    const { engine } = await device('a');
    const command = { type: 'CreateGroup', name: '', me: null } as const;
    expect(unwrapError(await engine.execute(command))).toMatchObject({
      code: 'InvalidInput',
      issues: [{ path: 'name' }],
    });
    expect(unwrapError(engine.query({ type: 'GetGroup', groupId: '' }))).toMatchObject({
      code: 'InvalidInput',
    });
    expect(unwrapError(engine.query({ type: 'GetGroup', groupId: 'g_x' }))).toMatchObject({
      code: 'NotFound',
    });
    expect(unwrapError(engine.query({ type: 'GetBalances', groupId: 'g_x' }))).toMatchObject({
      code: 'NotFound',
    });
  });

  it('avvisa chi ascolta dopo ogni cambiamento, finché non si disiscrive', async () => {
    const { engine } = await device('a');
    const listener = vi.fn();
    const unsubscribe = engine.subscribe(listener);
    await weekend(engine);
    expect(listener).toHaveBeenCalledTimes(2);
    unsubscribe();
    unwrap(await engine.execute({ type: 'UpdateSettings', changes: { language: 'en' } }));
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('se il salvataggio fallisce, lo stato non cambia', async () => {
    const memory = createMemoryStore();
    const failing: LocalStore = {
      ...memory,
      save: (events, device) =>
        events.length > 0 ? Promise.reject(new Error('disco pieno')) : memory.save(events, device),
    };
    const engine = await openEngine({
      store: failing,
      clock: createManualClock(),
      ids: createSequentialIds('a'),
    });
    expect(
      unwrapError(await engine.execute({ type: 'CreateGroup', name: 'Weekend', me: null })),
    ).toEqual({
      code: 'StorageFailed',
      message: 'disco pieno',
    });
    expect(unwrap(engine.query({ type: 'ListGroups' }))).toEqual([]);
  });

  it('esegue i comandi uno alla volta, anche se lanciati insieme', async () => {
    const { engine } = await device('a');
    const { groupId } = await weekend(engine);
    const results = await Promise.all(
      ['Sara', 'Marco', 'Giulia'].map((name) =>
        engine.execute({ type: 'AddMember', groupId, name }),
      ),
    );
    expect(results.every(({ ok }) => ok)).toBe(true);
    const hlcs = engine.exportEvents(groupId).map(({ hlc }) => hlc);
    expect(new Set(hlcs).size).toBe(hlcs.length);
  });

  it('gli eventi scritti hanno autore e, per le modifiche, la versione di partenza', async () => {
    const { engine } = await device('a');
    const { groupId, anna } = await weekend(engine);
    unwrap(await engine.execute({ type: 'UpdateGroup', groupId, changes: { name: 'Montagna' } }));
    const update = engine.exportEvents(groupId).find(({ type }) => type === 'GroupUpdated');
    const created = engine.exportEvents(groupId).find(({ type }) => type === 'GroupCreated');
    expect(update).toMatchObject({
      actor: anna,
      base: expect.any(String) as unknown,
      deviceId: engine.deviceId,
    });
    expect(created?.hlc && update?.hlc && created.hlc < update.hlc).toBe(true);
    expect(engine.exportEvents()).toHaveLength(
      engine.exportEvents(groupId).length + engine.exportEvents(engine.profileId).length,
    );
  });
});
