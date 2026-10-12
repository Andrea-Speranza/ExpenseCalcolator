import { describe, expect, it } from 'vitest';
import { calculateLedger } from '../src/index';

const lunch = {
  id: 'e_1',
  total: { minor: 9000, currency: 'EUR' },
  paidBy: [{ memberId: 'm_a', amount: { minor: 9000, currency: 'EUR' } }],
  split: { method: 'equal', memberIds: ['m_a', 'm_b', 'm_c'] },
};

describe('calculateLedger', () => {
  it('restituisce registro validato, saldi e trasferimenti', () => {
    const result = calculateLedger({ expenses: [lunch], settlements: [] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.ledger.expenses).toHaveLength(1);
    expect(result.value.balances[0]?.balances.map(({ amount }) => amount.minor)).toEqual([
      6000, -3000, -3000,
    ]);
    expect(result.value.simplifiedTransfers).toHaveLength(2);
    expect(result.value.pairwiseTransfers).toHaveLength(2);
  });

  it('segnala i campi che non rispettano lo schema, con il loro percorso', () => {
    const result = calculateLedger({
      expenses: [{ ...lunch, total: { minor: 90.5, currency: 'EUR' } }],
      settlements: [],
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatchObject({
      code: 'InvalidInput',
      issues: [{ path: 'expenses.0.total.minor' }],
    });
  });

  it('rifiuta dati che non sono un registro', () => {
    expect(calculateLedger('non un registro')).toMatchObject({
      ok: false,
      error: { code: 'InvalidInput' },
    });
  });

  it('passa gli errori di dominio del core', () => {
    const unbalanced = {
      ...lunch,
      paidBy: [{ memberId: 'm_a', amount: { minor: 1, currency: 'EUR' } }],
    };
    expect(calculateLedger({ expenses: [unbalanced], settlements: [] })).toMatchObject({
      ok: false,
      error: { code: 'InvalidEntry', id: 'e_1', error: { code: 'TotalMismatch' } },
    });
  });
});
