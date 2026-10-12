import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  CurrencyCodeSchema,
  ExpenseIdSchema,
  LedgerSchema,
  type MemberAmount,
  MemberIdSchema,
  MoneySchema,
} from '@expense/schema';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  computeBalances,
  pairwiseTransfers,
  simplifiedTransfers,
  splitExpense,
} from '../src/index';
import { unwrap } from './helpers';

// Esegue i test vector di spec/test-vectors: casi indipendenti dal linguaggio, validati con gli stessi
// schemi dei dati salvati. Il formato è descritto in spec/README.md.

const VECTORS_DIR = join(import.meta.dirname, '../../../spec/test-vectors');

const MinorByMember = z.record(MemberIdSchema, z.int());
const TransferSchema = z.strictObject({
  from: MemberIdSchema,
  to: MemberIdSchema,
  amount: MoneySchema,
});

const TestVectorSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1),
  input: LedgerSchema,
  expected: z.strictObject({
    owed: z.record(ExpenseIdSchema, MinorByMember),
    balances: z.record(CurrencyCodeSchema, MinorByMember),
    simplifiedTransfers: z.array(TransferSchema),
    pairwiseTransfers: z.array(TransferSchema),
  }),
});

const byMember = (amounts: readonly MemberAmount[]) =>
  Object.fromEntries(amounts.map(({ memberId, amount }) => [memberId, amount.minor]));

const files = readdirSync(VECTORS_DIR)
  .filter((file) => file.endsWith('.json'))
  .sort();

it('esistono dei test vector', () => {
  expect(files.length).toBeGreaterThan(0);
});

describe.each(files)('%s', (file) => {
  const vector = TestVectorSchema.parse(JSON.parse(readFileSync(join(VECTORS_DIR, file), 'utf8')));
  const { input, expected } = vector;

  it('quota dovuta da ciascuno per ogni spesa', () => {
    expect(Object.keys(expected.owed).sort()).toEqual(input.expenses.map(({ id }) => id).sort());
    for (const expense of input.expenses) {
      expect(byMember(unwrap(splitExpense(expense)).owed)).toEqual(expected.owed[expense.id]);
    }
  });

  it('saldi per valuta', () => {
    const balances = unwrap(computeBalances(input));
    expect(
      Object.fromEntries(
        balances.map(({ currency, balances: list }) => [currency, byMember(list)]),
      ),
    ).toEqual(expected.balances);
  });

  it('trasferimenti semplificati, nell’ordine previsto', () => {
    expect(unwrap(simplifiedTransfers(unwrap(computeBalances(input))))).toEqual(
      expected.simplifiedTransfers,
    );
  });

  it('trasferimenti per coppia, nell’ordine previsto', () => {
    expect(unwrap(pairwiseTransfers(input))).toEqual(expected.pairwiseTransfers);
  });
});
