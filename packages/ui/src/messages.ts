import type { FormProblem } from './expense-draft';
import { K, type UiI18n } from './i18n';

// Testi dei problemi nei form, nella lingua attiva. Gli errori dell'engine e dell'importazione sono in
// @expense/i18n (`describeError`, `describeImport`, `describeFileError`), condivisi con la CLI.

export type { Names } from '@expense/i18n';

export function describeProblem({ t }: UiI18n, problem: FormProblem): string {
  switch (problem.code) {
    case 'amountRequired':
      return t(K.form.amountRequired);
    case 'invalidAmount':
      return t(K.form.invalidAmount);
    case 'tooManyDecimals':
      return problem.max === 0
        ? t(K.form.noDecimals, { currency: problem.currency })
        : t(K.form.tooManyDecimals, { currency: problem.currency, count: problem.max });
    case 'tooLarge':
      return t(K.form.tooLarge);
    case 'unknownCurrency':
      return t(K.form.unknownCurrency, { currency: problem.currency });
    case 'invalidPercentage':
      return t(K.form.invalidPercentage);
    case 'percentageOver100':
      return t(K.form.percentageOver100);
    case 'invalidWeight':
      return t(K.form.invalidWeight);
    case 'descriptionRequired':
      return t(K.form.descriptionRequired);
    case 'dateRequired':
      return t(K.form.dateRequired);
    case 'payerRequired':
      return t(K.form.payerRequired);
    case 'paymentsRequired':
      return t(K.form.paymentsRequired);
    case 'participantsRequired':
      return t(K.form.participantsRequired);
    case 'amountsRequired':
      return t(K.form.amountsRequired);
    case 'percentagesRequired':
      return t(K.form.percentagesRequired);
    case 'sharesRequired':
      return t(K.form.sharesRequired);
  }
}
