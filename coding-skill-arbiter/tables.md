# Routing reference (read on demand)

> Read only the section you need, only when L2/L3 requires it. Anything read stays in history and is re-sent every turn.
>
> **Definitions live in `../feature-pipeline/gears.json`** (`attributes`, `conditional`, `skills`, gear params). This file maps *signals* to *attribute names*; it never restates a definition, a gear param, a model ID or a credit estimate.

## L2 signal table

| Signal (how to check) | Attribute | Then |
|---|---|---|
| Diff touches `.tsx` / `.vue` / `components/` / `.css` | `ui` | add `ui-ux-pro-max`; AC must include "page reaches X" |
| `git diff --stat` >= 4 files, or touches public exports | `cross_module` | run `graphify` for callers first |
| Target directory has no test files | `no_tests` | use `test-driven-development`; first plan task is "add tests" |
| Stack trace present and >= 3 hypotheses already tried | `hard_bug` | escalate to `diagnosing-bugs` |
| Money / permissions / time boundaries / mixed synonyms | `terminology` | add `domain-modeling`, define terms first |
| The approach itself is uncertain (not just the code) | `spike` | add `prototype`, build a throwaway first |

**Signals must come from command output or file facts.** "I feel this is a UI task" is not a signal: a wrong pick only wastes context, so under-detect rather than guess.

The attribute **name** above is canonical; what each one *means* is `attributes` in `../feature-pipeline/gears.json`. Do not paraphrase a definition here — that is how `cross_module` and `no_tests` drifted apart in an earlier version.

## L3 default ownership

| Node | Default | The other pack's role |
|---|---|---|
| Test **loop** | `test-driven-development` | — |
| Are tests **worth keeping** | `tdd` | supplies the criteria |
| Where **refactoring** goes | `tdd` | belongs to review, **not** the loop (packs conflict; mattpocock wins) |
| **PASS/FAIL** verdict | `code-review` | two axes: Standards + Spec |
| Is it **over-engineered** | `ponytail-review` | advisory only, **cannot change the AC verdict** |
| Debugging, first 3 rounds | `systematic-debugging` | — |
| Still stuck | `diagnosing-bugs` | hard-to-reproduce and perf regressions |
| Plan / ledger / finish | `writing-plans`, `executing-plans`, `finishing-a-development-branch` | — |
| Keeping the diff small | `ponytail` (max `full`, **no `ultra`**) | — |

**One skill per node.** Attribute-driven additions (`../feature-pipeline/gears.json` `conditional`) may add one more; do not load a second "for another perspective" — that doubles context, not certainty.

## Never load proactively

`ask-matt` (router), `wizard` (infra wizard), `to-tickets` / `triage` / `wayfinder` / `implement` / `implement-spec` (issue-tracker bound). If their descriptions fire, do not run their flow.

Note: superpowers' `diagnosing-superpowers` debugs **superpowers itself**, not your code. Code debugging is `diagnosing-bugs` (mattpocock).

## When two packs are already loaded

**Do not re-run the other flow; take the verdict from the ownership table.** Example: `test-driven-development` wants a refactor, `tdd` says refactoring is not part of the loop -> follow the latter, record the refactor as a review item, keep looping.

## Gears and cost

Not repeated here. Read `entry`, `low`, `high`, `max`, `est_note` and `model_note` in `../feature-pipeline/gears.json`, which is the single source of truth; a table copied into a reference file is a table that will drift.
