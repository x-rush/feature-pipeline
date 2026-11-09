#!/usr/bin/env node
// Deterministic G0 facts for feature-pipeline.
//
//   node scripts/preflight.mjs            # run inside the target repo
//   node scripts/preflight.mjs --pretty   # human-readable summary
//
// Prints one JSON object on stdout: the commands later gates cite, the git base
// ref the review diffs against, and the files already dirty at G0.
// Exit 0 with data, 2 when not inside a git work tree.

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

const pretty = process.argv.includes('--pretty');
const cwd = process.cwd();

const git = (args, fallback = null) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return fallback;
  }
};

if (git(['rev-parse', '--is-inside-work-tree']) !== 'true') {
  console.error('preflight: not inside a git work tree');
  process.exit(2);
}

const pm = existsSync(join(cwd, 'pnpm-lock.yaml')) ? 'pnpm'
  : existsSync(join(cwd, 'yarn.lock')) ? 'yarn'
    : 'npm';

const commands = { test: null, lint: null, build: null };
let source = 'none';

if (existsSync(join(cwd, 'package.json'))) {
  try {
    const scripts = JSON.parse(readFileSync(join(cwd, 'package.json'), 'utf8')).scripts ?? {};
    const run = (name) => (pm === 'npm' ? `npm run ${name}` : `${pm} ${name}`);
    if (scripts.test) commands.test = pm === 'npm' ? 'npm test' : `${pm} test`;
    if (scripts.lint) commands.lint = run('lint');
    else if (scripts.typecheck) commands.lint = run('typecheck');
    if (scripts.build) commands.build = run('build');
    if (commands.test || commands.lint || commands.build) source = 'package.json';
  } catch {
    // a malformed package.json is a finding, not a crash
  }
}

const probes = [
  ['pyproject.toml', { test: 'pytest', lint: 'ruff check .' }],
  ['go.mod', { test: 'go test ./...', lint: 'go vet ./...', build: 'go build ./...' }],
  ['Cargo.toml', { test: 'cargo test', lint: 'cargo clippy -- -D warnings', build: 'cargo build' }],
  ['composer.json', { test: 'composer test', lint: 'composer lint' }],
];

if (!commands.test) {
  for (const [file, found] of probes) {
    if (!existsSync(join(cwd, file))) continue;
    for (const key of Object.keys(commands)) if (!commands[key] && found[key]) commands[key] = found[key];
    source = file;
    break;
  }
}

if (!commands.test && existsSync(join(cwd, 'Makefile'))) {
  if (/^test:/m.test(readFileSync(join(cwd, 'Makefile'), 'utf8'))) {
    commands.test = 'make test';
    source = 'Makefile';
  }
}

const testDirs = ['test', 'tests', '__tests__', 'spec', 'src/test'].filter((d) => existsSync(join(cwd, d)));

const status = git(['status', '--porcelain'], '') ?? '';
const dirty = status.split('\n').filter(Boolean).map((l) => l.slice(3).trim()).filter(Boolean);

const candidates = ['origin/main', 'origin/master', 'main', 'master'];
const branchBase = candidates.find((c) => git(['rev-parse', '--verify', '--quiet', c]));
const head = git(['rev-parse', 'HEAD'], null);
let baseRef = head;
let baseFrom = 'HEAD';
if (branchBase) {
  const mb = git(['merge-base', 'HEAD', branchBase], null);
  if (mb) {
    baseRef = mb;
    baseFrom = branchBase;
  }
}
const changed = baseRef ? (git(['diff', '--name-only', baseRef], '') ?? '').split('\n').filter(Boolean) : [];

const warnings = [];
if (!commands.test) warnings.push('no test command detected: set degraded_verification and verify each AC with a recorded command plus pasted output');
if (!commands.lint) warnings.push('no lint/typecheck command detected');
if (!dirty.length) warnings.push('no files dirty at G0: anti-drift rule 4 may restore out-of-plan files');

const out = {
  repo: {
    root: resolve(cwd),
    branch: git(['rev-parse', '--abbrev-ref', 'HEAD'], null),
    base_ref: baseRef,
    base_from: baseFrom,
    dirty_files: dirty,
    changed_vs_base: changed,
  },
  commands: { ...commands, source },
  tests: { found: testDirs.length > 0, dirs: testDirs, command_known: Boolean(commands.test) },
  warnings,
};

if (pretty) {
  const line = (k, v) => console.log(`${k.padEnd(10)} ${v ?? '-'}`);
  line('branch', out.repo.branch);
  line('base_ref', `${out.repo.base_ref} (from ${out.repo.base_from})`);
  line('dirty', out.repo.dirty_files.length);
  line('test', commands.test);
  line('lint', commands.lint);
  line('build', commands.build);
  for (const w of warnings) console.log(`warning    ${w}`);
} else {
  console.log(JSON.stringify(out, null, 2));
}
