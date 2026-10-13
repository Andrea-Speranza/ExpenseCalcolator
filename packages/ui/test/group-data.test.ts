import type { ExpenseView } from '@expense/engine';
import { describe, expect, it } from 'vitest';
import { entryTimes, formatLongDate, formatMoment } from '../src/format';
import { matchesFilter, participants } from '../src/group-data';

/** Gli spazi non separabili che Intl mette negli importi diventano spazi normali. */
const plain = (text: string | null) => text?.replace(/[\u00a0\u202f]/g, ' ') ?? null;

const eur = (minor: number) => ({ minor, currency: 'EUR' });

function expense(paidBy: string[], split: string[]): ExpenseView {
  return {
    expenseId: 'e1',
    description: 'Cena',
    date: '2026-10-13',
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
