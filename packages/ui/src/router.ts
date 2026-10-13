import { useSyncExternalStore } from 'react';

// Navigazione con l'hash dell'indirizzo (es. "#/gruppi/01K…/saldi"): funziona allo stesso modo nel browser,
// da file locali e dentro le WebView delle app native, senza configurare il server (ADR 0009).

export type GroupTab = 'spese' | 'saldi' | 'membri';
export const GROUP_TABS: readonly GroupTab[] = ['spese', 'saldi', 'membri'];

export type Route =
  | { readonly page: 'groups' }
  | { readonly page: 'settings' }
  | { readonly page: 'group'; readonly groupId: string; readonly tab: GroupTab }
  /** Spesa nuova (`expenseId` null) o da modificare. */
  | { readonly page: 'expense'; readonly groupId: string; readonly expenseId: string | null }
  /** Nome, archiviazione ed esportazione del gruppo. */
  | { readonly page: 'groupSettings'; readonly groupId: string }
  | { readonly page: 'notFound' };

export function isGroupTab(value: string): value is GroupTab {
  return (GROUP_TABS as readonly string[]).includes(value);
}

export function parseRoute(hash: string): Route {
  const parts = hash
    .replace(/^#?\/?/, '')
    .split('/')
    .filter((part) => part !== '')
    .map(decode);
  const [first, groupId, section, expenseId, ...rest] = parts;
  if (first === undefined) return { page: 'groups' };
  if (first === 'impostazioni' && groupId === undefined) return { page: 'settings' };
  if (first !== 'gruppi' || groupId === undefined || rest.length > 0) return { page: 'notFound' };
  if (section === undefined) return { page: 'group', groupId, tab: 'spese' };
  if (section === 'spese' && expenseId !== undefined) {
    return { page: 'expense', groupId, expenseId: expenseId === 'nuova' ? null : expenseId };
  }
  if (expenseId !== undefined) return { page: 'notFound' };
  if (section === 'impostazioni') return { page: 'groupSettings', groupId };
  if (isGroupTab(section)) return { page: 'group', groupId, tab: section };
  return { page: 'notFound' };
}

export function routeHref(route: Route): string {
  switch (route.page) {
    case 'groups':
    case 'notFound':
      return '#/';
    case 'settings':
      return '#/impostazioni';
    case 'group':
      return route.tab === 'spese'
        ? `#/gruppi/${encode(route.groupId)}`
        : `#/gruppi/${encode(route.groupId)}/${route.tab}`;
    case 'expense':
      return `#/gruppi/${encode(route.groupId)}/spese/${route.expenseId === null ? 'nuova' : encode(route.expenseId)}`;
    case 'groupSettings':
      return `#/gruppi/${encode(route.groupId)}/impostazioni`;
  }
}

/** Va alla pagina indicata; con `replace` non aggiunge un passo alla cronologia (es. cambio di scheda). */
export function navigate(
  route: Route,
  { replace = false }: { readonly replace?: boolean } = {},
): void {
  if (replace) window.location.replace(routeHref(route));
  else window.location.hash = routeHref(route);
}

/** Pagina attuale, aggiornata quando cambia l'hash (link, pulsanti Indietro e Avanti del browser). */
export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribeToHash, () => window.location.hash);
  return parseRoute(hash);
}

function subscribeToHash(listener: () => void): () => void {
  window.addEventListener('hashchange', listener);
  return () => {
    window.removeEventListener('hashchange', listener);
  };
}

function encode(segment: string): string {
  return encodeURIComponent(segment);
}

/** Un segmento con una codifica non valida (es. "%E0") resta com'è: porterà a "pagina non trovata". */
function decode(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}
