import type { GroupEvent } from '@expense/schema';
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { type GroupState, type Policy, projectGroup } from '../src/index';
import { amounts, baseGroup, groupEvent, hlc } from './helpers';

/** Stato del gruppo; fa fallire il test se il gruppo non esiste. */
function stateOf(events: readonly GroupEvent[], policy?: Policy): GroupState {
  const { group } = projectGroup('g_1', events, policy);
  if (group === null) throw new Error('gruppo non creato');
  return group;
}

const expenseOf = (group: GroupState) => {
  const expense = group.expenses.get('e_1');
  if (expense === undefined) throw new Error('spesa mancante');
  return expense;
};

describe('projectGroup: creazione', () => {
  it('ricostruisce gruppo, membri e spesa, con autore e versione', () => {
    const group = stateOf(baseGroup());
    expect(group.name.value).toBe('Weekend');
    expect(group.createdBy).toBe('m_anna');
    expect([...group.members.values()].map(({ name }) => name.value)).toEqual(['Anna', 'Luca']);
    const expense = expenseOf(group);
    expect(expense).toMatchObject({
      createdBy: 'm_anna',
      createdAt: hlc(4),
      version: hlc(4),
      deleted: { value: false },
      category: { value: null },
      conflicts: [],
    });
    expect(group.version).toBe(hlc(4));
  });
});

describe('projectGroup: modifiche contemporanee (ADR 0007)', () => {
  const v1 = hlc(4); // versione della spesa vista da entrambi

  it('campi diversi: si tengono entrambe le modifiche, senza conflitti', () => {
    const expense = expenseOf(
      stateOf([
        ...baseGroup(),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { description: 'Cena al rifugio' } },
          { at: 10, device: 'd_a', base: v1 },
        ),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { amounts: amounts(9500) } },
          { at: 11, device: 'd_b', actor: 'm_luca', base: v1 },
        ),
      ]),
    );
    expect(expense.description.value).toBe('Cena al rifugio');
    expect(expense.amounts.value.total.minor).toBe(9500);
    expect(expense.conflicts).toEqual([]);
  });

  it('stesso campo: vince la più recente e il valore scartato resta nel conflitto', () => {
    const expense = expenseOf(
      stateOf([
        ...baseGroup(),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { description: 'Cena (Anna)' } },
          { at: 10, device: 'd_a', base: v1 },
        ),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { description: 'Cena (Luca)' } },
          { at: 11, device: 'd_b', actor: 'm_luca', base: v1 },
        ),
      ]),
    );
    expect(expense.description).toEqual({
      value: 'Cena (Luca)',
      hlc: hlc(11, 'd_b'),
      actor: 'm_luca',
    });
    expect(expense.conflicts).toEqual([
      {
        field: 'description',
        overwritten: 'Cena (Anna)',
        overwrittenBy: 'm_anna',
        overwrittenAt: hlc(10, 'd_a'),
        by: 'm_luca',
        at: hlc(11, 'd_b'),
      },
    ]);
  });

  it('modifiche in sequenza (chi modifica aveva visto la precedente): nessun conflitto', () => {
    const expense = expenseOf(
      stateOf([
        ...baseGroup(),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { description: 'Cena (Anna)' } },
          { at: 10, base: v1 },
        ),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { description: 'Cena (Luca)' } },
          { at: 11, device: 'd_b', actor: 'm_luca', base: hlc(10) },
        ),
      ]),
    );
    expect(expense.description.value).toBe('Cena (Luca)');
    expect(expense.conflicts).toEqual([]);
  });

  it('una modifica senza versione di partenza non segnala conflitti', () => {
    const expense = expenseOf(
      stateOf([
        ...baseGroup(),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { notes: 'Pagato con carta' } },
          { at: 10 },
        ),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { notes: null, category: 'Cibo' } },
          { at: 11 },
        ),
      ]),
    );
    expect(expense.notes.value).toBeNull();
    expect(expense.category.value).toBe('Cibo');
    expect(expense.conflicts).toEqual([]);
  });

  it('l’eliminazione vince su una modifica successiva, che resta comunque applicata ai campi', () => {
    const expense = expenseOf(
      stateOf([
        ...baseGroup(),
        groupEvent('ExpenseDeleted', { expenseId: 'e_1' }, { at: 10 }),
        groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { description: 'Cena corretta' } },
          { at: 11, device: 'd_b', actor: 'm_luca', base: v1 },
        ),
      ]),
    );
    expect(expense.deleted.value).toBe(true);
    expect(expense.description.value).toBe('Cena corretta');
  });

  it('una spesa eliminata si ripristina solo in modo esplicito', () => {
    const expense = expenseOf(
      stateOf([
        ...baseGroup(),
        groupEvent('ExpenseDeleted', { expenseId: 'e_1' }, { at: 10 }),
        groupEvent('ExpenseRestored', { expenseId: 'e_1' }, { at: 11 }),
      ]),
    );
    expect(expense.deleted.value).toBe(false);
    expect(expense.version).toBe(hlc(11));
  });
});

