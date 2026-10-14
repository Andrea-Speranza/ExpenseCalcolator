import type { CommandError, QueryError } from '@expense/engine';
import { Alert, AlertDescription } from '@expense/ui/components/ui/alert';
import { CircleAlertIcon } from 'lucide-react';
import { describeError, type Names } from '@expense/i18n';
import { useI18n } from '../i18n';

/** Errore restituito dall'engine, spiegato nella lingua attiva. */
export function ErrorAlert({
  error,
  names,
}: {
  readonly error: CommandError | QueryError | null;
  readonly names?: Names;
}) {
  const i18n = useI18n();
  if (error === null) return null;
  return (
    <Alert variant="destructive">
      <CircleAlertIcon />
      <AlertDescription>{describeError(i18n, error, names)}</AlertDescription>
    </Alert>
  );
}
