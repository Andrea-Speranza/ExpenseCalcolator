// Strumenti di test condivisi tra i pacchetti: le suite di contratto delle porte (PLANNING §14).
// Si usano solo nei test, mai nel codice dell'app.
export { describeLocalStoreContract } from './local-store';
export type { StoreFactory } from './local-store';