describe('projectGroup: gruppo, membri e rimborsi', () => {
  it('modifica di gruppo e membri, con conflitti per campo', () => {
    const group = stateOf([
      ...baseGroup(),
      groupEvent(
        'GroupUpdated',
        { changes: { name: 'Weekend in montagna' } },
        { at: 10, base: hlc(1) },
      ),
      groupEvent(
        'GroupUpdated',
        { changes: { name: 'Montagna', baseCurrency: 'CHF', archived: true } },
        { at: 11, device: 'd_b', actor: 'm_luca', base: hlc(1) },
      ),
      groupEvent(
        'MemberUpdated',
        { memberId: 'm_luca', changes: { name: 'Luca B.', archived: true } },
        { at: 12 },
      ),
    ]);
    expect(group.name.value).toBe('Montagna');
    expect(group.baseCurrency.value).toBe('CHF');
    expect(group.archived.value).toBe(true);
    expect(group.conflicts.map(({ field }) => field)).toEqual(['name']);
    expect(group.members.get('m_luca')).toMatchObject({
      name: { value: 'Luca B.' },
      archived: { value: true },
      version: hlc(12),
    });
  });

  it('rimborsi: aggiunta, modifica, eliminazione e ripristino', () => {
    const transfer = { from: 'm_luca', to: 'm_anna', amount: { minor: 4500, currency: 'EUR' } };
    const events = [
      ...baseGroup(),
      groupEvent(
        'SettlementAdded',
        { settlementId: 's_1', transfer, date: '2026-10-13', notes: 'Bonifico' },
        { at: 10 },
      ),
      groupEvent(
        'SettlementUpdated',
        {
          settlementId: 's_1',
          changes: {
            transfer: { ...transfer, amount: { minor: 4000, currency: 'EUR' } },
            date: '2026-10-14',
            notes: null,
          },
        },
        { at: 11 },
      ),
      groupEvent('SettlementDeleted', { settlementId: 's_1' }, { at: 12 }),
    ];
    const deleted = stateOf(events).settlements.get('s_1');
    expect(deleted).toMatchObject({
      transfer: { value: { amount: { minor: 4000 } } },
      date: { value: '2026-10-14' },
      notes: { value: null },
      deleted: { value: true },
    });
    const restored = stateOf([
      ...events,
      groupEvent('SettlementRestored', { settlementId: 's_1' }, { at: 13 }),
    ]);
    expect(restored.settlements.get('s_1')?.deleted.value).toBe(false);
  });
});

describe('projectGroup: eventi non applicabili', () => {
  it.each<[string, GroupEvent, string]>([
    [
      'modifica di una spesa inesistente',
      groupEvent('ExpenseUpdated', { expenseId: 'e_x', changes: { description: 'x' } }, { at: 10 }),
      'unknownEntity',
    ],
    [
      'eliminazione di un rimborso inesistente',
      groupEvent('SettlementDeleted', { settlementId: 's_x' }, { at: 10 }),
      'unknownEntity',
    ],
    [
      'modifica di un membro inesistente',
      groupEvent('MemberUpdated', { memberId: 'm_x', changes: { name: 'x' } }, { at: 10 }),
      'unknownEntity',
    ],
    [
      'membro aggiunto due volte',
      groupEvent('MemberAdded', { memberId: 'm_luca', name: 'Luca' }, { at: 10 }),
      'duplicateEntity',
    ],
    [
      'spesa aggiunta due volte',
      groupEvent(
        'ExpenseAdded',
        { expenseId: 'e_1', description: 'x', date: '2026-10-12', amounts: amounts(1) },
        { at: 10 },
      ),
      'duplicateEntity',
    ],
    [
      'gruppo creato due volte',
      groupEvent('GroupCreated', { name: 'Altro', baseCurrency: 'EUR' }, { at: 10 }),
      'groupAlreadyCreated',
    ],
    [
      'evento di un altro gruppo',
      groupEvent('MemberAdded', { memberId: 'm_z', name: 'Zoe' }, { at: 10, stream: 'g_2' }),
      'wrongStream',
    ],
  ])('%s', (_case, event, reason) => {
    const { group, rejected } = projectGroup('g_1', [...baseGroup(), event]);
    expect(rejected).toEqual([{ event, reason }]);
    expect(group?.version).toBe(hlc(4));
  });

  it('un rimborso aggiunto due volte viene scartato', () => {
    const transfer = { from: 'm_luca', to: 'm_anna', amount: { minor: 1, currency: 'EUR' } };
    const add = (at: number) =>
      groupEvent('SettlementAdded', { settlementId: 's_1', transfer, date: '2026-10-13' }, { at });
    expect(
      projectGroup('g_1', [...baseGroup(), add(10), add(11)]).rejected.map(({ reason }) => reason),
    ).toEqual(['duplicateEntity']);
  });

  it('eventi senza un gruppo creato', () => {
    const member = groupEvent('MemberAdded', { memberId: 'm_anna', name: 'Anna' }, { at: 1 });
    expect(projectGroup('g_1', [member])).toEqual({
      group: null,
      rejected: [{ event: member, reason: 'groupNotCreated' }],
    });
  });
});

