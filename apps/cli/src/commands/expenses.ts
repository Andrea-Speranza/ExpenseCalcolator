import type { Engine, ExpenseAmounts, GroupView } from '@expense/engine';
import { changesAmounts, parseDate, parseMoney, parsePayers, parseSplit } from '../amounts';
import { describePayers, describeSplit, formatMoney, groupNames, shortCode } from '../format';
import { describeError } from '../messages';
import type { Values } from '../options';
import { findExpense, findGroup, findMember, findSettlement } from '../resolve';
import { done, orFail, UsageError } from '../result';
import { type CommandSpec, toJson } from './command';

// Spese e rimborsi.

const SPLIT_HELP = [
  'Divisione (una sola; predefinita: parti uguali tra tutti i membri attivi):',
  '  --tra Anna,Luca                 parti uguali tra questi membri',
  '  --importi Anna=50,Luca=40       importi esatti (la somma deve fare il totale)',
  '  --percentuali Anna=60,Luca=40   percentuali, anche con decimali (33,33)',
  '  --quote Anna=2,Luca=1           quote intere',
  'Chi ha pagato: --pagato Anna, oppure --pagato Anna=60 --pagato Luca=30 (predefinito: tu).',
];

/** Testo facoltativo: una stringa vuota lo toglie (null), assente lo lascia com'è (undefined). */
const optionalText = (value: string | undefined): string | null | undefined =>
  value === undefined ? undefined : value.trim() === '' ? null : value;

function amountsFrom(
  options: Values,
  group: GroupView,
  total: ExpenseAmounts['total'],
): ExpenseAmounts {
  return {
    total,
    paidBy: parsePayers(options.pagato, total, group),
    split: parseSplit(options, group, total.currency),
  };
}

/** Nuovo blocco "importi": le parti non indicate restano quelle attuali (ADR 0007, blocco coerente). */
function updatedAmounts(
  options: Values,
  group: GroupView,
  current: ExpenseAmounts,
): ExpenseAmounts {
  const currency = options.valuta?.toUpperCase() ?? current.total.currency;
  if (currency !== current.total.currency && options.importo === undefined) {
    throw new UsageError('cambiando la valuta indica anche il nuovo totale con --importo');
  }
  const total =
    options.importo === undefined ? current.total : parseMoney(options.importo, currency);
  const [onlyPayer] = current.paidBy;
  let paidBy = current.paidBy;
  if (options.pagato !== undefined) paidBy = parsePayers(options.pagato, total, group);
  else if (total !== current.total) {
    if (current.paidBy.length !== 1 || onlyPayer === undefined) {
      throw new UsageError(
        'la spesa ha più pagatori: indica con --pagato quanto ha pagato ciascuno',
      );
    }
    paidBy = [{ memberId: onlyPayer.memberId, amount: total }];
  }
  const splitGiven = (['tra', 'importi', 'percentuali', 'quote'] as const).some(
    (name) => options[name] !== undefined,
  );
  return {
    total,
    paidBy,
    split: splitGiven ? parseSplit(options, group, currency) : current.split,
  };
}

function setDeleted(deleted: boolean): CommandSpec['run'] {
  return async ({ args: [reference = '', expenseReference = ''], engine, json }) => {
    const current = await engine();
    const group = findGroup(current, reference);
    const expense = findExpense(group, expenseReference);
    const groupId = group.groupId;
    const { expenseId } = expense;
    orFail(
      await current.execute(
        deleted
          ? { type: 'DeleteExpense', groupId, expenseId }
          : { type: 'RestoreExpense', groupId, expenseId },
      ),
      describeError,
    );
    if (json) return done(toJson({ expenseId, deleted }));
    return done(
      `Spesa «${expense.description}» ${deleted ? 'eliminata (si può ripristinare)' : 'ripristinata'}.\n`,
    );
  };
}

function setSettlementDeleted(deleted: boolean): CommandSpec['run'] {
  return async ({ args: [reference = '', settlementReference = ''], engine, json }) => {
    const current = await engine();
    const group = findGroup(current, reference);
    const { settlementId } = findSettlement(group, settlementReference);
    const groupId = group.groupId;
    orFail(
      await current.execute(
        deleted
          ? { type: 'DeleteSettlement', groupId, settlementId }
          : { type: 'RestoreSettlement', groupId, settlementId },
      ),
      describeError,
    );
    if (json) return done(toJson({ settlementId, deleted }));
    return done(
      `Rimborso #${shortCode(settlementId)} ${deleted ? 'eliminato (si può ripristinare)' : 'ripristinato'}.\n`,
    );
  };
}

function reload(engine: Engine, groupId: string): GroupView {
  return orFail(engine.query({ type: 'GetGroup', groupId }), describeError);
}

