---
name: coding-skill-arbiter
description: "Pick exactly one skill bundle for a coding task (or none), using disk facts and observable signals first, defaults second, and asking only when the change is irreversible. Prints a Decision Card, arbitrates conflicts between the superpowers / mattpocock / ponytail packs, and decides when to escalate to feature-pipeline. 用于改代码、评审、排障、写测试、查代码（「走完整流程」除外，那是 feature-pipeline）。"
---

# coding-skill-arbiter

**Job: pick exactly one skill bundle for the current task — or decide that no skill is needed — then print a Decision Card.**

With three packs installed, one sentence can hit two skills. Routing is resolved in four layers: **observe when you can, default when you cannot, ask only when the change is irreversible.**

> Reference tables live in `tables.md`. Read only the section you need, only when L2/L3 calls for it.

## Language (important)

This file is written in English to save tokens. **Always speak to the user, and write every artifact, in the user's language** (Chinese by default). The Decision Card labels, the `Next` block and all documents must be in their language — they have to be able to read and verify them. Never hand over an English document to a Chinese-speaking user.

## Four-layer routing

| Layer | Basis | Cost |
|---|---|---|
| **L0 explicit** | user names a skill or a gear | 0 |
| **L1 disk facts** | `features/*/.pipeline.json` exists -> already in the pipeline; hand over and **exit this skill** | 0 |
| **L2 observable signals** | <= 3 commands -> task attributes | low |
| **L3 defaults** | ownership table | 0 |
| **L4 ask** | only if irreversible and the user has not said which way, or the two packs give opposite verdicts | one turn |

**An L0 hit skips L2 entirely.** The user's choice outranks every row in this file.

## Output: the Decision Card (fixed shape, <= 5 lines)

Print the card **before doing any work**:

```
Task:   <one-line reading of the request>
Gear:   <none | low | high | max>    Cost: <low | medium | high | n/a>
Skills: <1-2 names> (optional: <one more>)
First:  <the first concrete action>
Risk:   <none | one line>
```

That card is the value: it compresses *what to use, what it costs, where to start* into one screen, so the user can say "no, change X" immediately instead of discovering a wrong direction three turns later.

If the task is already in the pipeline, the card becomes `Stage / Skills / Next / Model`, read from `.pipeline.json` plus the latest artifacts. **The state file is the only handoff** — do not invent a second note file.

## Fast lane (small task, 3 steps)

If it is a single file, under ~30 lines, and either covered by tests or pure copy/config — **load no skill at all**:

1. Make the change.
2. Run the verification command and paste its output.
3. One sentence: what changed, what was verified.

**Do not add process to the fast lane.** Anything loaded stays in history and is re-sent every turn; routing must not become the cost.

## Switches the user can say

| User says | Effect |
|---|---|
| "省钱" / "cheapest" / "fastest" | drop to low; avoid the pipeline if possible |
| "稳一点" / "be careful" | go high; if irreversible, go straight to max |
| "加一轮评审" / "one more review" | review rounds +1, nothing else changes |
| "只看不写" / "read-only" | plan and findings only, touch no files |
| "别加载技能" / "no skills" | L0 takes over; work manually |

## L4: ask only two things, always with a default

1. **Irreversible and the user has not chosen** (migration / deletion / auth / payment / concurrency): "Defaulting to max (strongest design model, two review rounds) — say the word if you don't want that."
2. **Both packs loaded and verdicts conflict**: "Following the mattpocock criterion (refactoring moves out of the loop) — acceptable?"

Nothing else. **Routing must not turn into a conversation** — asking at every step is slower than not using the skill at all.

## When to escalate to feature-pipeline

Any one of: a `max_triggers` condition (migration / deletion / auth / payment / concurrency / cross-service); public interface change; target module untested; >= 4 files; the user asks for the full flow.

**Turn count is not a trigger.** "More than 25 turns" used to be listed here, and it bounced: the arbiter sent a 30-turn single-file task to the pipeline, whose G0 then answered "small change, normal flow". G0 decides the gear; the arbiter only decides whether to hand over.

**Otherwise do not load it.** The pipeline's value is cross-stage constraint; on a small task it is only weight.

## One-model hosts

If the host catalog has only one model, the three-gear design cannot be honoured: put `review: degraded` in the `Risk` line and say so before G4 rather than claiming a cross-model review.

## Cost discipline

- Load one skill per node. Attribute-driven additions from `../feature-pipeline/gears.json` `conditional` are the only exception, and they add at most one.
- `ponytail-audit` / `ponytail-debt` / `ponytail-gain` are one-shot reports; run once and stop.
- Never reload a skill that is already in context.
