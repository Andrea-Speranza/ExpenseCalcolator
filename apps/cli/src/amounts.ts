import {
  type ExpenseAmounts,
  fromDecimalString,
  type GroupView,
  type MemberAmount,
  type Money,
} from '@expense/engine';
import type { Values } from './options';
import { findMember } from './resolve';
import { UsageError, UserError } from './result';

// Importi, pagatori e divisioni scritti dall'utente, in formato italiano: "12,50" e "12.50" valgono uguale.
// Negli elenchi "a=33,33,b=66,67" la virgola decimale si riconosce perché non è seguita da "nome=".

/** Importo nella valuta indicata. Non arrotonda mai: più decimali di quelli della valuta sono un errore. */
export function parseMoney(text: string, currency: string): Money {
  const normalized = text.trim().replace(',', '.');
  const parsed = fromDecimalString(normalized, currency);
  if (parsed.ok) return parsed.value;
  switch (parsed.error.code) {
    case 'UnknownCurrency':
      throw new UserError(
        `Valuta sconosciuta: "${currency}". Usa un codice ISO 4217, per esempio EUR.`,
      );
    case 'TooManyDecimals':
      throw new UserError(
        `"${text}" ha troppi decimali: in ${currency} se ne usano al massimo ${String(parsed.error.maxDecimals)}.`,
      );
    case 'InvalidAmountFormat':
      throw new UserError(`"${text}" non è un importo valido (esempi: 12, 12,50, 12.50).`);
    case 'AmountOutOfRange':
      throw new UserError(`"${text}" è un importo troppo grande.`);
  }
}

/** Coppie "nome=valore" separate da virgola o punto e virgola, con la virgola decimale riconosciuta. */
export function parsePairs(text: string, option: string): [string, string][] {
  const pairs: [string, string][] = [];
  for (const token of text.split(/[;,]/)) {
    const separator = token.indexOf('=');
    const last = pairs.at(-1);
    if (separator >= 0) {
      pairs.push([token.slice(0, separator).trim(), token.slice(separator + 1).trim()]);
    } else if (last !== undefined) {
      last[1] = `${last[1]},${token.trim()}`;
    } else {
      throw new UsageError(`--${option} si scrive come nome=valore, per esempio "Anna=50,Luca=50"`);
    }
  }
  if (pairs.some(([name, value]) => name === '' || value === '')) {
    throw new UsageError(`in --${option} manca un nome o un valore`);
  }
  return pairs;
}

/** Chi ha pagato: "--pagato Anna" (tutto il totale) oppure "--pagato Anna=60 --pagato Luca=30". */
export function parsePayers(
  values: readonly string[] | undefined,
  total: Money,
  group: GroupView,
): MemberAmount[] {
  if (values === undefined || values.length === 0) {
    const me = group.members.find(({ memberId }) => memberId === group.me);
    if (me === undefined) throw new UsageError('indica chi ha pagato con --pagato <membro>');
    return [{ memberId: me.memberId, amount: total }];
  }
  const [single] = values;
  if (values.length === 1 && single !== undefined && !single.includes('=')) {
    return [{ memberId: findMember(group, single).memberId, amount: total }];
  }
  return values
    .flatMap((value) => parsePairs(value, 'pagato'))
    .map(([name, amount]) => ({
      memberId: findMember(group, name).memberId,
      amount: parseMoney(amount, total.currency),
    }));
}

/** Modalità di divisione dalle opzioni; senza opzioni, parti uguali tra tutti i membri attivi. */
export function parseSplit(
  options: Values,
  group: GroupView,
  currency: string,
): ExpenseAmounts['split'] {
  const given = (['tra', 'importi', 'percentuali', 'quote'] as const).filter(
    (name) => options[name] !== undefined,
  );
  if (given.length > 1)
    throw new UsageError('usa una sola tra --tra, --importi, --percentuali e --quote');
  const memberId = (name: string) => findMember(group, name).memberId;

  if (options.importi !== undefined) {
    return {
      method: 'exact',
      amounts: parsePairs(options.importi, 'importi').map(([name, value]) => ({
        memberId: memberId(name),
        amount: parseMoney(value, currency),
      })),
    };
  }
  if (options.percentuali !== undefined) {
    return {
      method: 'percentage',
      percentages: parsePairs(options.percentuali, 'percentuali').map(([name, value]) => ({
        memberId: memberId(name),
        basisPoints: parsePercentage(value),
      })),
    };
  }
  if (options.quote !== undefined) {
    return {
      method: 'shares',
      weights: parsePairs(options.quote, 'quote').map(([name, value]) => ({
        memberId: memberId(name),
        weight: parseWeight(value),
      })),
    };
  }
  const names =
    options.tra
      ?.split(/[;,]/)
      .map((name) => name.trim())
      .filter((name) => name !== '') ??
    group.members.filter(({ archived }) => !archived).map(({ name }) => name);
  return { method: 'equal', memberIds: names.map(memberId) };
}

/** Indica se le opzioni toccano il blocco "importi" di una spesa. */
export function changesAmounts(options: Values): boolean {
  return (['importo', 'valuta', 'pagato', 'tra', 'importi', 'percentuali', 'quote'] as const).some(
    (name) => options[name] !== undefined,
  );
}

/** Percentuale con al massimo due decimali ("33,33") in punti base (3333). */
function parsePercentage(text: string): number {
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(text.trim());
  if (match === null)
    throw new UserError(`"${text}" non è una percentuale valida (esempi: 50, 33,33).`);
  const [, integer = '0', fraction = ''] = match;
  return Number(integer) * 100 + Number(fraction.padEnd(2, '0'));
}

function parseWeight(text: string): number {
  if (!/^\d+$/.test(text.trim()))
    throw new UserError(`"${text}" non è una quota valida: usa un numero intero.`);
  return Number(text.trim());
}

/** Data come AAAA-MM-GG o GG/MM/AAAA; la verifica che esista davvero la fa l'engine. */
export function parseDate(text: string): string {
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text.trim());
  if (iso !== null) return text.trim();
  const italian = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(text.trim());
  if (italian === null)
    throw new UserError(`"${text}" non è una data valida (esempi: 2026-10-12, 12/10/2026).`);
  const [, day = '', month = '', year = ''] = italian;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}
