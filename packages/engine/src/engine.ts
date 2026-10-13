import { err, ok, type Result } from '@expense/core';
import {
  type Command,
  CommandSchema,
  type CommandType,
  type DeviceId,
  type EventId,
  type GroupEvent,
  GroupEventSchema,
  type GroupId,
  type ProfileEvent,
  ProfileEventSchema,
  type ProfileId,
  type Query,
  QuerySchema,
  type QueryType,
  type StoredEvent,
  StoredEventSchema,
  type StreamId,
} from '@expense/schema';
import {
  allowAll,
  type GroupProjection,
  type GroupState,
  INITIAL_CLOCK,
  observeHlc,
  type Policy,
  type ProfileState,
  projectGroup,
  projectProfile,
  tickHlc,
} from '@expense/sync';
import { type CommandResult, planCommand } from './commands';
import type { CommandError, QueryError, StorageFailed } from './errors';
import { invalidInput } from './input';
import type { Clock, DeviceRecord, IdGenerator, LocalStore } from './ports';
import {
  type BalancesView,
  balancesView,
  type GroupSummary,
  groupSummary,
  type GroupView,
  groupView,
  type SettingsView,
  settingsView,
} from './views';

export interface EngineDependencies {
  readonly store: LocalStore;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Politica dei permessi (ADR 0007, punto 7). Se manca: tutti possono tutto. */
  readonly policy?: Policy;
}

/** Cosa restituisce ogni query. */
export interface QueryResults {
  readonly ListGroups: readonly GroupSummary[];
  readonly GetGroup: GroupView;
  readonly GetBalances: BalancesView;
  readonly GetSettings: SettingsView;
}

export interface ReceiveSummary {
  /** Eventi nuovi salvati e applicati. */
  readonly added: number;
  /** Eventi scartati perché non rispettano il formato. */
  readonly invalid: number;
}

/** API pubblica dell'engine (PLANNING §5): comandi, query, notifiche e scambio di eventi con altri dispositivi. */
export interface Engine {
  readonly deviceId: DeviceId;
  readonly profileId: ProfileId;
  execute<T extends CommandType>(
    command: Extract<Command, { readonly type: T }>,
  ): Promise<Result<CommandResult<T>, CommandError>>;
  query<T extends QueryType>(
    query: Extract<Query, { readonly type: T }>,
  ): Result<QueryResults[T], QueryError>;
  /** Avvisa quando lo stato cambia, per un comando locale o per eventi ricevuti. Restituisce la disiscrizione. */
  subscribe(listener: () => void): () => void;
  /** Eventi salvati, di un log o di tutti: è ciò che i canali di condivisione trasportano (ADR 0006). */
  exportEvents(stream?: StreamId): readonly StoredEvent[];
  /** Eventi arrivati da altri dispositivi: si validano, si scartano i doppioni, si salvano e si applicano. */
  receiveEvents(events: readonly unknown[]): Promise<Result<ReceiveSummary, StorageFailed>>;
}

/**
 * Apre l'engine sul salvataggio locale. Alla prima apertura crea l'identità del dispositivo e il profilo.
 * Se il salvataggio non è leggibile la promessa viene rifiutata: senza dati locali l'app non può partire.
 */
export async function openEngine(dependencies: EngineDependencies): Promise<Engine> {
  const { store, ids } = dependencies;
  let device = await store.loadDevice();
  if (device === undefined) {
    device = { deviceId: ids.newId(), profileId: ids.newId(), clock: INITIAL_CLOCK };
    await store.save([], device);
  }
  return new LocalEngine(dependencies, device, await store.loadEvents());
}

