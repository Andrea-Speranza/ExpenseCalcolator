// Salvataggio di un file generato dall'app (es. l'esportazione di un gruppo) nella cartella dei download.
// Nelle app native (Fase 4) va verificato: se la WebView non gestisce i download, la shell fornirà alla UI il
// proprio modo di salvare i file.

/** Caratteri che Windows, Android e gli altri sistemi non accettano nei nomi di file (più quelli di controllo). */
const FORBIDDEN = /[\\/:*?"<>|\p{Cc}]/gu;

/**
 * Nome del gruppo adatto a un nome di file (es. "Casa 1/2" → "Casa 1-2"); vuoto se non resta nulla. Il nome
 * completo del file (es. "Vacanza.spese.json") lo compone la UI nella lingua attiva.
 */
export function safeFileName(groupName: string): string {
  return groupName.replace(FORBIDDEN, '-').trim();
}

export function downloadTextFile(name: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  // Il browser ha già preso il contenuto: l'indirizzo temporaneo si può liberare.
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
}
