#!/usr/bin/env node
// Lint the skill repo itself. This is the third gate next to check-skills
// (dependencies) and check-public-safe (no internal data).
//
//   node scripts/check-repo.mjs
//   node scripts/check-repo.mjs --quiet
//
// Checks: line budget, required templates, templates referenced by SKILL.md,
// state schema vs template, prose numbers vs gears constants, required keys,
// and relative doc links. Exit 1 on any error.

import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const quiet = process.argv.includes('--quiet');

const errors = [];
const notes = [];
const fail = (m) => errors.push(m);
const note = (m) => notes.push(m);

const skillPath = join(root, 'feature-pipeline', 'SKILL.md');
const gearsPath = join(root, 'feature-pipeline', 'gears.json');
const templatesDir = join(root, 'feature-pipeline', 'templates');

const gears = JSON.parse(readFileSync(gearsPath, 'utf8'));
const skill = readFileSync(skillPath, 'utf8');
const skillLines = skill.replace(/\n$/, '').split('\n').length;

// 1. line budget
const maxLines = gears.constants?.skill_max_lines ?? 150;
if (skillLines > maxLines) fail(`SKILL.md is ${skillLines} lines, over the ${maxLines}-line budget`);

// 2. required templates
const required = ['spec.md', 'plan-low.md', 'plan-high.md', 'plan-max.md', 'evidence.md', 'review.md', 'blocker.md', 'retro.md', 'pipeline.json', 'backlog.md'];
for (const t of required) {
  if (!existsSync(join(templatesDir, t))) fail(`missing template: templates/${t}`);
}

// 3. every template SKILL.md points at must exist
//    (templates/plan-<gear>.md is a pattern, so allow the angle-bracket tail)
const refs = [...skill.matchAll(/templates\/([A-Za-z0-9._-]+)(<[^>]*>)?(?:\.(?:md|json))?/g)]
  .filter((m) => !m[2])          // skip the <gear> pattern form
  .map((m) => `${m[1]}${m[3] ?? ''}`)
  .filter((r) => r.endsWith('.md') || r.endsWith('.json'));
for (const r of new Set(refs)) {
  if (!existsSync(join(templatesDir, r))) fail(`SKILL.md references templates/${r}, which does not exist`);
}

// 3a. the spec template must ask where an AC came from. A run once invented
// requirements at G1 (a self-built POI store, a 5000-row cap, tiered number
// checks) and then built against them.
{
  const specTpl = join(templatesDir, 'spec.md');
  if (existsSync(specTpl) && !readFileSync(specTpl, 'utf8').includes('来源（需求')) {
    fail('templates/spec.md has no AC 来源 column (every AC must trace to the requirement text or a user decision)');
  }
}

// 3b. every plan template carries the §待用户裁决 table. The pipeline kept
// interrupting the user after the design was finished; this table is the one
// place a human decision may be raised, asked once at G2.
for (const g of ['low', 'high', 'max']) {
  const f = join(templatesDir, `plan-${g}.md`);
  if (existsSync(f) && !readFileSync(f, 'utf8').includes('## 待用户裁决')) {
    fail(`templates/plan-${g}.md has no "## 待用户裁决" section (the one place a human decision may be raised)`);
  }
  if (!(gears[g]?.plan_fields ?? []).includes('decisions')) {
    fail(`gears.json ${g}.plan_fields is missing "decisions"`);
  }
}

// 4. state schema listed in gears must match the state template
const tplPath = join(templatesDir, 'pipeline.json');
if (existsSync(tplPath)) {
  const tpl = JSON.parse(readFileSync(tplPath, 'utf8'));
  for (const key of gears.pipeline?.state_schema ?? []) {
    if (!(key in tpl)) fail(`pipeline.json template lacks state field "${key}"`);
  }
  for (const key of Object.keys(tpl)) {
    if (!key.startsWith('_') && !(gears.pipeline?.state_schema ?? []).includes(key)) {
      fail(`pipeline.json template has "${key}", absent from gears.pipeline.state_schema`);
    }
  }
}

// 5. numbers restated in prose must match gears constants
const acMin = gears.constants?.ac_min;
const acMax = gears.constants?.ac_max;
const acLine = skill.match(/(\d+)-(\d+) ACs/);
if (acLine) {
  if (Number(acLine[1]) !== acMin || Number(acLine[2]) !== acMax) {
    fail(`SKILL.md says ${acLine[1]}-${acLine[2]} ACs but gears constants say ${acMin}-${acMax}`);
  }
} else note('SKILL.md no longer states the AC range in prose');

const progressLine = skill.match(/every (\d+) turns/);
if (progressLine && Number(progressLine[1]) !== gears.constants?.progress_every_turns) {
  fail(`SKILL.md says every ${progressLine[1]} turns, gears says ${gears.constants?.progress_every_turns}`);
}

const budgetLine = skill.match(/<= (\d+) lines/);
if (budgetLine && Number(budgetLine[1]) !== maxLines) {
  fail(`SKILL.md says <= ${budgetLine[1]} lines, gears says ${maxLines}`);
}

const redLine = skill.match(/\((\d+) red rounds; (\d+) in max\)/);
if (redLine) {
  const soft = Number(redLine[1]);
  const hard = Number(redLine[2]);
  for (const gear of ['low', 'high']) {
    if (gears[gear]?.blocker_threshold !== soft) fail(`SKILL.md says ${soft} red rounds but ${gear}.blocker_threshold is ${gears[gear]?.blocker_threshold}`);
  }
  if (gears.max?.blocker_threshold !== hard) fail(`SKILL.md says ${hard} red rounds in max but max.blocker_threshold is ${gears.max?.blocker_threshold}`);
} else note('SKILL.md no longer states the blocked threshold in prose');

