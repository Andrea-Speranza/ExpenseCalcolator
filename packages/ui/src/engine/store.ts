import type {
  Command,
  CommandError,
  CommandResult,
  CommandType,
  Engine,
  Query,
  QueryError,
  QueryResults,
  QueryType,
  Result,
} from '@expense/engine';
import { createContext, useContext, useState, useSyncExternalStore } from 'react';

// Collegamento tra l'engine e React (PLANNING §7.4). Le query dell'engine restituiscono oggetti nuovi a ogni
// chiamata, mentre useSyncExternalStore vuole lo stesso valore finché lo stato non cambia: i risultati si
// conservano finché l'engine non avvisa di un cambiamento.

export class EngineStore {
  readonly engine: Engine;
  readonly #listeners = new Set<() => void>();
  #cache = new Map<string, unknown>();

  constructor(engine: Engine) {
    this.engine = engine;
    engine.subscribe(() => {
      this.#cache = new Map();
      for (const listener of this.#listeners) listener();
    });
  }

  readonly subscribe = (listener: () => void): (() => void) => {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  };

  read<T extends QueryType>(
    query: Extract<Query, { readonly type: T }>,
  ): Result<QueryResults[T], QueryError> {
    const key = JSON.stringify(query);
    if (!this.#cache.has(key)) this.#cache.set(key, this.engine.query(query));
    // Il valore in cache è il risultato della stessa query: ha il tipo previsto per T.
    return this.#cache.get(key) as Result<QueryResults[T], QueryError>;
  }
}

export const EngineContext = createContext<EngineStore | null>(null);

function useStore(): EngineStore {
  const store = useContext(EngineContext);
  if (store === null) throw new Error('Manca EngineProvider sopra questo componente.');
  return store;
}

export function useEngine(): Engine {
  return useStore().engine;
}

/** Risultato di una query, aggiornato a ogni cambiamento dello stato dell'engine. */
export function useQuery<T extends QueryType>(
  query: Extract<Query, { readonly type: T }>,
): Result<QueryResults[T], QueryError> {
  const store = useStore();
  return useSyncExternalStore(store.subscribe, () => store.read(query));
}

export interface CommandRunner {
  /** Esegue il comando; in caso di errore lo conserva in `error` per mostrarlo. */
  run<T extends CommandType>(
    command: Extract<Command, { readonly type: T }>,
  ): Promise<Result<CommandResult<T>, CommandError>>;
  readonly pending: boolean;
  readonly error: CommandError | null;
  clearError(): void;
}

/** Esecuzione dei comandi da un form o da un pulsante, con stato di attesa ed errore. */
export function useCommand(): CommandRunner {
  const engine = useEngine();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<CommandError | null>(null);
  return {
    async run(command) {
      setPending(true);
      setError(null);
      try {
        const result = await engine.execute(command);
        if (!result.ok) setError(result.error);
        return result;
      } finally {
        setPending(false);
      }
    },
    pending,
    error,
    clearError() {
      setError(null);
    },
  };
}
