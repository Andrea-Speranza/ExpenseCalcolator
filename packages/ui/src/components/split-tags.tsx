import type { Split } from '@expense/engine';
import type { Names } from '@expense/i18n';
import { Badge } from '@expense/ui/components/ui/badge';
import { nameOf, type ParticipantShare, participants } from '../group-data';
import { K, type UiI18n, useI18n } from '../i18n';

/** Le persone tra cui è divisa una spesa, come etichette; chi usa l'app è evidenziato. */
export function SplitTags({
  split,
  names,
  me,
}: {
  readonly split: Split;
  readonly names: Names;
  readonly me: string | null;
}) {
  const i18n = useI18n();
  return (
    <ul className="flex flex-wrap gap-1" aria-label={i18n.t(K.expenses.splitBetween)}>
      {participants(split).map(({ memberId, share }) => (
        <li key={memberId}>
          <Badge variant={memberId === me ? 'default' : 'secondary'}>
            {nameOf(names, memberId)}
            {share !== null && <span className="opacity-70">{describeShare(i18n, share)}</span>}
          </Badge>
        </li>
      ))}
    </ul>
  );
}

function describeShare({ t, format }: UiI18n, share: ParticipantShare): string {
  switch (share.kind) {
    case 'amount':
      return format.money(share.amount);
    case 'percentage':
      return format.percentage(share.basisPoints);
    case 'shares':
      return t(K.expenses.shares, { count: share.weight });
  }
}
