import type { Engine } from '@expense/engine';

/**
 * Tutto ciò che la CLI usa del mondo esterno: file, dati salvati e data di oggi. In produzione lo fornisce
 * main.ts; nei test un ambiente in memoria, così ogni comando si prova senza toccare il disco.
 */
export interface CliEnvironment {
  /** Legge un file indicato dall'utente; rifiuta la promessa se non ci riesce. */
  readFile(path: string): Promise<string>;
  writeFile(path: string, content: string): Promise<void>;
  /** Apre l'engine sui dati salvati, nella cartella indicata con --dati o in quella predefinita. */
  openEngine(dataDirectory: string | undefined): Promise<Engine>;
  /** Data di oggi (AAAA-MM-GG), proposta per spese e rimborsi. */
  today(): string;
}
