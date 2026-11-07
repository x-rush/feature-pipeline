#!/usr/bin/env node
// Self-check: are the three core packs (and the two optional ones) installed?
// The unit of a dependency here is a PACK, not a skill: 3, not 24.
//
//   node scripts/check-skills.mjs                  # autodetect the skills dir
//   node scripts/check-skills.mjs --dir <path>     # explicit
//   node scripts/check-skills.mjs --list           # packs and their skill names
//   node scripts/check-skills.mjs --skills         # list every missing skill
//   node scripts/check-skills.mjs --strict         # optional packs must exist too
//
// Exit codes: 0 ok · 1 core incomplete · 2 the pack map below is stale.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const gearsPath = join(repoRoot, 'feature-pipeline', 'gears.json');

// One entry per pack. `required: true` = the core three (+ this repo itself).
const PACKS = [
  {
    id: 'superpowers', required: true, label: 'process: loop, ledger, evidence, finish',
    skills: [
      'brainstorming', 'dispatching-parallel-agents', 'executing-plans',
      'finishing-a-development-branch', 'receiving-code-review',
      'subagent-driven-development', 'systematic-debugging',
      'test-driven-development', 'using-git-worktrees',
      'verification-before-completion', 'writing-plans', 'writing-skills',
    ],
  },
  {
    id: 'mattpocock', required: true, label: 'criteria: seams, two-axis review, deep modules',
    skills: [
      'code-review', 'codebase-design', 'diagnosing-bugs', 'domain-modeling',
      'grill-with-docs', 'pr', 'prototype', 'tdd',
    ],
  },
  {
    id: 'ponytail', required: true, label: 'compression: keep the diff small',
    skills: ['ponytail', 'ponytail-review'],
  },
  {
    id: 'graphify', required: false, label: 'optional: code retrieval, needs graphify index',
    skills: ['graphify'],
  },
  {
    id: 'ui-ux-pro-max-skill', required: false, label: 'optional: only for UI tasks',
    skills: ['ui-ux-pro-max', 'ui-styling'],
  },
  {
    id: 'self', required: true, label: 'this repo',
    skills: ['feature-pipeline', 'coding-skill-arbiter'],
  },
];

const PHASES = ['g1', 'g2', 'g3', 'g4', 'finish'];

// Only agents this project actually documents (docs/HOSTS.md). Adding a name
// here is a promise that its dirs were checked — do not add unverified ones.
const AGENT_DIRS = {
  codex: [join(homedir(), '.codex', 'skills'), resolve('.codex', 'skills')],
  'claude-code': [join(homedir(), '.claude', 'skills'), resolve('.claude', 'skills')],
  opencode: [join(homedir(), '.config', 'opencode', 'skills'), resolve('.opencode', 'skills')],
  cursor: [join(homedir(), '.cursor', 'skills'), resolve('.cursor', 'skills')],
  easycode: [join(homedir(), '.easycode-user', 'skills')],
  generic: [join(homedir(), '.agents', 'skills'), resolve('.agents', 'skills')],
};

const CANDIDATES = [...new Set(Object.values(AGENT_DIRS).flat())];

// The CLI writes project installs to the shared spec location for several
// agents (codex/opencode/cursor), so always consider the shared dirs too.
const SHARED_DIRS = [join(homedir(), '.agents', 'skills'), resolve('.agents', 'skills')];
for (const key of Object.keys(AGENT_DIRS)) {
  for (const dir of SHARED_DIRS) {
    if (!AGENT_DIRS[key].includes(dir)) AGENT_DIRS[key].push(dir);
  }
}

// Any SKILL.md in a subdirectory is enough to call the dir "in use".
function hasAnySkill(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .some((e) => existsSync(join(dir, e.name, 'SKILL.md')));
  } catch {
    return false;
  }
}


function packOf(name) {
  for (const p of PACKS) if (p.skills.includes(name)) return p.id;
  return 'unknown';
}

function dispatchedNames(gears) {
  const names = new Set();
  for (const gear of ['low', 'high', 'max']) {
    const block = gears.skills?.[gear] ?? {};
    for (const phase of PHASES) for (const n of block[phase] ?? []) names.add(n);
  }
  for (const attr of Object.values(gears.conditional ?? {})) {
    for (const phase of ['g1', 'g2', 'g3']) for (const n of attr[phase] ?? []) names.add(n);
  }
  // Referenced outside skills[]: self-evolution, and the two skills in this repo.
  for (const n of ['writing-skills', 'feature-pipeline', 'coding-skill-arbiter']) names.add(n);
  return [...names].sort();
}

function parseArgs(argv) {
  const out = { dir: null, agent: null, list: false, skills: false, strict: false, quiet: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dir' || a === '-d') out.dir = argv[++i];
    else if (a === '--agent' || a === '-a') out.agent = argv[++i];
    else if (a === '--list' || a === '-l') out.list = true;
    else if (a === '--skills' || a === '-s') out.skills = true;
    else if (a === '--strict') out.strict = true;
    else if (a === '--quiet' || a === '-q') out.quiet = true;
    else if (a === '--help' || a === '-h') out.help = true;
    else if (!a.startsWith('-') && !out.dir) out.dir = a;
  }
  return out;
}

function expand(p) {
  if (!p) return p;
  return p.startsWith('~') ? join(homedir(), p.slice(1)) : p;
}

