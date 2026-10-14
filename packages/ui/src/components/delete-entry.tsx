import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@expense/ui/components/ui/alert-dialog';
import { Button } from '@expense/ui/components/ui/button';
import { RotateCcwIcon, Trash2Icon } from 'lucide-react';
import type { ReactNode } from 'react';
import { K, useI18n } from '../i18n';

// Eliminazione di spese e rimborsi: chiede conferma, perché un tocco sbagliato cambierebbe i saldi.
// L'elemento eliminato resta nell'elenco (barrato) e si può ripristinare.

export interface DeleteTexts {
  /** Es. "Eliminare «Cena»?" */
  readonly title: string;
  readonly description: string;
}

/** Chiede conferma prima di eliminare. `children` è il pulsante che apre la richiesta. */
export function ConfirmDelete({
  texts,
  onConfirm,
  children,
}: {
  readonly texts: DeleteTexts;
  readonly onConfirm: () => void;
  readonly children: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{texts.title}</AlertDialogTitle>
          <AlertDialogDescription>{texts.description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t(K.common.cancel)}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" onClick={onConfirm}>
            {t(K.common.delete)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** Pulsante a icona per le righe degli elenchi: elimina (con conferma) oppure ripristina. */
export function DeleteOrRestoreButton({
  deleted,
  label,
  texts,
  disabled,
  onDelete,
  onRestore,
}: {
  readonly deleted: boolean;
  /** Cosa si elimina, per i lettori di schermo (es. "la spesa «Cena»"). */
  readonly label: string;
  readonly texts: DeleteTexts;
  readonly disabled: boolean;
  readonly onDelete: () => void;
  readonly onRestore: () => void;
}) {
  const { t } = useI18n();
  if (deleted) {
    return (
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={t(K.entry.restore, { what: label })}
        onClick={onRestore}
      >
        <RotateCcwIcon />
      </Button>
    );
  }
  return (
    <ConfirmDelete texts={texts} onConfirm={onDelete}>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={disabled}
        aria-label={t(K.entry.delete, { what: label })}
      >
        <Trash2Icon />
      </Button>
    </ConfirmDelete>
  );
}
