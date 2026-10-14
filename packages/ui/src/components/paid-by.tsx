import type { ExpenseView } from '@expense/engine';
import type { Names } from '@expense/i18n';
import { Fragment } from 'react';
import { nameOf } from '../group-data';
import { K, useI18n } from '../i18n';

/** "pagato da Anna", con i nomi di chi ha pagato in evidenza; chi usa l'app è indicato con "(tu)". */
export function PaidBy({
  expense,
  names,
  me,
}: {
  readonly expense: ExpenseView;
  readonly names: Names;
  readonly me: string | null;
}) {
  const { t } = useI18n();
  const ids = expense.amounts.paidBy.map(({ memberId }) => memberId);
  return (
    <>
      {t(K.expenses.paidBy)}{' '}
      {ids.map((memberId, index) => (
        <Fragment key={memberId}>
          {index > 0 && ', '}
          <strong className="font-semibold text-foreground">
            {nameOf(names, memberId)}
            {memberId === me && ` ${t(K.common.you)}`}
          </strong>
        </Fragment>
      ))}
    </>
  );
}
