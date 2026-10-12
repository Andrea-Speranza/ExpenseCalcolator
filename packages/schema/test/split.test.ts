import { describe, expect, it } from 'vitest';
import { MemberAmountSchema, MemberIdSchema, SplitSchema } from '../src/index';

describe('MemberIdSchema', () => {
  it.each(['m_a', '01J9Z5XK3M7Q8R2T4V6W8Y0A1B', '0192d4c8-7b1e-7cc3-9f1a-2b3c4d5e6f70'])(
    'accetta %j',
    (id) => {
      expect(MemberIdSchema.safeParse(id).success).toBe(true);
    },
  );

  it.each(['', 'con spazio', 'àccento', 'x'.repeat(65)])('rifiuta %j', (id) => {
    expect(MemberIdSchema.safeParse(id).success).toBe(false);
  });
});

describe('MemberAmountSchema', () => {
  it('richiede un importo con valuta', () => {
    expect(
      MemberAmountSchema.safeParse({ memberId: 'm_a', amount: { minor: 100, currency: 'EUR' } })
        .success,
    ).toBe(true);
    expect(MemberAmountSchema.safeParse({ memberId: 'm_a', amount: { minor: 100 } }).success).toBe(
      false,
    );
  });
});

describe('SplitSchema', () => {
  it.each([
    { method: 'equal', memberIds: ['m_a', 'm_b'] },
    { method: 'exact', amounts: [{ memberId: 'm_a', amount: { minor: 100, currency: 'EUR' } }] },
    { method: 'percentage', percentages: [{ memberId: 'm_a', basisPoints: 10_000 }] },
    { method: 'shares', weights: [{ memberId: 'm_a', weight: 2 }] },
  ])('accetta la modalità $method', (split) => {
    expect(SplitSchema.safeParse(split).success).toBe(true);
  });

  it.each([
    ['modalità sconosciuta', { method: 'random', memberIds: ['m_a'] }],
    [
      'percentuale oltre il 100%',
      { method: 'percentage', percentages: [{ memberId: 'm_a', basisPoints: 10_001 }] },
    ],
    [
      'percentuale decimale',
      { method: 'percentage', percentages: [{ memberId: 'm_a', basisPoints: 33.3 }] },
    ],
    ['quota negativa', { method: 'shares', weights: [{ memberId: 'm_a', weight: -1 }] }],
    [
      'importo esatto senza valuta',
      { method: 'exact', amounts: [{ memberId: 'm_a', amount: { minor: 100 } }] },
    ],
  ])('rifiuta: %s', (_case, split) => {
    expect(SplitSchema.safeParse(split).success).toBe(false);
  });
});
