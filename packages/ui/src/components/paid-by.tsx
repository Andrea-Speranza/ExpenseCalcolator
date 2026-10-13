import type { ExpenseView } from '@expense/engine';
import { Fragment } from 'react';
import { nameOf } from '../group-data';
import type { Names } from '../messages';

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
  const ids = expense.amounts.paidBy.map(({ memberId }) => memberId);
  return (
    <>
      pagato da{' '}
      {ids.map((memberId, index) => (
        <Fragment key={memberId}>
          {index > 0 && ', '}
          <strong className="font-semibold text-foreground">
            {nameOf(names, memberId)}
            {memberId === me && ' (tu)'}
          </strong>
        </Fragment>
      ))}
    </>
  );
}
