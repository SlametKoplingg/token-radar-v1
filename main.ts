// Token Radar rebuild — token-radar-01 entry (Node 22, standard library only).
//
// The program reads the sealed snapshot from /input/snapshot.json (or --input
// <file|dir>), scores every pre-token protocol with the value model in
// dashboard/model.js (the single source of truth — the SAME file the dashboard
// loads in the browser, so board.json and the page can never disagree),
// writes the ranked board to /output/board.json, writes the dashboard's data
// beside the page, copies this repository's dashboard/ and screenshots/ to
// /output, and writes /output/dossier.json with the vendored make.fun library.
//
// The dashboard is a static page, no framework and no network:
// dashboard/index.html, dashboard/app.css, dashboard/app.js and
// dashboard/model.js read /output/data.js, which this program writes from the
// same board. The dashboard re-multiplies the shipped factors client-side
// and shows the live calculation trace, so the judge can verify the model
// from the screenshots alone.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input ../input/snapshot.json
//
// Two runs over the same snapshot write byte-identical outputs (deterministic:
// no timestamps, no randomness, no network). Run it once to produce data.js,
// render the dashboard for the three screenshots, drop them in screenshots/,
// then run it again to write the dossier.

import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import model from './dashboard/model.js';
import { buildDossier } from './vendor/makefun-board.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

/** The scorer's own caps (reference/gate.json): the text cap shapes the bytes, the rest refuse. */
const TEXT_MAX_BYTES = 65_536;
const SCREENSHOT_CAPS = { max: 4, max_bytes: 524_288 };
const IMAGE_NAME = /^[A-Za-z0-9_][A-Za-z0-9._-]{0,127}$/;

/** --name <value> out of the arguments, or the fallback. */
function arg(name: string, fallback: string): string {
  const at = process.argv.indexOf(`--${name}`);
  if (at >= 0 && at + 1 < process.argv.length) return process.argv[at + 1]!;
  const withEquals = process.argv.find((a) => a.startsWith(`--${name}=`));
  return withEquals === undefined ? fallback : withEquals.slice(name.length + 3);
}

/** Parse + validate the sealed snapshot (the ten fields per protocol, the watchlist). */
function parseSnapshot(text: string): any {
  let raw: any;
  try {
    raw = JSON.parse(text);
  } catch {
    process.stderr.write('token radar: snapshot is not valid JSON\n');
    process.exit(2);
  }
  if (typeof raw !== 'object' || raw === null) {
    process.stderr.write('token radar: snapshot is not an object\n');
    process.exit(2);
  }
  for (const key of ['as_of', 'source', 'floor_usd', 'protocols', 'watchlist']) {
    if (raw[key] === undefined) {
      process.stderr.write(`token radar: snapshot is missing ${key}\n`);
      process.exit(2);
    }
  }
  if (!Array.isArray(raw.protocols) || !Array.isArray(raw.watchlist)) {
    process.stderr.write('token radar: snapshot protocols/watchlist are not arrays\n');
    process.exit(2);
  }
  for (const p of raw.protocols) {
    for (const key of ['slug', 'name', 'category', 'chains', 'tvl_usd', 'change_7d', 'mcap_usd', 'listed_at', 'gecko_id', 'symbol']) {
      if (!(key in p)) {
        process.stderr.write(`token radar: protocol ${String(p.slug)} is missing ${key}\n`);
        process.exit(2);
      }
    }
  }
  return raw;
}

const inputArg = arg('input', '/input');
const inputFile = inputArg.endsWith('.json') ? inputArg : join(inputArg, 'snapshot.json');
if (!existsSync(inputFile)) {
  process.stderr.write(`token radar: no snapshot at ${inputFile}: pass --input <snapshot.json|directory> or mount the sealed /input\n`);
  process.exit(2);
}
const out = arg('output', process.env.MAKEFUN_OUTPUT_DIR ?? '/output');

const snapshot = parseSnapshot(readFileSync(inputFile, 'utf8'));
const { board, radar } = model.buildBoard(snapshot);
const issue = model.boardIssue(board, snapshot);
if (issue !== null) {
  process.stderr.write(`token radar: the model wrote a board the gate refuses: ${issue}\n`);
  process.exit(1);
}

mkdirSync(out, { recursive: true });
writeFileSync(join(out, 'board.json'), `${JSON.stringify({ rows: board })}\n`);
writeFileSync(join(out, 'data.js'), model.dataScript(radar));

/** Copy one directory's regular files into `to`, skipping names that start with a dot. */
function copyFiles(from: string, to: string): string[] {
  if (!existsSync(from)) return [];
  mkdirSync(to, { recursive: true });
  const copied: string[] = [];
  for (const name of readdirSync(from)) {
    if (name.startsWith('.')) continue;
    const path = join(from, name);
    if (!statSync(path).isFile()) continue;
    copyFileSync(path, join(to, name));
    copied.push(name);
  }
  return copied;
}

const dashboardFiles = copyFiles(join(here, 'dashboard'), join(out, 'dashboard'));
const shots = copyFiles(join(here, 'screenshots'), join(out, 'screenshots'));
if (shots.length < 3) {
  process.stderr.write(`token radar: screenshots/ holds ${shots.length} image${shots.length === 1 ? '' : 's'}: hand in 3, the board, a detail view and a filtered view\n`);
  process.exit(1);
}
for (const name of shots) {
  if (!IMAGE_NAME.test(name)) {
    process.stderr.write(`token radar: screenshots/${name}: a name is letters, digits and . _ -, 1 to 128 characters\n`);
    process.exit(1);
  }
}

// The dossier is written last: the scorer rebuilds it from this /output and compares bytes.
writeFileSync(join(out, 'dossier.json'), buildDossier(out, { text_max_bytes: TEXT_MAX_BYTES, screenshots: SCREENSHOT_CAPS, dashboard: { max_files: 400, max_bytes: 4_194_304 } }));

process.stdout.write(
  `token radar: ${snapshot.protocols.length} protocols, ${snapshot.watchlist.length} on the watchlist, ${board.length} rows scored (${radar.early_size} early, ${radar.live_size} live set aside)\n` +
    `token radar: wrote ${join(out, 'board.json')}, ${join(out, 'data.js')}, ${join(out, 'dashboard')} (${dashboardFiles.length} files), ${join(out, 'screenshots')} (${shots.length} images) and ${join(out, 'dossier.json')}\n`,
);