describe('projectGroup: permessi (predisposizione per D13)', () => {
  // Esempio di politica futura: ognuno modifica solo le spese che ha creato; il creatore del gruppo tutto.
  const ownExpensesOnly: Policy = (group, event) => {
    if (group === null || event.type !== 'ExpenseUpdated') return true;
    const expense = group.expenses.get(event.payload.expenseId);
    return event.actor === group.createdBy || event.actor === expense?.createdBy;
  };

  it('un evento non permesso viene ignorato e segnalato, su ogni dispositivo allo stesso modo', () => {
    const byLuca = groupEvent(
      'ExpenseUpdated',
      { expenseId: 'e_1', changes: { description: 'Cena di Luca' } },
      { at: 10, device: 'd_b', actor: 'm_luca' },
    );
    const { group, rejected } = projectGroup('g_1', [...baseGroup(), byLuca], ownExpensesOnly);
    expect(group && expenseOf(group).description.value).toBe('Cena');
    expect(rejected).toEqual([{ event: byLuca, reason: 'unauthorized' }]);
  });

  it('il creatore del gruppo può correggere tutto', () => {
    const byAnna = groupEvent(
      'ExpenseUpdated',
      { expenseId: 'e_1', changes: { description: 'Cena corretta' } },
      { at: 10 },
    );
    expect(expenseOf(stateOf([...baseGroup(), byAnna], ownExpensesOnly)).description.value).toBe(
      'Cena corretta',
    );
  });
});

describe('projectGroup: convergenza', () => {
  const update = fc.record({
    at: fc.integer({ min: 5, max: 40 }),
    device: fc.constantFrom('d_a', 'd_b', 'd_c'),
    actor: fc.constantFrom('m_anna', 'm_luca'),
    kind: fc.constantFrom('description', 'notes', 'amounts', 'delete', 'restore', 'name'),
    base: fc.integer({ min: 4, max: 40 }),
    text: fc.constantFrom('A', 'B', 'C'),
  });

  type Update = typeof update extends fc.Arbitrary<infer T> ? T : never;

  function toEvent({ at, device, actor, kind, base, text }: Update): GroupEvent {
    const options = { at, device, actor, base: hlc(base, 'd_a') };
    switch (kind) {
      case 'description':
        return groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { description: text } },
          options,
        );
      case 'notes':
        return groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { notes: text } },
          options,
        );
      case 'amounts':
        return groupEvent(
          'ExpenseUpdated',
          { expenseId: 'e_1', changes: { amounts: amounts(at * 100) } },
          options,
        );
      case 'delete':
        return groupEvent('ExpenseDeleted', { expenseId: 'e_1' }, options);
      case 'restore':
        return groupEvent('ExpenseRestored', { expenseId: 'e_1' }, options);
      case 'name':
        return groupEvent('GroupUpdated', { changes: { name: text } }, options);
    }
  }

  it('stesso stato qualunque sia l’ordine di arrivo degli eventi, anche con doppioni', () => {
    fc.assert(
      fc.property(
        fc.array(update, { maxLength: 25 }).chain((updates) => {
          const events = [...baseGroup(), ...updates.map(toEvent)];
          return fc.tuple(
            fc.constant(events),
            fc.shuffledSubarray(events, { minLength: events.length, maxLength: events.length }),
            fc.subarray(events),
          );
        }),
        ([events, shuffled, duplicates]) => {
          expect(projectGroup('g_1', [...shuffled, ...duplicates])).toEqual(
            projectGroup('g_1', events),
          );
        },
      ),
    );
  });
});
