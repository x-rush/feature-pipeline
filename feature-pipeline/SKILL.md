---
name: feature-pipeline
description: "Run a four-stage pipeline for a large feature: requirement -> design -> coding self-verification -> independent review. File-driven stage tracking, low/high/max gears, per-attribute skill dispatch, merging superpowers (process) with mattpocock (criteria). 当用户说「走完整流程」「来个大需求」「按流水线做」「设计并验收这个功能」时使用。小改动、单点 bug、代码调查不要使用。"
---

# feature-pipeline

**An orchestration skill. It writes no methodology of its own.** Dispatch formula: **skill = gear x stage x attribute**.

**`gears.json` is the single source of truth.** At G0 read `skills`, `conditional`, `plan_fields` and `pipeline` once; dispatch from there. READMEs link to it and never restate the tables — restating is how drift starts.

## Language (important)

This file is English to save tokens. **Speak to the user, and write every artifact, in the user's language** (Chinese by default): `spec.md`, `plan.md`, `evidence.md`, `review*.md`, `blocker-*.md`, the Decision Card and the `Next` block. They are what the user reads and signs off on; an English artifact is an unreadable artifact. Code, identifiers and commit messages keep repo conventions.

## Four layers of ownership

| Layer | Pack | Owns |
|---|---|---|
| Process and discipline | superpowers | how to move: loop, ledger, evidence, finish |
| **Criteria and vocabulary** | **mattpocock** | **what good means**: seams, anti-patterns, two-axis review, deep modules, glossary |
| Compression | ponytail | how to do less |
| Retrieval | graphify | where things are |

**Key fact:** `tdd` (mattpocock, 38 lines) and `test-driven-development` (superpowers, 330 lines) are **not duplicates — they are criteria vs process**. Layer them; never pick one over the other.

## Four arbitration rules (override any skill's own description)

1. **Tests**: the loop follows `test-driven-development`; the criteria follow `tdd`. **Refactoring follows `tdd` — it belongs to review, not the loop** (direct conflict between packs; this is the adjudication).
2. **Review**: PASS/FAIL comes from `code-review` (Standards + Spec axes). `ponytail-review` may only add minimalism findings and **must not change the AC verdict**.
3. **Debugging**: first three rounds `systematic-debugging`; on BLOCKED escalate to `diagnosing-bugs`.
4. **Never dispatch**: `ask-matt`, `using-superpowers`, `to-tickets`/`triage`/`wayfinder`/`implement`/`implement-spec`.

## Missing skills
If a dispatched skill is not installed, **apply its criteria by hand**, record `missing:<skill>` in `evidence.md` and `.pipeline.json.missing_skills`, and tell the user once. A gate never passes on a missing skill's behalf.

## G0 — pick the gear, record the attributes

**Priority: an explicit user choice > a user constraint > automatic judgement.** Aliases in `gear_aliases`.

**User-chosen gear** is adopted as-is; never override it with the table below. Single exception — **warn once when it is below the risk**: if the chosen gear is lower than the judgement and any `max_triggers` condition holds, say: "This hits the irreversible list (<which one>); I'd suggest max — still run <gear>?" If they insist, comply and write `risk_ack`.

**No explicit gear** — first match wins:

| (1) migration / deletion / auth / payment / concurrency / cross-service | **max** |
| (2) public interface change, or target module untested, or 4-5 files, or >=4 files spanning >=2 modules | **high** |
| (3) >= 6 files, fully revertible, one module | **low** |
| (4) none of the above | **exit** |

**Reversibility beats size.** Six files that revert cleanly inside one module are low *because* they are reversible; four files crossing modules or sitting on untested code are high.

