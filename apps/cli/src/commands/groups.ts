import type { Engine, GroupView } from '@expense/engine';
import { formatGroup, formatGroups } from '../format';
import { describeError } from '../messages';
import { findGroup, findMember } from '../resolve';
import { done, orFail, UserError } from '../result';
import { type CommandSpec, toJson } from './command';

// Gruppi, membri e "chi sono io". Nella CLI gruppi e membri si indicano per nome, quindi qui non si
// creano doppioni con lo stesso nome (l'engine li permetterebbe: un'interfaccia grafica può distinguerli).

const sameName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase('it') === b.trim().toLocaleLowerCase('it');

function meName(group: GroupView): string | undefined {
  return group.members.find(({ memberId }) => memberId === group.me)?.name;
}

async function setGroup(
  engine: Engine,
  reference: string,
  changes: { name?: string; archived?: boolean },
) {
  const group = findGroup(engine, reference);
  orFail(
    await engine.execute({ type: 'UpdateGroup', groupId: group.groupId, changes }),
    describeError,
  );
  return orFail(engine.query({ type: 'GetGroup', groupId: group.groupId }), describeError);
}

async function setMember(
  engine: Engine,
  groupReference: string,
  memberReference: string,
  changes: { name?: string; archived?: boolean },
) {
  const group = findGroup(engine, groupReference);
  const member = findMember(group, memberReference);
  orFail(
    await engine.execute({
      type: 'UpdateMember',
      groupId: group.groupId,
      memberId: member.memberId,
      changes,
    }),
    describeError,
  );
  return { group, member };
}