class LocalEngine implements Engine {
  readonly #store: LocalStore;
  readonly #clock: Clock;
  readonly #ids: IdGenerator;
  readonly #policy: Policy;
  #device: DeviceRecord;
  /** Tutti gli eventi salvati, anche di tipi sconosciuti, per log. */
  readonly #stored = new Map<StreamId, StoredEvent[]>();
  /** Gli stessi eventi, solo quelli di tipi conosciuti e già validati: per gruppo e del profilo. */
  readonly #groupEvents = new Map<StreamId, GroupEvent[]>();
  readonly #profileEvents: ProfileEvent[] = [];
  readonly #eventIds = new Set<EventId>();
  #profile: ProfileState;
  readonly #groups = new Map<GroupId, GroupProjection>();
  readonly #listeners = new Set<() => void>();
  #queue: Promise<unknown> = Promise.resolve();

  constructor(dependencies: EngineDependencies, device: DeviceRecord, raw: readonly unknown[]) {
    this.#store = dependencies.store;
    this.#clock = dependencies.clock;
    this.#ids = dependencies.ids;
    this.#policy = dependencies.policy ?? allowAll;
    this.#device = device;
    this.#profile = projectProfile(device.profileId, []);
    const valid = raw.flatMap((event) => {
      const parsed = StoredEventSchema.safeParse(event);
      return parsed.success ? [parsed.data] : [];
    });
    this.#reproject(this.#add(valid));
  }

  get deviceId(): DeviceId {
    return this.#device.deviceId;
  }

  get profileId(): ProfileId {
    return this.#device.profileId;
  }

  execute<T extends CommandType>(
    command: Extract<Command, { readonly type: T }>,
  ): Promise<Result<CommandResult<T>, CommandError>> {
    // Il risultato ha la forma prevista per il tipo di comando: lo garantisce planCommand.
    return this.#serialized(() => this.#execute(command)) as Promise<
      Result<CommandResult<T>, CommandError>
    >;
  }

