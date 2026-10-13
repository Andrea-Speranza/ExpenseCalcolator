import type { Split } from '@expense/engine';
import { Badge } from '@expense/ui/components/ui/badge';
import { nameOf, participants } from '../group-data';
import type { Names } from '../messages';

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
  return (
    <ul className="flex flex-wrap gap-1" aria-label="Divisa tra">
      {participants(split).map(({ memberId, detail }) => (
        <li key={memberId}>
          <Badge variant={memberId === me ? 'default' : 'secondary'}>
            {nameOf(names, memberId)}
            {detail !== null && <span className="opacity-70">{detail}</span>}
          </Badge>
        </li>
      ))}
    </ul>
  );
}
