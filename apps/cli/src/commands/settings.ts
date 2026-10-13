import { formatSettings } from '../format';
import { describeError } from '../messages';
import { findGroup } from '../resolve';
import { done, orFail, UserError } from '../result';
import { type CommandSpec, toJson } from './command';

// Impostazioni personali, ed esportazione/importazione dei gruppi su file: il modo manuale di passare un
// gruppo a un altro dispositivo o a un'altra persona (il canale "file", CONDIVISIONE.md).

/** Formato del file esportato: gli eventi del gruppo, così come sono salvati. */
const EXPORT_FORMAT = 'expense-calcolator/eventi';

export const settingsCommands: readonly CommandSpec[] = [
  {
    name: 'impostazioni',
    arguments: [],
    options: ['valuta', 'lingua', 'nome'],
    summary: 'mostra o cambia le impostazioni personali',
    details: [
      'Esempio: spese impostazioni --valuta CHF --nome Anna',
      'La valuta predefinita si usa per i nuovi gruppi.',
    ],
    async run({ options, engine, json }) {
      const current = await engine();
      const { valuta, lingua, nome } = options;
      if (valuta !== undefined || lingua !== undefined || nome !== undefined) {
        if (lingua !== undefined && lingua !== 'it' && lingua !== 'en') {
          throw new UserError(`Lingua non disponibile: "${lingua}". Scegli tra it ed en.`);
        }
        orFail(
          await current.execute({
            type: 'UpdateSettings',
            changes: {
              defaultCurrency: valuta?.toUpperCase(),
              language: lingua,
              displayName: nome,
            },
          }),
          describeError,
        );
      }
      const settings = orFail(current.query({ type: 'GetSettings' }), describeError);
      return done(json ? toJson(settings) : formatSettings(settings));
    },
  },
  {
    name: 'esporta',
    arguments: ['gruppo', 'file'],
    options: [],
    summary: 'salva il gruppo in un file, da importare su un altro dispositivo',
    details: [
      'Il file contiene tutte le modifiche del gruppo: importarlo più volte non crea doppioni.',
    ],
    async run({ args: [reference = '', file = ''], env, engine, json }) {
      const current = await engine();
      const group = findGroup(current, reference);
      const events = current.exportEvents(group.groupId);
      const content = { format: EXPORT_FORMAT, version: 1, group: group.name, events };
      try {
        await env.writeFile(file, `${JSON.stringify(content, null, 2)}\n`);
      } catch {
        throw new UserError(`Impossibile scrivere il file "${file}".`);
      }
      if (json) return done(toJson({ file, events: events.length }));
      return done(
        `Gruppo «${group.name}» esportato in "${file}" (${String(events.length)} modifiche).\n`,
      );
    },
  },
  {
    name: 'importa',
    arguments: ['file'],
    options: [],
    summary: 'importa un gruppo esportato da un altro dispositivo, o le sue novità',
    async run({ args: [file = ''], env, engine, json }) {
      let data: unknown;
      try {
        data = JSON.parse((await env.readFile(file)).replace(/^\uFEFF/, ''));
      } catch {
        throw new UserError(`Impossibile leggere "${file}" come file esportato.`);
      }
      const events = exportedEvents(data);
      if (events === undefined)
        throw new UserError(`"${file}" non è un file esportato da questa app.`);
      const current = await engine();
      const summary = orFail(await current.receiveEvents(events), describeError);
      if (json) return done(toJson(summary));
      const groups = orFail(current.query({ type: 'ListGroups' }), describeError);
      const streams = new Set(
        events.flatMap((event) => (isStreamEvent(event) ? [event.stream] : [])),
      );
      const touched = groups.filter(({ groupId }) => streams.has(groupId));
      const names = touched.map(({ name }) => `«${name}»`);
      const lines = [
        summary.added === 0
          ? 'Nessuna novità: queste modifiche erano già presenti.'
          : `Importate ${String(summary.added)} modifiche${names.length > 0 ? ` in ${names.join(', ')}` : ''}.`,
      ];
      if (summary.invalid > 0) lines.push(`Scartate ${String(summary.invalid)} voci non valide.`);
      if (summary.added > 0 && touched.some(({ me }) => me === null)) {
        lines.push('Per indicare chi sei nel gruppo: spese gruppo io <gruppo> <membro>');
      }
      return done(`${lines.join('\n')}\n`);
    },
  },
];

function exportedEvents(data: unknown): readonly unknown[] | undefined {
  if (typeof data !== 'object' || data === null || !('format' in data) || !('events' in data))
    return undefined;
  return data.format === EXPORT_FORMAT && Array.isArray(data.events)
    ? (data.events as unknown[])
    : undefined;
}

function isStreamEvent(event: unknown): event is { readonly stream: string } {
  return (
    typeof event === 'object' &&
    event !== null &&
    'stream' in event &&
    typeof event.stream === 'string'
  );
}
