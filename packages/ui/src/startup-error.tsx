import { Alert, AlertDescription, AlertTitle } from '@expense/ui/components/ui/alert';
import { CircleAlertIcon } from 'lucide-react';

/** Mostrata dalle shell quando i dati salvati non si possono aprire (es. archivio del browser bloccato). */
export function StartupError({ error }: { readonly error: unknown }) {
  return (
    <main className="mx-auto flex min-h-svh max-w-2xl items-center px-4">
      <Alert variant="destructive">
        <CircleAlertIcon />
        <AlertTitle>Impossibile aprire i dati salvati</AlertTitle>
        <AlertDescription>
          <p>
            Controlla che il browser permetta ai siti di salvare dati (non in navigazione privata) e
            ricarica la pagina.
          </p>
          <p className="font-mono text-xs">
            {error instanceof Error ? error.message : String(error)}
          </p>
        </AlertDescription>
      </Alert>
    </main>
  );
}