**State file.** Create `features/<slug>/` (add `features/` to the *target* repo's `.gitignore`; un-ignore one feature dir if you want its artifacts in the PR) and copy `templates/pipeline.json`. The state file is authoritative for `stage`/`verdict`; artifacts are evidence; on conflict trust the file and set `state_mismatch: true`. Record the files already dirty at G0 in `dirty_files` — anti-drift rule 4 depends on that list.

**Run `node ${SKILL_DIR}/scripts/preflight.mjs` first** and copy `commands`, `base_ref`, `dirty_files` and `tests.dirs` (as `test_paths`) out of its JSON into the state file. Later gates cite those three: without a recorded test command G3 has no evidence to paste, and without `base_ref` G4 has nothing to diff. If no test command is detected, set `degraded_verification: true` — each AC then verifies with a recorded command plus its pasted output; manual is allowed, unrecorded is not.

**Model IDs come from the host, not from this file.** `gears.json` `roles` says what each stage needs (strong reasoning / cheap flat-rate / different family); at G0 read the first existing path in `host_config` (local override first, then the tracked example), take that file's `active` host entry. `${SKILL_DIR}` is the directory holding this SKILL.md — resolve it before testing the paths, so a `cp -R` install and an in-repo checkout both work, and write the resolved ids into `models`. If the host has no second model, say so now, not at G4.

**Attributes are add-only and may be added at any gate**: G0 sets the initial set; `hard_bug` appears only at G3, `rework` only after a G4 FAIL. Definitions in `gears.json` `attributes`.

**Gears only go up mid-flight**: upgrading adds the missing fields and tests but never re-runs a passed gate — except an upgrade to max, which re-runs G2 with the max design model. Downgrading re-runs G0 with `gear_source:"downgrade"` — a re-baseline, not a mid-flight downgrade.

## Three mechanisms used at every gate

**1. Exit check by citation, not by checkmark.** Every item must name a location, never claim "done":

```
Exit check
- AC count = 5, see spec.md §Acceptance (AC1-AC5)
- Non-goals = 2, see spec.md §Non-goals
- Open questions = 0, see spec.md §Open questions
- Seam = tests/order.test.ts createOrder(), see plan.md §Seam
```

**No location, no completion.** A citation is checkable in 30 seconds; a claim is not.

**2. `Next` block, four parts.** Any reply that stops on a gate boundary ends with: **artifact / next stage / model / opening line**.

**3. Templates are the criteria.** Open the template for the stage and fill it in. Missing fields mean the gate is not passed. Never write the format from memory.

## Stage tracking
Read the disk at the start — never rely on memory:

- `.pipeline.json` exists -> take `stage` and `verdict` from it, then verify the matching artifact exists; if it does not, re-derive and set `state_mismatch: true`.
- No `.pipeline.json` -> G0; no `spec.md`, or `spec_approved` false -> G1; no `plan.md` -> G2; no `evidence.md` **or any AC row without a verdict** -> G3; no review file -> G4; latest review FAIL -> G3 with `rework`; latest review PASS -> write `retro.md`, then done (no `retro.md`, not done).

**A FAIL returns to G3, never to G4.** The rule reads the *latest* review file only, and `verdict` in the state file outranks it either way. Reviews are never overwritten: `review.md` = round 1, `review-r2.md` = round 2 (max), `review-r3.md` after a second rework. **After every rework G4 runs one verification round** — it does not consume `review_rounds`, it is what turns a FAIL into a PASS — and a third rework escalates to G1 instead of a fourth round. "Has a verdict" means every AC row in `evidence.md` is PASS/FAIL/UNVERIFIED — an empty cell is unchecked, and UNVERIFIED never counts as PASS.

## G1 — requirements

**Template** `templates/spec.md`. **Criteria**: 3-7 ACs, each with an executable verification command (no "works": cite `commands.test` or a recorded command plus the expected output); non-goals non-empty; open questions cleared or assigned; with `terminology`, a glossary is mandatory (definition + banned synonyms).

**Stop: the user approves the ACs** before G2 — set `spec_approved: true` only on their word; low gear stops here too. **Next**: `spec.md` / G2 (same session) / model unchanged / opening line "draft plan.md from spec.md" (low gear's `merge_g1g2` keeps G1 and G2 in one session; the approval stop still sits between them).

## G2 — design

**Template** `templates/plan-<gear>.md`; fields per `plan_fields`, **`seams` mandatory**.

**Criteria**: every change traces to an `ACn`; **test seam chosen first — one layer, ideally one seam** (`codebase-design` supplies the deep-module / interface / seam vocabulary); every task has a test; no unapproved dependency; **no** "could consider", "maybe", "similar to before"; no task depends on an open question in spec.md; **re-check the gear against the plan's file list** with the G0 table and upgrade if it now says higher.

**Four-question self-check** (answer without writing code): which files / which method / which test proves it / **is there anything a human must decide**. The fourth answer must be "no".

**Next**: `plan.md` / G3 / switch to `models.code` (a flat-rate coding model may stay in this session) / opening line "read spec.md and plan.md, implement per plan".

## G3 — coding and self-verification

**Template** `templates/evidence.md`. Use the `progress.md` ledger and per-task commits that `executing-plans` defines; if that skill is missing, keep a three-column task ledger inside `evidence.md` instead of inventing a turn counter.

**Criteria**: paste the full test output (failures + exit code); every AC marked PASS/FAIL/UNVERIFIED; `git diff --numstat <base_ref> -- <test_paths>` shows zero deletions outside plan.md §既有测试变更 (new test files are additions, which are allowed); no `TODO` / `not implemented` / debug logging; no tests added outside the agreed seam.

**Five anti-drift rules**: (1) one commit per task; (2) open each turn with `current T3 (3/8)`; (3) every 5 turns print `plan 3/8, AC 2/5`; (4) touched a file outside the plan -> restore it **only when that file was clean at G0** (`git restore <file>`); if it was already dirty at G0, stop and ask — never destroy unrecorded work; (5) tests shrunk or assertions edited -> automatic fail.

**Next**: `evidence.md` / G4 (**must be a fresh session**) / switch to `models.review` / opening line "review features/<slug>/: run `git diff <base_ref>...HEAD`, judge each AC in spec.md".

## BLOCKED (3 red rounds; 1 in max)

A red round is one test run on the same task that does not lower the failure count; count it in `rounds.red` and reset it on a new task. **Write `templates/blocker.md` first, then decide where to go** — otherwise "stuck" becomes the standard excuse. It must contain actual-vs-expected behaviour; if it cannot, the code was never debugged and no rollback is allowed.

| plan gap / plan wrong | back to **G2** | AC itself wrong | back to **G1** | implementation or environment | **stay in G3**, set `hard_bug` and escalate to `diagnosing-bugs` |

Send only `spec.md` + `plan.md` + `blocker-n.md`, never the whole failed transcript. Every fix must append a **revision note** to `plan.md`, or the same hole reopens.

## G4 — independent review

**Template** `templates/review.md`. **Fresh session and cross-model** (coding sessions run 200k+ tokens; a cheap reviewer costs 5x more there than in a fresh one).

**Three axes, reported side by side, never merged**: (1) Spec — against the ACs in `spec.md`; (2) Standards — repo conventions; (3) minimalism — `ponytail-review`, advisory only, **it may not change axis 1**.

`code-review` runs axes 1-2, one subagent each. **Adversarial first**: do not ask "does this look wrong" but *construct a counterexample for each AC*; only when none succeeds may it pass.

**Give**: `git diff <base_ref>...HEAD` + spec (high adds plan + blockers; max adds failure history + blast radius). **Withhold**: the coding session's conversation and justifications. `evidence.md` is a map, not proof: re-run `commands.test` and every AC command yourself.

**Verdict**: any axis FAIL -> overall FAIL; return to G3 with `rework` (root cause in the spec -> G1). **A zero-finding PASS is valid** when every AC lists the counterexample attempt and the command behind it — an unexplained "no findings" invalidates the review, not the absence of findings. max runs two rounds; round 2 hunts counterexamples only.

**One-model hosts**: run G4 in a fresh session with a different prompt, write `review_degraded: true` in the state file and `review.md`, and tell the user — a recorded degradation, never a silent PASS of baseline 3.

**Next**: verdict / PASS -> `finishing-a-development-branch` + `pr` (low: summarise the diff and stop — commit and PR are the user's call); FAIL -> G3 with the fix list keyed by AC number.

## Three baselines (no gear, no attribute, no exception)

1. **Test files are read-only**: never edit assertions, delete cases, or relax mocks. Sole exception: a test listed in plan.md §既有测试变更, approved at G2.
2. **No freshly run command, no claim of "done".**
3. **Review must be cross-model**: never review your own output in the same model. The only sanctioned escape is the recorded `review_degraded` path in G4.

## Anti-drift and self-evolution

`ACn` is the single source of truth; an idea that maps to no AC goes to non-goals or `backlog.md`. End each task with a four-line `retro.md` recording **what the plan lacked**: propose a template change only after the **third occurrence**; replay against 3 historical `features/` and **reject any change that loosens a past verdict**; `SKILL.md` <= 150 lines; **a human must approve any rule change**. Priority: template fields > thresholds > prose rules.
