import type { ExpenseView } from '@expense/engine';
import { describe, expect, it } from 'vitest';
import { expenseTimes, lastChange } from '../src/format';
import { accountsStatus, matchesFilter, newestFirst, participants } from '../src/group-data';
import { createUiI18n } from '../src/i18n';

const eur = (minor: number) => ({ minor, currency: 'EUR' });

function expense(paidBy: string[], split: string[]): ExpenseView {
  return {
    expenseId: 'e1',
    description: 'Cena',
    date: '2026-10-13',
    time: null,
    amounts: {
      total: eur(9000),
      paidBy: paidBy.map((memberId) => ({ memberId, amount: eur(9000 / paidBy.length) })),
      split: { method: 'equal', memberIds: split },
    },
    category: null,
    notes: null,
    deleted: false,
    createdBy: null,
    createdAt: '1760000000000:00000:d',
    version: '1760000000000:00000:d',
    conflicts: [],
  };
}

describe('participants', () => {
  it('elenca chi divide la spesa, con la sua parte se non è uguale per tutti', () => {
    expect(participants({ method: 'equal', memberIds: ['a', 'b'] })).toEqual([
      { memberId: 'a', share: null },
      { memberId: 'b', share: null },
    ]);
    expect(
      participants({ method: 'exact', amounts: [{ memberId: 'a', amount: eur(2050) }] }),
    ).toEqual([{ memberId: 'a', share: { kind: 'amount', amount: eur(2050) } }]);
    expect(
      participants({ method: 'percentage', percentages: [{ memberId: 'a', basisPoints: 2500 }] }),
    ).toEqual([{ memberId: 'a', share: { kind: 'percentage', basisPoints: 2500 } }]);
    expect(participants({ method: 'shares', weights: [{ memberId: 'b', weight: 2 }] })).toEqual([
      { memberId: 'b', share: { kind: 'shares', weight: 2 } },
    ]);
  });
});

describe('matchesFilter', () => {
  it('pagate da me: anche insieme ad altri', () => {
    expect(matchesFilter(expense(['me'], ['me', 'b']), 'paidByMe', 'me')).toBe(true);
    expect(matchesFilter(expense(['b', 'me'], ['b']), 'paidByMe', 'me')).toBe(true);
    expect(matchesFilter(expense(['b'], ['me', 'b']), 'paidByMe', 'me')).toBe(false);
  });

  it('pagate per me: partecipo e ha pagato anche qualcun altro', () => {
    expect(matchesFilter(expense(['b'], ['me', 'b']), 'paidForMe', 'me')).toBe(true);
    expect(matchesFilter(expense(['b'], ['b', 'c']), 'paidForMe', 'me')).toBe(false);
    expect(matchesFilter(expense(['me'], ['me', 'b']), 'paidForMe', 'me')).toBe(false);
  });

  it('senza sapere chi sono, i filtri personali non mostrano nulla', () => {
    expect(matchesFilter(expense(['b'], ['b']), 'all', null)).toBe(true);
    expect(matchesFilter(expense(['b'], ['b']), 'paidByMe', null)).toBe(false);
  });
});

describe('giorno e ora', () => {
  // 1760000000000 ms = 9 ottobre 2025, 08:53:20 UTC (10:53 a Roma, ora legale).
  const inserted = { createdAt: '1760000000000:00000:d', version: '1760000000000:00000:d' };
  const modified = { createdAt: '1760000000000:00000:d', version: '1760090000000:00000:d' };

  it('mostra quando una spesa è stata inserita e modificata, nella lingua attiva', () => {
    const it_ = createUiI18n('it');
    const en = createUiI18n('en');
    expect(expenseTimes(it_, inserted, 'Europe/Rome')).toBe('Inserita il 9 ott 2025 alle 10:53');
    expect(expenseTimes(it_, modified, 'Europe/Rome')).toBe(
      'Inserita il 9 ott 2025 alle 10:53 · modificata il 10 ott 2025 alle 11:53',
    );
    expect(expenseTimes(en, inserted, 'Europe/Rome')).toBe('Added on 9 Oct 2025 at 10:53');
    expect(lastChange(it_, modified, 'Europe/Rome')).toBe(
      'Ultima modifica il 10 ott 2025 alle 11:53',
    );
  });
});

describe('accountsStatus', () => {
  const balances = (amounts: [string, number][]) => ({
    balances: [
      {
        currency: 'EUR',
        balances: amounts.map(([memberId, minor]) => ({ memberId, amount: eur(minor) })),
      },
    ],
    simplifiedTransfers: [],
    pairwiseTransfers: [],
    excluded: [],
  });

  it('distingue gruppo vuoto, in pari e con conti aperti', () => {
    expect(
      accountsStatus(
        { balances: [], simplifiedTransfers: [], pairwiseTransfers: [], excluded: [] },
        'me',
      ),
    ).toEqual({ kind: 'empty' });
    expect(
      accountsStatus(
        balances([
          ['me', 0],
          ['b', 0],
        ]),
        'me',
      ),
    ).toEqual({ kind: 'settled' });
    expect(
      accountsStatus(
        balances([
          ['me', 3000],
          ['b', -3000],
        ]),
        'me',
      ),
    ).toEqual({
      kind: 'open',
      mine: [eur(3000)],
    });
    // Io sono in pari, ma altri no: i conti restano aperti.
    expect(
      accountsStatus(
        balances([
          ['me', 0],
          ['b', 500],
          ['c', -500],
        ]),
        'me',
      ),
    ).toEqual({
      kind: 'open',
      mine: [],
    });
  });
});

describe('newestFirst', () => {
  it('ordina per data, poi per ora (le spese senza ora dopo), poi per inserimento', () => {
    const at = (expenseId: string, date: string, time: string | null, createdAt: string) => ({
      ...expense(['me'], ['me']),
      expenseId,
      date,
      time,
      createdAt,
    });
    const sorted = newestFirst([
      at('mattina', '2026-10-13', '09:00', '3'),
      at('senza-ora', '2026-10-13', null, '4'),
      at('sera', '2026-10-13', '20:30', '1'),
      at('ieri', '2026-10-12', '23:00', '5'),
      at('senza-ora-dopo', '2026-10-13', null, '6'),
    ]);
    expect(sorted.map(({ expenseId }) => expenseId)).toEqual([
      'sera',
      'mattina',
      'senza-ora-dopo',
      'senza-ora',
      'ieri',
    ]);
  });
});
