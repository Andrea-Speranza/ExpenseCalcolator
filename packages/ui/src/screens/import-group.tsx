import {
  type ImportSummary,
  importExchangeFile,
  type InvalidExchangeFile,
  parseExchangeFile,
  type Result,
  type StorageFailed,
} from '@expense/engine';
import { Button } from '@expense/ui/components/ui/button';
import { UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useEngine } from '../engine/store';

export type ImportResult = Result<ImportSummary, InvalidExchangeFile | StorageFailed>;

/** Importa un gruppo esportato (da questa app, dalla CLI o da un altro dispositivo) scegliendo il file. */
export function ImportGroupButton({
  onResult,
}: {
  readonly onResult: (result: ImportResult) => void;
}) {
  const engine = useEngine();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);

  async function importFile(file: File) {
    setPending(true);
    try {
      let text: string;
      try {
        text = await file.text();
      } catch {
        onResult({ ok: false, error: { code: 'InvalidExchangeFile', reason: 'notJson' } });
        return;
      }
      const parsed = parseExchangeFile(text);
      onResult(parsed.ok ? await importExchangeFile(engine, parsed.value) : parsed);
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <input
        ref={input}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="File da importare"
        onChange={(event) => {
          const file = event.target.files?.[0];
          // Svuotato subito, così si può importare di nuovo lo stesso file (es. con le novità).
          event.target.value = '';
          if (file !== undefined) void importFile(file);
        }}
      />
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          input.current?.click();
        }}
      >
        <UploadIcon data-icon="inline-start" />
        Importa
      </Button>
    </>
  );
}