function resolveDir(explicit, agent, names) {
  if (explicit) return { dir: resolve(expand(explicit)), source: '--dir' };
  if (agent) {
    const dirs = AGENT_DIRS[agent];
    if (!dirs) return { dir: null, source: `unknown agent: ${agent}` };
    const hit = dirs.find((d) => existsSync(d));
    return { dir: hit ?? dirs[0], source: `agent:${agent}` };
  }
  const env = process.env.SKILLS_DIR;
  if (env) return { dir: resolve(expand(env)), source: 'env' };
  // Prefer a directory that actually holds skills: an empty dir must not win.
  const withSkills = CANDIDATES.find((d) => existsSync(d) && hasAnySkill(d));
  if (withSkills) return { dir: withSkills, source: 'auto' };
  const existing = CANDIDATES.find((d) => existsSync(d));
  if (existing) return { dir: existing, source: 'auto (empty)' };
  return { dir: CANDIDATES[0], source: 'fallback' };
}

const args = parseArgs(process.argv.slice(2));
if (args.help) {
  console.log(`check-skills — verify the required packs are installed

  node scripts/check-skills.mjs [--agent <name> | --dir <path>] [--list] [--skills] [--strict]

  Packs, not skills: 3 core (+ this repo) and 2 optional.
  --agent, -a <name>  use that agent's skills dir (codex, claude-code, opencode, cursor)
  --dir, -d <path>    explicit skills directory
                      (default: $SKILLS_DIR, else autodetect a dir that already has skills)
  --list, -l          print each pack and the skill names it must provide
  --skills, -s        list every missing skill name (default: only per pack counts)
  --strict            fail when an optional pack is missing too

  documented agents: ${Object.keys(AGENT_DIRS).filter((k) => k !== 'generic').join(', ')}
  (other hosts: pass --dir <their skills dir>; docs/HOSTS.md deliberately covers only these five.)
`);
  process.exit(0);
}

const gears = JSON.parse(readFileSync(gearsPath, 'utf8'));
const names = dispatchedNames(gears);

// Integrity: every dispatched name must belong to a pack in PACKS above.
const unmapped = names.filter((n) => packOf(n) === 'unknown');
const stale = PACKS.flatMap((p) => p.skills).filter((n) => !names.includes(n));
if (unmapped.length) {
  console.error(`PACK map is missing: ${unmapped.join(', ')}`);
  console.error('Update PACKS in scripts/check-skills.mjs to match gears.json.');
  process.exit(2);
}
if (stale.length && !args.quiet) {
  console.error(`note: these names are listed but not dispatched: ${stale.join(', ')}`);
}

if (args.list) {
  for (const p of PACKS) {
    const tag = p.required ? 'core' : 'optional';
    console.log(`${p.id} (${tag}, ${p.skills.length} ${p.skills.length === 1 ? 'skill' : 'skills'}): ${p.skills.join(', ')}`);
  }
  process.exit(0);
}

const { dir, source } = resolveDir(args.dir, args.agent, names);
if (!dir) {
  console.error(`${source}`);
  console.error(`Known agents: ${Object.keys(AGENT_DIRS).join(', ')}`);
  process.exit(1);
}
if (!existsSync(dir)) {
  console.error(`skills dir not found: ${dir} (${source})`);
  console.error('Pass --dir <path>, --agent <name>, or set SKILLS_DIR.');
  process.exit(1);
}

let coreOk = 0, coreTotal = 0, optOk = 0, optTotal = 0;
const missingAll = [];
const rows = [];
for (const p of PACKS) {
  const missing = p.skills.filter((n) => !existsSync(join(dir, n, 'SKILL.md')));
  const ok = p.skills.length - missing.length;
  if (p.required) { coreOk += ok; coreTotal += p.skills.length; }
  else { optOk += ok; optTotal += p.skills.length; }
  missingAll.push(...missing);
  rows.push({ pack: p, ok, missing });
}

if (!args.quiet) {
  console.log(`skills dir: ${dir} (${source})`);
  for (const group of ['core', 'optional']) {
    const isCore = group === 'core';
    console.log(group);
    for (const r of rows.filter((x) => x.pack.required === isCore)) {
      const count = `${r.ok}/${r.pack.skills.length}`.padEnd(7);
      const state = r.missing.length
        ? `missing ${r.missing.length}${r.missing.length <= 3 ? ': ' + r.missing.join(', ') : ' (use --skills)'}`
        : 'ok';
      const note = r.pack.label ? `   (${r.pack.label})` : '';
      console.log(`  ${r.pack.id.padEnd(22)} ${count} ${state}${note}`);
    }
  }
  console.log(`core ${coreOk}/${coreTotal} · optional ${optOk}/${optTotal}`);
  if (args.skills && missingAll.length) console.log(`missing skills (${missingAll.length}): ${missingAll.join(', ')}`);
}

const coreMissing = rows.filter((r) => r.pack.required && r.missing.length).length;
const optMissing = rows.filter((r) => !r.pack.required && r.missing.length).length;
if (coreMissing || (args.strict && optMissing)) {
  if (!args.quiet) {
    console.log('\nInstall the core packs first; a missing pack degrades its stage but never silently:');
    console.log('record `missing:<skill>` in evidence.md and .pipeline.json.missing_skills.');
  }
  process.exit(1);
}