export const groupCommands: readonly CommandSpec[] = [
  {
    name: 'gruppi',
    arguments: [],
    options: [],
    summary: 'elenca i gruppi',
    async run({ engine, json }) {
      const current = await engine();
      const groups = orFail(current.query({ type: 'ListGroups' }), describeError);
      if (json) return done(toJson(groups));
      const myNames = new Map(
        groups.map(({ groupId }) => {
          const group = orFail(current.query({ type: 'GetGroup', groupId }), describeError);
          return [groupId, meName(group) ?? ''];
        }),
      );
      return done(formatGroups(groups, myNames));
    },
  },
  {
    name: 'gruppo crea',
    arguments: ['nome'],
    options: ['io', 'valuta'],
    summary: 'crea un gruppo; con --io ne fai parte anche tu',
    details: ['Esempio: spese gruppo crea "Weekend in montagna" --io Anna --valuta EUR'],
    async run({ args: [name = ''], options, engine, json }) {
      const current = await engine();
      const groups = orFail(current.query({ type: 'ListGroups' }), describeError);
      if (groups.some((group) => sameName(group.name, name))) {
        throw new UserError(`Esiste già un gruppo «${name.trim()}»: scegli un altro nome.`);
      }
      const { groupId } = orFail(
        await current.execute({
          type: 'CreateGroup',
          name,
          me: options.io === undefined ? null : { name: options.io },
          baseCurrency: options.valuta?.toUpperCase(),
        }),
        describeError,
      );
      const group = orFail(current.query({ type: 'GetGroup', groupId }), describeError);
      if (json) return done(toJson(group));
      const me = meName(group);
      return done(
        `Gruppo «${group.name}» creato (${group.baseCurrency}${me === undefined ? '' : `, io: ${me}`}).\n`,
      );
    },
  },
  {
    name: 'gruppo mostra',
    arguments: ['gruppo'],
    options: [],
    summary: 'membri, spese, rimborsi ed eventuali modifiche contemporanee',
    async run({ args: [reference = ''], engine, json }) {
      const group = findGroup(await engine(), reference);
      return done(json ? toJson(group) : formatGroup(group));
    },
  },
  {
    name: 'gruppo rinomina',
    arguments: ['gruppo', 'nuovo nome'],
    options: [],
    summary: 'cambia il nome del gruppo',
    async run({ args: [reference = '', name = ''], engine, json }) {
      const group = await setGroup(await engine(), reference, { name });
      return done(json ? toJson(group) : `Gruppo rinominato in «${group.name}».\n`);
    },
  },
  {
    name: 'gruppo archivia',
    arguments: ['gruppo'],
    options: [],
    summary: 'archivia il gruppo (resta consultabile)',
    async run({ args: [reference = ''], engine, json }) {
      const group = await setGroup(await engine(), reference, { archived: true });
      return done(json ? toJson(group) : `Gruppo «${group.name}» archiviato.\n`);
    },
  },
  {
    name: 'gruppo riattiva',
    arguments: ['gruppo'],
    options: [],
    summary: 'toglie il gruppo dall’archivio',
    async run({ args: [reference = ''], engine, json }) {
      const group = await setGroup(await engine(), reference, { archived: false });
      return done(json ? toJson(group) : `Gruppo «${group.name}» riattivato.\n`);
    },
  },
  {
    name: 'gruppo io',
    arguments: ['gruppo', 'membro'],
    options: [],
    summary: 'indica quale membro sei tu in questo gruppo ("nessuno" se non ne fai parte)',
    async run({ args: [reference = '', memberReference = ''], engine, json }) {
      const current = await engine();
      const group = findGroup(current, reference);
      const memberId =
        memberReference.toLocaleLowerCase('it') === 'nessuno'
          ? null
          : findMember(group, memberReference).memberId;
      orFail(
        await current.execute({ type: 'ClaimMember', groupId: group.groupId, memberId }),
        describeError,
      );
      const updated = orFail(
        current.query({ type: 'GetGroup', groupId: group.groupId }),
        describeError,
      );
      if (json) return done(toJson(updated));
      const me = meName(updated);
      return done(
        me === undefined
          ? `In «${group.name}» non sei un membro.\n`
          : `In «${group.name}» tu sei ${me}.\n`,
      );
    },
  },
  {
    name: 'membro aggiungi',
    arguments: ['gruppo', 'nome'],
    options: [],
    summary: 'aggiunge un membro al gruppo',
    async run({ args: [reference = '', name = ''], engine, json }) {
      const current = await engine();
      const group = findGroup(current, reference);
      if (group.members.some((member) => sameName(member.name, name))) {
        throw new UserError(`In «${group.name}» c'è già ${name.trim()}: usa un nome diverso.`);
      }
      const result = orFail(
        await current.execute({ type: 'AddMember', groupId: group.groupId, name }),
        describeError,
      );
      return done(json ? toJson(result) : `${name.trim()} aggiunto a «${group.name}».\n`);
    },
  },
  {
    name: 'membro rinomina',
    arguments: ['gruppo', 'membro', 'nuovo nome'],
    options: [],
    summary: 'cambia il nome di un membro',
    async run({ args: [reference = '', member = '', name = ''], engine, json }) {
      const result = await setMember(await engine(), reference, member, { name });
      return done(json ? toJson(result) : `${result.member.name} ora si chiama ${name.trim()}.\n`);
    },
  },
  {
    name: 'membro archivia',
    arguments: ['gruppo', 'membro'],
    options: [],
    summary: 'archivia un membro: resta nelle spese passate, non viene più proposto per le nuove',
    async run({ args: [reference = '', member = ''], engine, json }) {
      const result = await setMember(await engine(), reference, member, { archived: true });
      return done(
        json ? toJson(result) : `${result.member.name} archiviato in «${result.group.name}».\n`,
      );
    },
  },
  {
    name: 'membro riattiva',
    arguments: ['gruppo', 'membro'],
    options: [],
    summary: 'toglie un membro dall’archivio',
    async run({ args: [reference = '', member = ''], engine, json }) {
      const result = await setMember(await engine(), reference, member, { archived: false });
      return done(
        json ? toJson(result) : `${result.member.name} riattivato in «${result.group.name}».\n`,
      );
    },
  },
];
