#!/usr/bin/env node
// Guard: does the tree you are about to publish contain anything internal?
//
//   node scripts/check-public-safe.mjs              # scan git-tracked files in this repo
//   node scripts/check-public-safe.mjs --dist <dir> # scan an exported/public copy
//   node scripts/check-public-safe.mjs --list       # show the active pattern list
//
// Patterns come from config/forbidden.local.json when it exists (git-ignored),
// otherwise from config/forbidden.example.json (publishable placeholders).
// Exit codes: 0 clean · 1 forbidden hit · 2 config missing/unreadable.

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');

const LOCAL = join(repoRoot, 'config', 'forbidden.local.json');
const EXAMPLE = join(repoRoot, 'config', 'forbidden.example.json');

// Never scanned: the config itself, this script, and VCS noise.
const SKIP = ['.git', 'node_modules', 'dist', 'config', 'scripts/check-public-safe.mjs'];

const TEXT = new Set(['.md', '.json', '.mjs', '.js', '.ts', '.yml', '.yaml', '.txt', '.sh', '.ps1']);

function parseArgs(argv) {
  const out = { dist: null, list: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dist') out.dist = argv[++i];
    else if (a === '--list' || a === '-l') out.list = true;
  }
  return out;
}

function loadPatterns() {
  const file = existsSync(LOCAL) ? LOCAL : EXAMPLE;
  if (!existsSync(file)) {
    console.error(`no pattern file: expected ${LOCAL} or ${EXAMPLE}`);
    process.exit(2);
  }
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return { file: relative(repoRoot, file), patterns: data.patterns ?? [], allow: data.allow ?? [] };
}

function trackedFiles() {
  // --others: include untracked-but-not-ignored files, otherwise a file that is
  // about to be committed for the first time would never be scanned.
  const out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return out.split('\n').filter(Boolean).map((p) => join(repoRoot, p));
}

function walk(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (SKIP.some((s) => relative(repoRoot, full).startsWith(s) || entry === s)) continue;
    if (isAllowed(full)) continue;
    const st = statSync(full);
    if (st.isDirectory()) found.push(...walk(full));
    else if (TEXT.has(extname(full))) found.push(full);
  }
  return found;
}

function extname(p) {
  const i = p.lastIndexOf('.');
  return i === -1 ? '' : p.slice(i).toLowerCase();
}

const args = parseArgs(process.argv.slice(2));
const { file: patternFile, patterns, allow } = loadPatterns();

// Paths the project explicitly tolerates (see llow in the pattern config).
const ALLOWED = new Set(allow.map((a) => a.path.replace(/\\/g, '/')));
const isAllowed = (p) => ALLOWED.has(relative(repoRoot, p).replace(/\\/g, '/'));

if (args.list) {
  console.log(`patterns: ${patternFile}`);
  for (const p of patterns) console.log(`  ${p.name}: /${p.regex}/`);
  process.exit(0);
}

// A placeholder regex must not match everything; treat unfilled ones as inert.
const active = patterns
  .filter((p) => p.regex && !p.regex.startsWith('<'))
  .map((p) => ({ ...p, re: new RegExp(p.regex, 'gi') }));

if (!active.length) {
  console.log(`no active patterns (${patternFile}); copy it to config/forbidden.local.json and fill in your internal names.`);
  process.exit(0);
}

const files = args.dist ? walk(resolve(args.dist)) : trackedFiles();
const hits = [];
let scanned = 0;

for (const f of files) {
  if (SKIP.some((s) => relative(repoRoot, f) === s || relative(repoRoot, f).startsWith(s))) continue;
  if (isAllowed(f)) continue;
  if (!TEXT.has(extname(f))) continue;
  let text;
  try { text = readFileSync(f, 'utf8'); } catch { continue; }
  scanned++;
  const lines = text.split('\n');
  lines.forEach((line, idx) => {
    for (const p of active) {
      p.re.lastIndex = 0;
      if (p.re.test(line)) hits.push({ file: relative(repoRoot, f), line: idx + 1, pattern: p.name, why: p.why, text: line.trim().slice(0, 100) });
    }
  });
}

if (!hits.length) {
  console.log(`clean: ${scanned} files scanned against ${active.length} patterns (${patternFile})`);
  process.exit(0);
}

console.log(`FORBIDDEN CONTENT: ${hits.length} hit(s) in ${scanned} scanned files (${patternFile})\n`);
for (const h of hits) {
  console.log(`${h.file}:${h.line}  [${h.pattern}] ${h.text}`);
  if (h.why) console.log(`    ↳ ${h.why}`);
}
console.log('\nFix before publishing. If a hit is intentional (e.g. this doc), keep that file out of the published tree.');
process.exit(1);
