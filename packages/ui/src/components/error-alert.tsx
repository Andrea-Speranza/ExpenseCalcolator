import type { CommandError, QueryError } from '@expense/engine';
import { Alert, AlertDescription } from '@expense/ui/components/ui/alert';
import { CircleAlertIcon } from 'lucide-react';
import { describeError, type Names } from '../messages';

/** Errore restituito dall'engine, spiegato in italiano. */
export function ErrorAlert({
  error,
  names,
}: {
  readonly error: CommandError | QueryError | null;
  readonly names?: Names;
}) {
  if (error === null) return null;
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{describeError(error, names)}</AlertDescription>
    </Alert>
  );
}
