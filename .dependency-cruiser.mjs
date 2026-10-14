// Regole sui confini tra pacchetti (PLANNING §3): le dipendenze vanno solo verso il basso,
// ui → engine → core/sync → schema. `pnpm deps` fallisce se una regola viene violata.

/** @type {import('dependency-cruiser').IConfiguration} */
export default {
  forbidden: [
    {
      name: 'no-circular',
      comment: 'Nessuna dipendenza circolare.',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'not-to-unresolvable',
      comment: 'Ogni import deve puntare a un modulo esistente.',
      severity: 'error',
      from: {},
      to: { couldNotResolve: true },
    },
    {
      name: 'shared-no-node-builtins',
      comment:
        'schema, core, sync, engine e i18n girano su ogni piattaforma: niente moduli di Node.',
      severity: 'error',
      from: { path: '^packages/(schema|core|sync|engine|i18n)/src/' },
      to: { dependencyTypes: ['core'] },
    },
    {
      name: 'core-no-npm',
      comment: 'Il core non ha dipendenze esterne (PLANNING §4.2).',
      severity: 'error',
      from: { path: '^packages/core/src/' },
      to: { path: 'node_modules' },
    },
    {
      name: 'core-only-schema',
      comment: 'Il core può usare solo schema.',
      severity: 'error',
      from: { path: '^packages/core/src/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(core|schema)/' },
    },
    {
      name: 'core-schema-type-only',
      comment:
        'Dal core verso schema solo `import type`: nel core non entra codice di Zod (ADR 0003).',
      severity: 'error',
      from: { path: '^packages/core/src/' },
      to: { path: '^packages/schema/', dependencyTypesNot: ['type-only'] },
    },
    {
      name: 'schema-is-bottom',
      comment: 'schema è lo strato più basso: non dipende da nessun altro pacchetto del progetto.',
      severity: 'error',
      from: { path: '^packages/schema/src/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/schema/' },
    },
    {
      name: 'sync-only-schema',
      comment: 'sync può usare solo schema.',
      severity: 'error',
      from: { path: '^packages/sync/src/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(sync|schema)/' },
    },
    {
      name: 'engine-no-outer-layers',
      comment: 'engine definisce le porte ma non conosce adapter, canali, ui o app.',
      severity: 'error',
      from: { path: '^packages/engine/src/' },
      to: { path: '^(packages/(adapters|channels|ui)|apps)/' },
    },
    {
      name: 'adapters-only-ports',
      comment:
        'Un adapter conosce solo le porte (engine) e i tipi (schema), non gli altri adapter.',
      severity: 'error',
      from: { path: '^packages/adapters/([^/]+)/src/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(engine|schema|adapters/$1)/' },
    },
    {
      name: 'channels-only-ports',
      comment:
        'Un canale di condivisione è un plugin: conosce solo la porta (engine) e i tipi (schema), non gli altri canali (ADR 0006).',
      severity: 'error',
      from: { path: '^packages/channels/([^/]+)/src/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(engine|schema|channels/$1)/' },
    },
    {
      name: 'i18n-only-engine',
      comment:
        'i18n (testi, lingue e formati, ADR 0010) conosce solo engine e schema: lo usano sia la UI sia la CLI.',
      severity: 'error',
      from: { path: '^packages/i18n/src/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(i18n|engine|schema)/' },
    },
    {
      name: 'ui-only-engine',
      comment:
        'La UI parla solo con engine (e usa schema per tipi e validazione dei form, i18n per i testi).',
      severity: 'error',
      from: { path: '^packages/ui/src/' },
      to: { path: '^(packages|apps)/', pathNot: '^packages/(ui|engine|schema|i18n)/' },
    },
    {
      name: 'apps-no-internals',
      comment:
        'Le shell collegano ui, engine, adapter e canali; non usano direttamente core e sync.',
      severity: 'error',
      from: { path: '^apps/' },
      to: { path: '^packages/(core|sync)/' },
    },
    {
      name: 'src-not-to-test',
      comment: 'Il codice sorgente non importa mai dai test.',
      severity: 'error',
      from: { path: '/src/' },
      to: { path: '/test/' },
    },
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: { path: '(^|/)(dist|coverage)/' },
    // Rileva anche gli `import type`, necessari per la regola core-schema-type-only.
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.base.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.ts', '.tsx', '.js', '.mjs', '.cjs', '.json'],
    },
  },
};