export const expenseCommands: readonly CommandSpec[] = [
  {
    name: 'spesa aggiungi',
    arguments: ['gruppo', 'descrizione', 'importo'],
    options: [
      'pagato',
      'tra',
      'importi',
      'percentuali',
      'quote',
      'data',
      'valuta',
      'categoria',
      'note',
    ],
    summary: 'registra una spesa',
    details: [
      'Esempio: spese spesa aggiungi Weekend "Cena al rifugio" 90 --pagato Anna --tra Anna,Luca,Sara',
      ...SPLIT_HELP,
    ],
    async run({
      args: [reference = '', description = '', amount = ''],
      options,
      env,
      engine,
      json,
    }) {
      const current = await engine();
      const group = findGroup(current, reference);
      const total = parseMoney(amount, options.valuta?.toUpperCase() ?? group.baseCurrency);
      const amounts = amountsFrom(options, group, total);
      const { expenseId } = orFail(
        await current.execute({
          type: 'AddExpense',
          groupId: group.groupId,
          description,
          date: options.data === undefined ? env.today() : parseDate(options.data),
          amounts,
          category: optionalText(options.categoria) ?? undefined,
          notes: optionalText(options.note) ?? undefined,
        }),
        describeError,
      );
      const updated = reload(current, group.groupId);
      const expense = updated.expenses.find((item) => item.expenseId === expenseId);
      if (json) return done(toJson(expense));
      const names = groupNames(updated);
      return done(
        `Spesa «${description.trim()}» aggiunta (#${shortCode(expenseId)}): ${formatMoney(total)}, ${describePayers(amounts.paidBy, names)}, ${describeSplit(amounts.split, names)}.\n`,
      );
    },
  },
  {
    name: 'spesa modifica',
    arguments: ['gruppo', 'spesa'],
    options: [
      'descrizione',
      'importo',
      'valuta',
      'pagato',
      'tra',
      'importi',
      'percentuali',
      'quote',
      'data',
      'categoria',
      'note',
    ],
    summary: 'modifica una spesa; indica solo ciò che cambia',
    details: [
      'La spesa si indica con la descrizione o con il codice mostrato da "gruppo mostra" (es. #3k9f2a).',
      'Categoria e note: "" le toglie.',
      ...SPLIT_HELP,
    ],
    async run({ args: [reference = '', expenseReference = ''], options, engine, json }) {
      const current = await engine();
      const group = findGroup(current, reference);
      const expense = findExpense(group, expenseReference);
      orFail(
        await current.execute({
          type: 'UpdateExpense',
          groupId: group.groupId,
          expenseId: expense.expenseId,
          base: expense.version,
          changes: {
            description: options.descrizione,
            date: options.data === undefined ? undefined : parseDate(options.data),
            amounts: changesAmounts(options)
              ? updatedAmounts(options, group, expense.amounts)
              : undefined,
            category: optionalText(options.categoria),
            notes: optionalText(options.note),
          },
        }),
        describeError,
      );
      const updated = reload(current, group.groupId).expenses.find(
        ({ expenseId }) => expenseId === expense.expenseId,
      );
      return done(
        json
          ? toJson(updated)
          : `Spesa «${updated?.description ?? expense.description}» modificata.\n`,
      );
    },
  },
  {
    name: 'spesa elimina',
    arguments: ['gruppo', 'spesa'],
    options: [],
    summary: 'elimina una spesa (resta nello storico e si può ripristinare)',
    run: setDeleted(true),
  },
  {
    name: 'spesa ripristina',
    arguments: ['gruppo', 'spesa'],
    options: [],
    summary: 'ripristina una spesa eliminata',
    run: setDeleted(false),
  },
  {
    name: 'rimborso aggiungi',
    arguments: ['gruppo', 'da', 'a', 'importo'],
    options: ['data', 'valuta', 'note'],
    summary: 'registra un rimborso: <da> ha dato <importo> ad <a>',
    details: ['Esempio: spese rimborso aggiungi Weekend Luca Anna 30'],
    async run({
      args: [reference = '', from = '', to = '', amount = ''],
      options,
      env,
      engine,
      json,
    }) {
      const current = await engine();
      const group = findGroup(current, reference);
      const transfer = {
        from: findMember(group, from).memberId,
        to: findMember(group, to).memberId,
        amount: parseMoney(amount, options.valuta?.toUpperCase() ?? group.baseCurrency),
      };
      const { settlementId } = orFail(
        await current.execute({
          type: 'AddSettlement',
          groupId: group.groupId,
          transfer,
          date: options.data === undefined ? env.today() : parseDate(options.data),
          notes: optionalText(options.note) ?? undefined,
        }),
        describeError,
      );
      if (json) return done(toJson({ settlementId, transfer }));
      const names = groupNames(group);
      return done(
        `Rimborso registrato (#${shortCode(settlementId)}): ${names.get(transfer.from) ?? from} → ${names.get(transfer.to) ?? to}, ${formatMoney(transfer.amount)}.\n`,
      );
    },
  },
  {
    name: 'rimborso elimina',
    arguments: ['gruppo', 'rimborso'],
    options: [],
    summary: 'elimina un rimborso (si indica con il codice, es. #a1b2c3)',
    run: setSettlementDeleted(true),
  },
  {
    name: 'rimborso ripristina',
    arguments: ['gruppo', 'rimborso'],
    options: [],
    summary: 'ripristina un rimborso eliminato',
    run: setSettlementDeleted(false),
  },
];
