// Versioni e rilasci (ADR 0011). Il numero di versione sta nel package.json principale: Tauri lo legge da lì,
// Cargo.toml e Cargo.lock ne tengono una copia, che questo script aggiorna e controlla.
//   node scripts/release.mjs 0.1.0-alpha.2 [--dry-run]  prepara il rilascio: numero, CHANGELOG, commit e tag
//   node scripts/release.mjs --check [--tag v0.1.0-alpha.2]  verifica le copie del numero (e il tag)
//   node scripts/release.mjs --notes 0.1.0-alpha.2  scrive le note del rilascio, prese dal CHANGELOG
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const PACKAGE = 'package.json';
const CARGO = 'apps/native/src-tauri/Cargo.toml';
const CARGO_LOCK = 'apps/native/src-tauri/Cargo.lock';
const TAURI = 'apps/native/src-tauri/tauri.conf.json';
const TAURI_VERSION = '../../../package.json';
const CHANGELOG = 'CHANGELOG.md';
const CRATE = 'expense-calcolator';
const REPOSITORY = 'https://github.com/Andrea-Speranza/ExpenseCalcolator';
const UNRELEASED = 'Non rilasciato';

// SemVer 2.0.0 senza metadati di build: 1.2.3 oppure 1.2.3-alpha.1.
const IDENTIFIER = '(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)';
const SEMVER = new RegExp(
  `^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-(${IDENTIFIER}(?:\\.${IDENTIFIER})*))?$`,
);
const CARGO_VERSION = /^version = "([^"]+)"/m;
const LOCK_VERSION = new RegExp(`^name = "${CRATE}"\\nversion = "([^"]+)"`, 'm');

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function read(path) {
  return readFileSync(path, 'utf8');
}

function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim();
}

function currentVersion() {
  return JSON.parse(read(PACKAGE)).version;
}

/** Problemi nelle copie del numero di versione; vuoto se coincidono. */
function versionProblems(tag) {
  const version = currentVersion();
  const problems = [];
  if (!SEMVER.test(version)) problems.push(`${PACKAGE}: "${version}" non è una versione SemVer`);
  const tauri = JSON.parse(read(TAURI)).version;
  if (tauri !== TAURI_VERSION) problems.push(`${TAURI}: "version" deve essere "${TAURI_VERSION}"`);
  const cargo = CARGO_VERSION.exec(read(CARGO))?.[1];
  if (cargo !== version) problems.push(`${CARGO}: versione "${cargo}" invece di "${version}"`);
  const lock = LOCK_VERSION.exec(read(CARGO_LOCK))?.[1];
  if (lock !== version) problems.push(`${CARGO_LOCK}: versione "${lock}" invece di "${version}"`);
  if (tag !== undefined && tag !== `v${version}`) {
    problems.push(
      `il tag "${tag}" non corrisponde alla versione "${version}" (atteso "v${version}")`,
    );
  }
  return problems;
}

