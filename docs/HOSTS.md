# 适配单：5 个热门 agent

每个结论都带出处，并按证据等级打标：**✅ 实测**（本机真跑过） · **📄 官方**（官方文档原文） · **📦 产品自身**（该产品没有公开文档，依据是它自己的目录约定与仓库记录） · **⚠️ 第三方**（非官方整理）。

## 0. 结论表

| agent | 技能目录 | CLI 落点（实测） | 换模型机制 |
|---|---|---|---|
| **Easy Code** | `~/.easycode-user/skills/`（用户级，📦 产品约定） | 未实测（本机无此目录） | 📦 宿主 UI 内切模型；**无切换 API**，阶段切换=手动切或换会话 |
| **Codex** | `$CWD/.agents/skills`、`$CWD/../.agents/skills`、`$REPO_ROOT/.agents/skills`、`~/.agents/skills`、`/etc/codex/skills` | `.agents/skills/` ✅ | 📄 profile 独立文件 + `--profile`；📄 `[agents.<name>].config_file`；📄 `review_model` |
| **Claude Code** | `~/.claude/skills/`、`.claude/skills/`（团队/插件同级） | `.claude/skills/` ✅ | 📄 子代理 frontmatter `model`；或 `--model` 换会话 |
| **opencode** | `.opencode/skills`、`~/.config/opencode/skills`，**兼容** `.agents/skills`、`.claude/skills` 及其 user 级 | `.agents/skills/` ✅ | 📄 `agents.<id>.model`（`provider/model#variant`） |
| **Cursor** | `.cursor/skills`、`.agents/skills`、`~/.cursor/skills`、`~/.agents/skills`，**兼容** `.claude`、`.codex` | `.agents/skills/` ✅ | 📄 模型选择器，**可在对话中途切换** |

**共同铁律**：design 与 code 不同模型；review 与 code 不同且更强。型号在 `feature-pipeline/config/host.example.json`（已跟踪、开箱可用）；本机差异写 `feature-pipeline/config/host.local.json`（未跟踪），G0 优先读它、没有就回退到 example。