  query<T extends QueryType>(
    query: Extract<Query, { readonly type: T }>,
  ): Result<QueryResults[T], QueryError> {
    // Il risultato ha la forma prevista per il tipo di query: lo garantisce #query.
    return this.#query(query) as Result<QueryResults[T], QueryError>;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  exportEvents(stream?: StreamId): readonly StoredEvent[] {
    if (stream !== undefined) return [...(this.#stored.get(stream) ?? [])];
    return [...this.#stored.values()].flat();
  }

  receiveEvents(events: readonly unknown[]): Promise<Result<ReceiveSummary, StorageFailed>> {
    return this.#serialized(() => this.#receive(events));
  }

  /** Un'operazione alla volta: due comandi lanciati insieme non partono dallo stesso stato. */
  #serialized<R>(task: () => Promise<R>): Promise<R> {
    const run = this.#queue.then(task, task);
    this.#queue = run.catch(() => undefined);
    return run;
  }

  async #execute(input: unknown): Promise<Result<unknown, CommandError>> {
    const command = CommandSchema.safeParse(input);
    if (!command.success) return err(invalidInput(command.error.issues));

    const plan = planCommand(command.data, {
      profileId: this.profileId,
      profile: this.#profile,
      group: (groupId) => this.#groups.get(groupId)?.group ?? undefined,
      newId: () => this.#ids.newId(),
    });
    if (!plan.ok) return plan;

    let clock = this.#device.clock;
    const now = this.#clock.now();
    const events: StoredEvent[] = plan.value.events.map(
      ({ stream, actor, base, type, payload }) => {
        const next = tickHlc(clock, now, this.deviceId);
        clock = next.clock;
        return {
          id: this.#ids.newId(),
          stream,
          type,
          v: 1,
          hlc: next.hlc,
          deviceId: this.deviceId,
          actor,
          ...(base === undefined ? {} : { base }),
          payload,
        };
      },
    );

    const saved = await this.#persist(events, { ...this.#device, clock });
    return saved.ok ? ok(plan.value.result) : saved;
  }

  async #receive(input: readonly unknown[]): Promise<Result<ReceiveSummary, StorageFailed>> {
    const fresh = new Map<EventId, StoredEvent>();
    let invalid = 0;
    for (const raw of input) {
      const parsed = StoredEventSchema.safeParse(raw);
      if (!parsed.success) invalid += 1;
      else if (!this.#eventIds.has(parsed.data.id)) fresh.set(parsed.data.id, parsed.data);
    }
    if (fresh.size === 0) return ok({ added: 0, invalid });

    // I prossimi eventi locali verranno ordinati dopo quelli appena visti (ADR 0007).
    const clock = [...fresh.values()].reduce(
      (current, event) => observeHlc(current, event.hlc),
      this.#device.clock,
    );
    const saved = await this.#persist([...fresh.values()], { ...this.#device, clock });
    return saved.ok ? ok({ added: fresh.size, invalid }) : saved;
  }

  /** Salva e, solo se il salvataggio riesce, aggiorna lo stato in memoria e avvisa chi ascolta. */
  async #persist(
    events: StoredEvent[],
    device: DeviceRecord,
  ): Promise<Result<null, StorageFailed>> {
    try {
      await this.#store.save(events, device);
    } catch (error) {
      return err({
        code: 'StorageFailed',
        message: error instanceof Error ? error.message : String(error),
      });
    }
    this.#device = device;
    this.#reproject(this.#add(events));
    for (const listener of this.#listeners) listener();
    return ok(null);
  }

  /** Aggiunge eventi alla memoria (senza doppioni) e restituisce i log toccati. */
  #add(events: readonly StoredEvent[]): Set<StreamId> {
    const touched = new Set<StreamId>();
    for (const event of events) {
      if (this.#eventIds.has(event.id)) continue;
      this.#eventIds.add(event.id);
      touched.add(event.stream);
      append(this.#stored, event.stream, event);
      // Eventi di tipi sconosciuti (app più recenti) restano salvati ma non entrano nel calcolo dello stato.
      if (event.stream === this.profileId) {
        const known = ProfileEventSchema.safeParse(event);
        if (known.success) this.#profileEvents.push(known.data);
      } else {
        const known = GroupEventSchema.safeParse(event);
        if (known.success) append(this.#groupEvents, event.stream, known.data);
      }
    }
    return touched;
  }

  #reproject(streams: ReadonlySet<StreamId>): void {
    for (const stream of streams) {
      if (stream === this.profileId) {
        this.#profile = projectProfile(stream, this.#profileEvents);
      } else {
        this.#groups.set(
          stream,
          projectGroup(stream, this.#groupEvents.get(stream) ?? [], this.#policy),
        );
      }
    }
  }

  #query(input: unknown): Result<unknown, QueryError> {
    const parsed = QuerySchema.safeParse(input);
    if (!parsed.success) return err(invalidInput(parsed.error.issues));
    const query = parsed.data;
    switch (query.type) {
      case 'ListGroups':
        return ok(this.#listGroups());
      case 'GetSettings':
        return ok(settingsView(this.#profile));
      case 'GetGroup': {
        const projection = this.#groups.get(query.groupId);
        if (projection?.group == null)
          return err({ code: 'NotFound', entity: 'group', id: query.groupId });
        const { group, rejected } = projection;
        return ok(groupView({ group, rejected }, this.#profile.groups.get(group.id)));
      }
      case 'GetBalances': {
        const group = this.#groups.get(query.groupId)?.group;
        if (group == null) return err({ code: 'NotFound', entity: 'group', id: query.groupId });
        return balancesView(group);
      }
    }
  }

  #listGroups(): readonly GroupSummary[] {
    return [...this.#groups.values()]
      .map(({ group }) => group)
      .filter((group): group is GroupState => group !== null)
      .filter((group) => this.#profile.groups.get(group.id)?.linked?.value !== false)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
      .map((group) => groupSummary(group, this.#profile.groups.get(group.id)));
  }
}

function append<V>(map: Map<StreamId, V[]>, stream: StreamId, value: V): void {
  const list = map.get(stream);
  if (list === undefined) map.set(stream, [value]);
  else list.push(value);
}