// 5d. every gate must end with a Next block. G0 silently lacked one, so the
// gear was picked, the model was only *recommended*, and the next stage opened
// on whatever model happened to be active.
const gateChunks = skill.split(/^## (G\d)[^\n]*$/m).slice(1);
const gates = [];
for (let i = 0; i < gateChunks.length; i += 2) gates.push({ id: gateChunks[i], body: gateChunks[i + 1] ?? '' });
if (gates.length < 4) {
  fail(`SKILL.md has only ${gates.length} "## G<n>" gate sections; expected at least 4`);
}
for (const { id, body } of gates) {
  if (!/\*\*Next\*\*/.test(body)) fail(`gate ${id} has no **Next** block (artifact / next stage / model / opening line)`);
}

// 6. keys other scripts rely on
const requiredKeys = ['entry', 'gear_aliases', 'override_policy', 'pipeline', 'roles', 'attributes', 'skills', 'conditional', 'dispatch_rules', 'constants', 'host_config'];
for (const k of requiredKeys) {
  if (!(k in gears)) fail(`gears.json lacks required key "${k}"`);
}
if (!gears.roles?.design || !gears.roles?.code || !gears.roles?.review) {
  fail('gears.roles must define design / code / review');
}

// 6b. host config must resolve on a fresh clone: the last entry is the tracked
//     default, every other entry is an optional (git-ignored) override.
const entries = Array.isArray(gears.host_config) ? gears.host_config : [gears.host_config];
if (!Array.isArray(gears.host_config) || entries.length !== 2) {
  fail('gears.host_config should be [optional local override, tracked default]');
}
const trackedDefault = entries[entries.length - 1];
const override = entries[0];
if (!override.includes('.local.')) note(`host_config override ${override} is not a *.local.json path`);

// ${SKILL_DIR} is the directory holding feature-pipeline/SKILL.md, so the config
// travels with the skill instead of depending on the caller's cwd.
const resolveSkill = (p) => resolve(root, p.replace(/^\$\{SKILL_DIR\}/, 'feature-pipeline'));
const defaultValue = resolveSkill(trackedDefault);
if (!existsSync(defaultValue)) {
  fail(`host_config default ${trackedDefault} is missing — a fresh clone would have no config`);
} else {
  const cfg = JSON.parse(readFileSync(defaultValue, 'utf8'));
  const active = cfg.active;
  if (!active) fail(`${trackedDefault} has no "active" host`);
  else {
    const host = cfg.hosts?.[active];
    if (!host) fail(`${trackedDefault} active host "${active}" is not in hosts`);
    else {
      for (const role of ['design', 'code', 'review']) {
        if (!host.models?.[role]) fail(`${trackedDefault} host "${active}" lacks models.${role}`);
      }
      if (!host.invocation || !Object.keys(host.invocation).length) {
        fail(`${trackedDefault} host "${active}" lacks invocation`);
      }
    }
    for (const key of entries) {
      const p = resolve(root, key);
      if (!existsSync(p)) continue;
      const cfg2 = JSON.parse(readFileSync(p, 'utf8'));
      if (cfg2.active && !cfg2.hosts?.[cfg2.active]) fail(`${key} active host "${cfg2.active}" is not in hosts`);
    }
  }
  // the default must be committed, otherwise clones do not get it
  try {
    execFileSync('git', ['ls-files', '--error-unmatch', relative(root, defaultValue)], { cwd: root, stdio: 'ignore' });
  } catch {
    fail(`${trackedDefault} exists but is not tracked by git — a clone would not get it`);
  }
}

// 7. relative markdown links resolve
const mdFiles = [
  join(root, 'README.md'),
  join(root, 'feature-pipeline', 'README.md'),
  join(root, 'coding-skill-arbiter', 'SKILL.md'),
  join(root, 'coding-skill-arbiter', 'tables.md'),
  join(root, 'docs', 'HOSTS.md'),
  join(root, 'docs', 'RELEASING.md'),
].filter(existsSync);

const RUNTIME = /\b(spec|plan|evidence|review|progress|backlog|retro)(-r\d+)?\.md$|\.pipeline\.json$/;
// Paths that legitimately never live in this repo: agent skill dirs (~ / .cursor …),
// git-ignored local config, and shell/env placeholders.
const notRepoPath = (t) =>
  t.startsWith('~') || t.startsWith('$') || t.startsWith('.') ||
  t.includes('.local.json') || t.includes('<') || t.includes('*');

for (const f of mdFiles) {
  const text = readFileSync(f, 'utf8');
  for (const m of text.matchAll(/\]\(([^)]+)\)/g)) {
    const target = m[1].trim();
    if (/^https?:/.test(target) || target.startsWith('#') || target.includes('<')) continue;
    const clean = target.split('#')[0];
    const abs = resolve(dirname(f), clean);
    if (!existsSync(abs)) fail(`${relative(root, f)} links to missing path: ${clean}`);
  }
  for (const m of text.matchAll(/`([^`\s]+\.(?:md|json|mjs))`/g)) {
    const token = m[1];
    if (notRepoPath(token)) continue;
    if (RUNTIME.test(token)) continue; // created inside features/<slug>/ at runtime
    const abs = resolve(dirname(f), token);
    const viaRoot = resolve(root, token);
    if (!existsSync(abs) && !existsSync(viaRoot)) fail(`${relative(root, f)} mentions missing file: ${token}`);
  }
}

// report
if (!quiet) {
  for (const n of notes) console.log(`note: ${n}`);
}
if (errors.length) {
  console.log(`\nFAIL: ${errors.length} issue(s)`);
  for (const e of errors) console.log(`  ✗ ${e}`);
  process.exit(1);
}
console.log(`ok: SKILL.md ${skillLines}/${maxLines} lines · ${required.length} templates · schema, constants and links consistent`);