出处：[Codex skills](https://developers.openai.com/codex/skills)、[Codex config reference（官方文档镜像）](https://github.com/crasuna/openai-dev-docs-cn-mirror/blob/main/sources/en/codex/config-reference.md)、[Claude Code sub-agents](https://code.claude.com/docs/en/sub-agents)、[opencode skills](https://opencode.ai/docs/skills)、[opencode agents](https://opencode.ai/docs/agents)、[Cursor skills](https://prod.cursor.com/help/customization/skills)、[Cursor 模型切换](https://cursor.com/docs/agent/prompting)。

## 1. Codex

**技能目录**：Codex 从当前目录一路向上扫到仓库根，收集每一层的 `.agents/skills`；再加用户级 `~/.agents/skills`（注意 `~/.codex/skills` 与它是同一位置）、`/etc/codex/skills` 和内置。

```bash
npx -y skills@1.7.6 add obra/superpowers        -g -a codex
npx -y skills@1.7.6 add dietrichgebert/ponytail -g -a codex
npx -y skills@1.7.6 add mattpocock/skills       -g -a codex
```

**A. 两段 profile 会话**（📄 官方：profile 是**独立文件**，放在 `$CODEX_HOME` 下，用 `--profile <name>` 选中）：

```toml
# ~/.codex/design.config.toml   ← 文件名 = profile 名
model = "<design-model>"
model_reasoning_effort = "high"

# ~/.codex/code.config.toml
model = "<cheap-model>"
model_reasoning_effort = "medium"

# ~/.codex/review.config.toml
model = "<review-model>"
model_reasoning_effort = "high"
```

```bash
codex --profile design   # G1/G2 → spec.md、plan.md
codex --profile code     # G3 → evidence.md
codex --profile review   # G4（新会话，满足 fresh-session）
```

**B. 子代理按角色配模型**（📄 官方 `[agents]` 段：顶层 3 个 + 每个角色 3 个，共 6 个键）：

| 字段 | 含义（官方原文摘要） |
|---|---|
| `agents.max_threads` | 可同时打开的 agent 线程数，默认 6 |
| `agents.max_depth` | 子代理嵌套深度，root 从 0 起，默认 1 |
| `agents.job_max_runtime_seconds` | `spawn_agents_on_csv` 每 worker 超时，默认 1800 |
| `agents.<name>.description` | 选择/派发该类 agent 时给 Codex 看的角色说明 |
| `agents.<name>.config_file` | **该角色的 TOML 配置层**——模型就写在这个文件里 |
| `agents.<name>.nickname_candidates` | 派发时的显示昵称池（可选） |

```toml
# ~/.codex/config.toml
[agents.coder]
description = "按 plan 逐任务实现，只做翻译不做设计"
config_file = "~/.codex/agents/coder.toml"   # 相对路径从声明它的配置文件解析
```

```toml
# ~/.codex/agents/coder.toml  ← 这就是"配置层"，可写 model
model = "<cheap-model>"
model_reasoning_effort = "medium"
```

**G4 的官方捷径**：顶层 `review_model` —— 官方原文「Optional model override used by `/review`（默认跟随当前会话模型）」。**评审不换会话也能用另一个模型**：

```toml
# ~/.codex/config.toml
review_model = "<review-model>"
```

> ⚠️ **纠正两处旧写法**（我上一版写错，官方 reference 里没有）：
> ① `[agents] default_subagent_model` —— 官方 `[agents]` 段没有这个键（那是第三方文章的写法，仅作参考）；
> ② `[profiles.design]` 内联表 —— 这个版本的官方形式是**独立 profile 文件**，不是 config.toml 里的表。若你版本仍认内联表，两种都试一次再定。

## 2. Claude Code

**技能目录**：`~/.claude/skills/<name>/SKILL.md`（个人）、`.claude/skills/`（项目），插件与企业管理级同级。

```bash
npx -y skills@1.7.6 add obra/superpowers        -g -a claude-code
npx -y skills@1.7.6 add dietrichgebert/ponytail -g -a claude-code
npx -y skills@1.7.6 add mattpocock/skills       -g -a claude-code
```

**换模型**：子代理 frontmatter 的 `model` 是最干净的做法（官方支持别名 `sonnet` / `opus` / `haiku` / `fable` 或完整 ID），解析顺序是**单次调用 → 子代理 frontmatter → `CLAUDE_CODE_SUBAGENT_MODEL` → 主会话模型**。

```yaml
# .claude/agents/reviewer.md
description: 只读 diff 与 spec，逐条 AC 找反例
model: <review-model>
```

或者最省事：新会话 `claude --model <design>` → `/model <cheap>` → 新会话 `/model <review>`。

## 3. opencode

**技能目录**：默认 `.opencode/skills`、`~/.config/opencode/skills`；**另有兼容搜索**：`.claude/skills`、`.agents/skills` 及其 user 级 `~/.claude/skills`、`~/.agents/skills`。

> 这点很关键：CLI 把技能装到 `.agents/skills`，opencode **原生会读**，不需要桥接或软链。

**换模型**：opencode 的 agent 可以各自配 `model`（`provider/model#variant`），而且自带 `plan`（只规划不改文件）与 `build`（默认编码）两个 primary，另有 `general` / `explore` subagent。**这正好是 design / code / review 三个角色。**

```jsonc
// ~/.config/opencode/opencode.json
{
  "$schema": "https://opencode.ai/config.json",
  "agents": {
    "reviewer": {
      "description": "只读 diff 与 spec，逐条 AC 找反例",
      "mode": "subagent",
      "model": "<provider>/<review-model>#high",
      "permissions": [
        { "action": "edit", "resource": "*", "effect": "deny" },
        { "action": "shell", "resource": "*", "effect": "deny" }
      ]
    }
  }
}
```

三档映射：G1/G2 用 `plan`（配 design 模型）→ G3 用 `build`（配 cheap 模型）→ G4 起 `reviewer`（配 review 模型）。

## 4. Cursor

**技能目录**：官方明确"自动从 `.agents/skills/`、`.cursor/skills/`、`~/.agents/skills/`、`~/.cursor/skills/` 加载"，并兼容 `.claude/skills`、`.codex/skills`；支持嵌套分类目录（例如 `.cursor/skills/shipping/deploy-staging/SKILL.md`，技能名取最近那层目录名）。

CLI 装到 `.agents/skills` → **Cursor 原生读**，不用软链。

**换模型**：官方文档写明可用模型选择器切换，`Cmd/Ctrl + /` 循环，**"可以在对话中途切换"**，变更对后续生效；每个 mode（Ask/Agent）还能各设默认模型。

三档映射：同一对话里先选 design 模型跑 G1/G2 → 切 cheap 模型跑 G3 → **开新对话**选 review 模型跑 G4（跨对话=天然 fresh-session，也满足"评审换模型"）。

## 5. Easy Code

Easy Code 的技能目录是**用户级**的 `~/.easycode-user/skills/`：把技能目录直接放进去即可（`npx skills` 的 agent 名单里没有它，需要 `cp`）。

```bash
git clone git@github.com:x-rush/feature-pipeline.git /tmp/fp
cp -R /tmp/fp/feature-pipeline /tmp/fp/coding-skill-arbiter ~/.easycode-user/skills/

# 三个套件同样用 cp（CLI 的 -a 不认 easycode）
git clone --depth 1 https://github.com/obra/superpowers /tmp/sp
cp -R /tmp/sp/skills/* ~/.easycode-user/skills/
```

**换模型**：Easy Code 的 mod / skill 扩展面**没有模型切换 API**（本仓库早期版本记录的已知限制），所以三档对应的模型是**在宿主 UI 里手动切**，G4 必须新开会话。

这份配置已经写进 `feature-pipeline/config/host.example.json`（开箱可用，不需要自己填）。G0 会把 `invocation` 打印出来，你照着切就行。下面是 Easy Code **公开的产品数据**：

| 角色 | low | high | max | 说明 |
|---|---|---|---|---|
| design | `gpt-6.1-terra` | `gpt-6.1-sol` | `claude-opus-5-5` | 只跑 3–5 轮，取账户内最强；`gpt-6-astra` 不在标准目录里，选不到 |
| code | `ling-3.1-flash` | `deepseek-flash` | `deepseek-flash` | **必须无 `highVolumeThreshold`**：长会话费率恒定，不会在编码中途涨档 |
| review | `hy4` | `gemini-4-argon` | `claude-sonnet-5-5` | 与 code 不同族，且三档都高于 code |

> low 档的 code 用 `ling-3.1-flash`（0.12，同样无阈值）而不是 `deepseek-flash`：只有 low 允许用模型质量换成本，high/max 仍留 `deepseek-flash`。
> review.low 由 `claude-haiku-5-5` 换成 `hy4`（1.15 恒定）：前者有 100k 阈值，长会话单价从 0.24 跳到 1.2，评审会话常常一次就越线。

三条硬约束（按顺序校验，缺一条就换型号）：

1. **code 必须 flat-rate**：编码会话通常 20 万 token 以上，任何带阈值的型号都会在会话中途跳到高价档
2. **review 必须跨族且 ≥ code**：评审是唯一负责“发现错误”的环节，弱于被审者等于没有
3. **design.max 只能取目录内最强**：不可逆改动靠它一次想对，不宜再试第二次

单次功能的相对成本（Easy Code 公开数据，仅作档位间的横向比较）：

```json
"easycode": {
  "models": {
    "design": { "low": "gpt-6.1-terra", "high": "gpt-6.1-sol", "max": "claude-opus-5-5" },
    "code": { "low": "ling-3.1-flash", "high": "deepseek-flash", "max": "deepseek-flash" },
    "review": { "low": "hy4", "high": "gemini-4-argon", "max": "claude-sonnet-5-5" }
  },
  "invocation": {
    "design": "在本宿主 UI 里切到 models.design[gear]",
    "code": "切到 models.code",
    "review": "新开会话 + 切到 models.review[gear]"
  },
  "estimate": { "low": 20.6, "high": 47.2, "max": 82.1 }
}
```

> 换宿主时只改 `models` 与 `invocation`；`estimate` 留空或删掉都行，它不是流程的一部分，只是 G0 打印给人看的对比。

> 📦 **证据等级**：目录约定来自产品自身与本仓库记录；**本机没有这个目录，所以落点未实测**。你要验的话，装完问一句"你现在有哪些 skills"即可。

## 6. 三档落到五个 agent

| 阶段 | 要什么 | Easy Code | Codex | Claude Code | opencode | Cursor |
|---|---|---|---|---|---|---|
| G1/G2 设计 | 强推理 | UI 切 design | `--profile design` | `--model <design>` | `plan` agent | 选择器 |
| G3 编码 | 廉价、长上下文不涨价 | UI 切 code | `--profile code` | `/model <cheap>` | `build` agent | 对话中途切 |
| G4 评审 | 异族且 ≥ code | 新会话 + UI 切 review | `--profile review` | reviewer 子代理 | `reviewer` 子代理 | 新对话 + review 模型 |

## 7. 自查

```bash
node scripts/check-skills.mjs --agent <agent>   # 依赖按套件汇总（easycode 也认）
node scripts/check-public-safe.mjs              # 仓库里有没有内部信息

# 复验 CLI 落点（别信文档，信实测）
mkdir -p /tmp/t && cd /tmp/t
npx -y skills@1.7.6 add obra/superpowers -a <agent> -s brainstorming --copy -y
find . -name SKILL.md | head -3
```

> **别并发跑多个 agent**：我并发跑时 8 个报 `exit=1` 且没装任何东西，单独重跑全部成功——npx/网络争用，不是不支持。

## 8. 仍未验证的部分（不藏）

| 主张 | 状态 |
|---|---|
| Codex / Claude Code / opencode / Cursor 的**读写目录匹配** | 📄 官方文档 + ✅ 落点实测 |
| 五个的**换模型能力** | 📄 官方文档（Codex 的 `[agents]` 字段逐个对照官方 config-reference）；Easy Code 为 📦 产品约定 |
| **Easy Code 的目录与切换方式** | 📦 产品约定；**未实测**（本机无该目录） |
| **端到端跑完 G0–G4** | ❌ 五个都没跑过 |
| `-g` 全局安装的实际落点 | ❌ 未实测（不想污染家目录） |

> **范围**：本文档覆盖上面这 5 个 agent。其他 agent 我不做适配、也不列名字。
