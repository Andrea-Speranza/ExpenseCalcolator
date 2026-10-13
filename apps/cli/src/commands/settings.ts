import {
  exportGroupFile,
  type InvalidExchangeFile,
  importExchangeFile,
  parseExchangeFile,
  serializeExchangeFile,
} from '@expense/engine';
import { formatSettings } from '../format';
import { describeError } from '../messages';
import { findGroup } from '../resolve';
import { done, orFail, UserError } from '../result';
import { type CommandSpec, toJson } from './command';

// Impostazioni personali, ed esportazione/importazione dei gruppi su file: il modo manuale di passare un
// gruppo a un altro dispositivo o a un'altra persona (il canale "file", CONDIVISIONE.md). Il formato del file
// è lo stesso della web app (engine, exchange.ts).

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
      const content = orFail(exportGroupFile(current, group.groupId), describeError);
      const { events } = content;
      try {
        await env.writeFile(file, serializeExchangeFile(content));
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
      let text: string;
      try {
        text = await env.readFile(file);
      } catch {
        throw new UserError(`Impossibile leggere "${file}" come file esportato.`);
      }
      const parsed = parseExchangeFile(text);
      if (!parsed.ok) throw new UserError(describeFileError(parsed.error, file));
      const current = await engine();
      const { groups: touched, ...summary } = orFail(
        await importExchangeFile(current, parsed.value),
        describeError,
      );
      if (json) return done(toJson(summary));
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

function describeFileError({ reason }: InvalidExchangeFile, file: string): string {
  switch (reason) {
    case 'notJson':
      return `Impossibile leggere "${file}" come file esportato.`;
    case 'notExchangeFile':
      return `"${file}" non è un file esportato da questa app.`;
    case 'newerVersion':
      return `"${file}" è stato esportato da una versione più recente dell'app: aggiornala per importarlo.`;
  }
}
