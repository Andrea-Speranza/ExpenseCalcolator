import { describe, expect, it } from 'vitest';
import { parseRoute, type Route, routeHref } from '../src/router';

describe('parseRoute', () => {
  it.each<[string, Route]>([
    ['', { page: 'groups' }],
    ['#/', { page: 'groups' }],
    ['#/impostazioni', { page: 'settings' }],
    ['#/archiviati', { page: 'archivedGroups' }],
    ['#/gruppi/g1', { page: 'group', groupId: 'g1', tab: 'spese' }],
    ['#/gruppi/g1/saldi', { page: 'group', groupId: 'g1', tab: 'saldi' }],
    ['#/gruppi/g1/membri', { page: 'group', groupId: 'g1', tab: 'membri' }],
    ['#/gruppi/g1/spese/nuova', { page: 'expense', groupId: 'g1', expenseId: null }],
    ['#/gruppi/g1/spese/e1', { page: 'expense', groupId: 'g1', expenseId: 'e1' }],
    ['#/gruppi/g1/impostazioni', { page: 'groupSettings', groupId: 'g1' }],
  ])('%s', (hash, route) => {
    expect(parseRoute(hash)).toEqual(route);
  });

  it.each([
    '#/altro',
    '#/gruppi',
    '#/gruppi/g1/boh',
    '#/gruppi/g1/saldi/x',
    '#/impostazioni/x',
    '#/gruppi/g1/impostazioni/x',
  ])('%s non esiste', (hash) => {
    expect(parseRoute(hash)).toEqual({ page: 'notFound' });
  });

  it('ignora una codifica non valida invece di fallire', () => {
    expect(parseRoute('#/gruppi/%E0')).toEqual({ page: 'group', groupId: '%E0', tab: 'spese' });
  });
});

describe('routeHref', () => {
  it.each<Route>([
    { page: 'groups' },
    { page: 'settings' },
    { page: 'archivedGroups' },
    { page: 'group', groupId: 'g1', tab: 'spese' },
    { page: 'group', groupId: 'g1', tab: 'saldi' },
    { page: 'expense', groupId: 'g1', expenseId: null },
    { page: 'expense', groupId: 'g1', expenseId: 'e1' },
    { page: 'groupSettings', groupId: 'g1' },
  ])('torna alla stessa pagina: %o', (route) => {
    expect(parseRoute(routeHref(route))).toEqual(route);
  });
});
