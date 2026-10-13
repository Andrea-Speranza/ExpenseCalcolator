import type { ExpenseView, MemberView } from '@expense/engine';
import { describe, expect, it } from 'vitest';
import {
  draftFromExpense,
  type ExpenseDraft,
  expenseChanges,
  exactProgress,
  newDraft,
  percentageProgress,
  readDraft,
} from '../src/expense-draft';

const member = (memberId: string, name: string): MemberView => ({
  memberId,
  name,
  archived: false,
  createdBy: null,
  createdAt: '0000000000000:00000:d',
  version: '0000000000000:00000:d',
  conflicts: [],
});

const MEMBERS = [member('a', 'Anna'), member('l', 'Luca'), member('s', 'Sara')];
const eur = (minor: number) => ({ minor, currency: 'EUR' });

function draft(changes: Partial<ExpenseDraft> = {}): ExpenseDraft {
  return { ...newDraft(MEMBERS, 'l', '2026-10-13'), description: 'Cena', amount: '90', ...changes };
}

describe('newDraft', () => {
  it('parte da chi usa l’app, diviso in parti uguali tra tutti', () => {
    const empty = newDraft(MEMBERS, 'l', '2026-10-13');
    expect(empty.payer).toBe('l');
    expect(empty.method).toBe('equal');
    expect(empty.included).toEqual({ a: true, l: true, s: true });
    expect(newDraft(MEMBERS, null, '2026-10-13').payer).toBe('a');
    expect(newDraft([], null, '2026-10-13').payer).toBe('');
  });
});

describe('readDraft', () => {
  it('parti uguali tra chi è selezionato', () => {
    const read = readDraft(draft({ included: { a: true, l: false, s: true } }), MEMBERS, 'EUR');
    expect(read).toEqual({
      ok: true,
      value: {
        description: 'Cena',
        date: '2026-10-13',
        amounts: {
          total: eur(9000),
          paidBy: [{ memberId: 'l', amount: eur(9000) }],
          split: { method: 'equal', memberIds: ['a', 's'] },
        },
        category: null,
        notes: null,
      },
    });
  });

  it('più pagatori, importi esatti, percentuali e quote', () => {
    const base = draft({ payerMode: 'multiple', payments: { a: '60', s: '30,00' } });
    const amounts = (changes: Partial<ExpenseDraft>) => {
      const read = readDraft({ ...base, ...changes }, MEMBERS, 'EUR');
      return read.ok ? read.value.amounts : read.error;
    };
    expect(amounts({ method: 'exact', exact: { a: '45', l: '45', s: ' ' } })).toEqual({
      total: eur(9000),
      paidBy: [
        { memberId: 'a', amount: eur(6000) },
        { memberId: 's', amount: eur(3000) },
      ],
      split: {
        method: 'exact',
        amounts: [
          { memberId: 'a', amount: eur(4500) },
          { memberId: 'l', amount: eur(4500) },
        ],
      },
    });
    expect(
      amounts({ method: 'percentage', percentages: { a: '33,33', l: '66,67' } }),
    ).toMatchObject({
      split: {
        method: 'percentage',
        percentages: [
          { memberId: 'a', basisPoints: 3333 },
          { memberId: 'l', basisPoints: 6667 },
        ],
      },
    });
    expect(amounts({ method: 'shares', shares: { a: '2', l: '0', s: '1' } })).toMatchObject({
      split: {
        method: 'shares',
        weights: [
          { memberId: 'a', weight: 2 },
          { memberId: 's', weight: 1 },
        ],
      },
    });
  });

  it('restituisce gli errori accanto ai campi', () => {
    const read = readDraft(
      draft({
        description: '  ',
        amount: '12,345',
        date: '',
        payerMode: 'multiple',
        payments: { a: 'boh' },
        method: 'percentage',
        percentages: { l: '120' },
      }),
      MEMBERS,
      'EUR',
    );
    expect(read).toEqual({
      ok: false,
      error: {
        description: 'Scrivi una descrizione.',
        date: 'Indica la data.',
        amount: 'In EUR si usano al massimo 2 decimali.',
        payments: { a: 'Non è un importo valido (esempi: 12 oppure 12,50).' },
        members: { l: 'La percentuale supera il 100%.' },
      },
    });
    expect(readDraft(draft({ included: {} }), MEMBERS, 'EUR')).toMatchObject({
      ok: false,
      error: { split: 'Scegli almeno una persona.' },
    });
    expect(readDraft(draft({ payer: '' }), MEMBERS, 'EUR')).toMatchObject({
      ok: false,
      error: { payer: 'Indica chi ha pagato.' },
    });
  });
});

describe('modifica di una spesa', () => {
  const expense: ExpenseView = {
    expenseId: 'e1',
    description: 'Cena',
    date: '2026-10-13',
    amounts: {
      total: eur(9000),
      paidBy: [{ memberId: 'a', amount: eur(9000) }],
      split: { method: 'equal', memberIds: ['s', 'a', 'l'] },
    },
    category: null,
    notes: 'pizzeria',
    deleted: false,
    createdBy: null,
    createdAt: '0000000000000:00000:d',
    version: '0000000000000:00000:d',
    conflicts: [],
  };

  it('il form riparte dai valori salvati e senza modifiche non cambia nulla', () => {
    const loaded = draftFromExpense(expense);
    expect(loaded).toMatchObject({
      amount: '90,00',
      payerMode: 'single',
      payer: 'a',
      notes: 'pizzeria',
    });
    const read = readDraft(loaded, MEMBERS, 'EUR');
    expect(read.ok && expenseChanges(expense, read.value)).toBeNull();
  });

  it('indica solo i campi cambiati', () => {
    const read = readDraft(
      { ...draftFromExpense(expense), notes: '', amount: '60' },
      MEMBERS,
      'EUR',
    );
    expect(read.ok && expenseChanges(expense, read.value)).toEqual({
      amounts: {
        total: eur(6000),
        paidBy: [{ memberId: 'a', amount: eur(6000) }],
        split: { method: 'equal', memberIds: ['a', 'l', 's'] },
      },
      notes: null,
    });
  });

  it('riconosce più pagatori e le altre modalità di divisione', () => {
    const loaded = draftFromExpense({
      ...expense,
      amounts: {
        total: eur(9000),
        paidBy: [
          { memberId: 'a', amount: eur(5000) },
          { memberId: 'l', amount: eur(4000) },
        ],
        split: {
          method: 'percentage',
          percentages: [
            { memberId: 'a', basisPoints: 2550 },
            { memberId: 's', basisPoints: 7450 },
          ],
        },
      },
    });
    expect(loaded).toMatchObject({
      payerMode: 'multiple',
      payments: { a: '50,00', l: '40,00' },
      method: 'percentage',
      percentages: { a: '25,5', s: '74,5' },
      included: { a: true, s: true },
    });
  });
});

describe('avanzamento della divisione', () => {
  it('mostra quanto manca al totale e al 100%', () => {
    expect(exactProgress(draft({ exact: { a: '30', l: '20,5' } }), MEMBERS, 'EUR')).toEqual({
      assigned: eur(5050),
      total: eur(9000),
    });
    expect(exactProgress(draft({ exact: { a: 'x' } }), MEMBERS, 'EUR')).toBeNull();
    expect(percentageProgress(draft({ percentages: { a: '50', s: '25,5' } }), MEMBERS)).toBe(7550);
  });
});
