import type { ExpenseView } from '@expense/engine';
import { describe, expect, it } from 'vitest';
import { entryTimes, formatLongDate, formatMoment } from '../src/format';
import { accountsStatus, matchesFilter, newestFirst, participants } from '../src/group-data';

/** Gli spazi non separabili che Intl mette negli importi diventano spazi normali. */
const plain = (text: string | null) => text?.replace(/[\u00a0\u202f]/g, ' ') ?? null;

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
      { memberId: 'a', detail: null },
      { memberId: 'b', detail: null },
    ]);
    expect(
      participants({ method: 'exact', amounts: [{ memberId: 'a', amount: eur(2050) }] }).map(
        ({ detail }) => plain(detail),
      ),
    ).toEqual(['20,50 €']);
    expect(
      participants({ method: 'percentage', percentages: [{ memberId: 'a', basisPoints: 2500 }] }),
    ).toEqual([{ memberId: 'a', detail: '25%' }]);
    expect(
      participants({
        method: 'shares',
        weights: [
          { memberId: 'a', weight: 1 },
          { memberId: 'b', weight: 2 },
        ],
      }).map(({ detail }) => detail),
    ).toEqual(['1 quota', '2 quote']);
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
  it('mostra quando un elemento è stato inserito e modificato', () => {
    expect(formatMoment(1_760_000_000_000, 'Europe/Rome')).toEqual({
      day: '9 ott 2025',
      time: '10:53',
    });
    expect(
      entryTimes(
        { createdAt: '1760000000000:00000:d', version: '1760000000000:00000:d' },
        'Inserita',
        'Europe/Rome',
      ),
    ).toBe('Inserita il 9 ott 2025 alle 10:53');
    expect(
      entryTimes(
        { createdAt: '1760000000000:00000:d', version: '1760090000000:00000:d' },
        'Inserito',
        'Europe/Rome',
      ),
    ).toBe('Inserito il 9 ott 2025 alle 10:53 · modificato il 10 ott 2025 alle 11:53');
    expect(formatLongDate('2026-10-13')).toBe('martedì 13 ottobre 2026');
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