/** Ordine delle versioni secondo SemVer: negativo se a viene prima di b. */
function compare(a, b) {
  const [, ...left] = SEMVER.exec(a);
  const [, ...right] = SEMVER.exec(b);
  for (let i = 0; i < 3; i++) {
    const difference = Number(left[i]) - Number(right[i]);
    if (difference !== 0) return difference;
  }
  // Una pre-release (1.0.0-alpha.1) viene prima della versione finale (1.0.0).
  if (left[3] === undefined || right[3] === undefined) {
    return (left[3] === undefined ? 1 : 0) - (right[3] === undefined ? 1 : 0);
  }
  const a3 = left[3].split('.');
  const b3 = right[3].split('.');
  for (let i = 0; i < Math.max(a3.length, b3.length); i++) {
    const x = a3[i];
    const y = b3[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const numericX = /^\d+$/.test(x);
    const numericY = /^\d+$/.test(y);
    if (numericX && numericY && x !== y) return Number(x) - Number(y);
    if (numericX !== numericY) return numericX ? -1 : 1;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** Testo di una sezione del CHANGELOG ("## [titolo] …"), fino alla sezione o ai link successivi. */
function section(changelog, title) {
  const heading = new RegExp(`^## \\[${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\].*$`, 'm');
  const match = heading.exec(changelog);
  if (match === null) return null;
  const rest = changelog.slice(match.index + match[0].length);
  const end = rest.search(/^(## |\[[^\]]+\]: )/m);
  return (end < 0 ? rest : rest.slice(0, end)).trim();
}

function today() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${String(now.getFullYear())}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function prepare(version, dryRun) {
  if (!SEMVER.test(version)) fail(`"${version}" non è una versione SemVer (es. 0.1.0-alpha.2).`);
  const previous = currentVersion();
  if (compare(version, previous) <= 0) {
    fail(`La nuova versione deve venire dopo quella attuale (${previous}).`);
  }
  const problems = versionProblems();
  if (problems.length > 0) fail(`Le versioni non coincidono:\n- ${problems.join('\n- ')}`);
  if (git('rev-parse', '--abbrev-ref', 'HEAD') !== 'main') fail('Si rilascia solo da main.');
  if (git('status', '--porcelain') !== '')
    fail('Ci sono modifiche non salvate: fai prima il commit.');
  if (git('tag', '--list', `v${version}`) !== '') fail(`Il tag v${version} esiste già.`);

  const changelog = read(CHANGELOG);
  const notes = section(changelog, UNRELEASED);
  if (notes === null) fail(`In ${CHANGELOG} manca la sezione "## [${UNRELEASED}]".`);
  if (notes === '') fail(`Scrivi le novità in ${CHANGELOG}, sotto "## [${UNRELEASED}]".`);

  // La sezione «Non rilasciato» diventa quella della nuova versione, e se ne apre una vuota sopra.
  const previousTag = git('tag', '--list', `v${previous}`) === '' ? null : `v${previous}`;
  const updatedChangelog = changelog
    .replace(`## [${UNRELEASED}]\n`, `## [${UNRELEASED}]\n\n## [${version}] - ${today()}\n`)
    .replace(
      new RegExp(`^\\[${UNRELEASED}\\]: .*$`, 'm'),
      [
        `[${UNRELEASED}]: ${REPOSITORY}/compare/v${version}...HEAD`,
        previousTag === null
          ? `[${version}]: ${REPOSITORY}/releases/tag/v${version}`
          : `[${version}]: ${REPOSITORY}/compare/${previousTag}...v${version}`,
      ].join('\n'),
    );

  const files = {
    [PACKAGE]: read(PACKAGE).replace(`"version": "${previous}"`, `"version": "${version}"`),
    [CARGO]: read(CARGO).replace(CARGO_VERSION, `version = "${version}"`),
    [CARGO_LOCK]: read(CARGO_LOCK).replace(
      LOCK_VERSION,
      `name = "${CRATE}"\nversion = "${version}"`,
    ),
    [CHANGELOG]: updatedChangelog,
  };

  if (dryRun) {
    process.stdout.write(
      `Prova: ${previous} → ${version}. Verrebbero aggiornati ${Object.keys(files).join(', ')}, ` +
        `poi commit "Rilascio ${version}" e tag v${version}.\n\nNote del rilascio:\n\n${notes}\n`,
    );
    return;
  }
  for (const [path, content] of Object.entries(files)) writeFileSync(path, content);
  const after = versionProblems();
  if (after.length > 0) fail(`Aggiornamento non riuscito:\n- ${after.join('\n- ')}`);

  git('add', ...Object.keys(files));
  git('commit', '--quiet', '--message', `Rilascio ${version}`);
  git('tag', '--annotate', `v${version}`, '--message', `Spese di gruppo ${version}`);
  process.stdout.write(
    `Pronto il rilascio ${version} (commit e tag v${version}, solo in locale).\n` +
      'Per pubblicarlo: git push --follow-tags\n' +
      'GitHub compila l’app per Windows e crea la release (workflow "Rilascio").\n',
  );
}

/** Note della GitHub Release: la sezione del CHANGELOG e le istruzioni per installare. */
function releaseNotes(version) {
  const notes = section(read(CHANGELOG), version);
  if (notes === null || notes === '') fail(`In ${CHANGELOG} manca la sezione "## [${version}]".`);
  const prerelease = version.includes('-');
  return [
    notes,
    '---',
    ...(prerelease
      ? [
          '**Versione di prova.** Le versioni alfa servono a provare l’app e possono cambiare molto da una ' +
            'all’altra: prima di aggiornare conviene esportare i gruppi importanti.',
        ]
      : []),
    '**Installazione su Windows 10 e 11:** scarica il file `…-windows-x64-setup.exe` e aprilo. L’installer ' +
      'non è ancora firmato, quindi Windows SmartScreen mostra «Windows ha protetto il PC»: scegli ' +
      '«Ulteriori informazioni» e poi «Esegui comunque». La nuova versione sostituisce quella installata e ' +
      'mantiene i dati.',
    '**Verifica del download:** `SHA256SUMS.txt` contiene l’impronta dell’installer. In PowerShell: ' +
      '`Get-FileHash <file>` deve dare lo stesso valore.',
  ].join('\n\n');
}

const args = process.argv.slice(2);
if (args[0] === '--check') {
  const tagIndex = args.indexOf('--tag');
  const problems = versionProblems(tagIndex < 0 ? undefined : args[tagIndex + 1]);
  if (problems.length > 0) fail(`Le versioni non coincidono:\n- ${problems.join('\n- ')}`);
  process.stdout.write(`Versione ${currentVersion()}: tutte le copie coincidono.\n`);
} else if (args[0] === '--notes' && args[1] !== undefined) {
  process.stdout.write(`${releaseNotes(args[1])}\n`);
} else if (args[0] !== undefined && !args[0].startsWith('--')) {
  prepare(args[0], args.includes('--dry-run'));
} else {
  fail(
    'Uso: pnpm release <versione> [--dry-run]  (es. pnpm release 0.1.0-alpha.2)\n' +
      '     node scripts/release.mjs --check [--tag v<versione>]\n' +
      '     node scripts/release.mjs --notes <versione>',
  );
}
