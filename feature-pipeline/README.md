# feature-pipeline

把「需求 → 设计 → 编码 → 评审」固化成一条带闸门的流水线。定档位（low/high/max）→ 按档位派发参数 → 用状态文件推进阶段，因此**换模型、换会话都能续跑**。

> **参数只有一个源头**：`gears.json`。本文件只解释怎么用，不复述档位参数、模型选择与属性定义——复述就会漂移（这次修订前它已经漂过一次）。

---

## 灵感来源：高能力模型规划，低能力模型执行

| 来源 | 做法 |
|---|---|
| Aider architect / editor 双模型 | 强模型只出方案文本，弱模型翻译成 diff |
| Claude Code plan 模式 | 强模型只读产计划，再切执行模型动手 |
| Spec-driven development | 先把规格写成可执行产物，再按规格实现 |

为什么成立：**「想清楚」和「敲 diff」是两种能力**。前者吃推理，后者吃格式与局部精度。

三条配套前提（缺一条，这套编排就不成立）：

1. **能力不能两头空**：评审端必须 ≥ 编码端，否则「发现错误」那一环等于不存在。
2. **编码端必须费率恒定**：长会话会让按量计费的模型变贵，编码模型要选不随上下文涨价的那一档。
3. **宿主至少能提供两个模型**。只有一个模型时，G4 走「新会话 + 换提示词」并在状态文件记 `review_degraded: true`——这是**记录在案的降级**，不是「跨模型评审通过」。

`gears.json` 只写三个角色的**能力要求**（`roles`），不写任何型号。具体型号在 `feature-pipeline/config/host.example.json`（已跟踪、开箱可用）；本机要覆盖就建 `feature-pipeline/config/host.local.json`（被忽略）。G0 按 `host_config` 的回退顺序取第一个存在的文件，解析后写进 `.pipeline.json`。

---

## 定档：可自动，也可由用户指定

**优先级**：用户明确指定 > 用户给约束 > 自动判定。

未指定时按下面顺序自动判定（**首个命中即停**）：

| 顺序 | 条件 | 档位 |
|---|---|---|
| 1 | 迁移 / 删除 / 鉴权 / 支付 / 并发 / 跨服务 | **max** |
| 2 | 改公共接口，或目标模块无测试，或 4–5 个文件，或 ≥4 文件且跨 ≥2 模块 | **high** |
| 3 | ≥6 个文件、完全可 revert、且只在一个模块内 | **low** |
| 4 | 以上都不命中 | **不建目录，走日常流程** |

**可逆性优先于规模**：六个文件但干净可回滚、且不跨模块 → low（因为它可逆）；四个文件但跨模块或踩在无测试的代码上 → high。

> 修订注：旧版把「≥4 文件」排在「≥6 文件」之前，第 3 条永远命中不了，自动判定实际上只有 high/max 两档。现在把 high 收到 4–5 文件，low 才真正可达；用户仍可显式指定任何档位。

**用户指定的两条规则**：

1. **低于风险时只说一次**：指定档位低于自动判定结果，且命中 `max_triggers` 时，提示「命中不可逆清单（哪条），建议 max；仍按 <档位> 执行吗？」——用户坚持就不拦，写 `risk_ack`。
2. **记录来源**：`gear_source: auto | user | inherited | downgrade`。

**档位变更**：只升不降。升档按新档补字段，**不重跑已过的 gate**；降档＝回到 G0 重新定档（`gear_source:"downgrade"`），不是中途降级。

---

## 状态文件（换会话续跑靠它）

G0 建 `features/<slug>/`，从 `templates/pipeline.json` 拷一份 `.pipeline.json`：

```json
{"slug":"login-throttle","gear":"high","gear_source":"auto","attrs":["cross_module"],
 "models":{"design":"<host>","code":"<host>","review":"<host>","review_degraded":false},
 "stage":"G2","verdict":null,"rounds":{"review":0},"risk_ack":null,
 "missing_skills":[],"state_mismatch":false,"dirty_files":[]}
```

- `stage` / `verdict` 以该文件为准；`spec.md`、`plan.md`、`evidence.md`、`review*.md` 是证据，不是状态。
- 两者冲突时信文件，并置 `state_mismatch: true`。
- `dirty_files` 记录 G0 时本来就脏的文件——防越界规则只回滚这些之外的文件，不会吞掉你未提交的改动。
- `features/` 默认在 `.gitignore` 里；要进 PR 就单独取消忽略。

**评审轮次不覆盖**：`review.md` = 第 1 轮，`review-r2.md` = 第 2 轮（max），`review-r3.md` = 第二次 rework 之后。**判定 FAIL 必须回 G3，绝不能回 G4**（旧版状态机把 FAIL 又送回评审，死循环）。

---

## 依赖：3 个套件（3 条命令）

核心三件，缺一件就明显掉水准；另外两个可选，不装也能跑完整个流程。

| 套件 | 提供什么 | 必需？ |
|---|---|---|
| **obra/superpowers** | 流程与纪律：循环、台账、证据、收尾（12 个技能） | 必需 |
| **dietrichgebert/ponytail** | 改动量控制（2 个） | 必需 |
| **mattpocock/skills**（engineering 子集） | 判据与词汇：接缝、两轴评审、深模块、术语（8 个） | 必需 |
| graphify-labs/graphify | 代码检索与影响面（1 个） | 可选；没有就手工 grep |
| nextlevelbuilder/ui-ux-pro-max-skill | 界面设计与实现（2 个） | 可选；只有界面任务才装 |

下面按套件列出**装好以后你的技能目录里应该出现的名字**——这是拿到仓库后的自查清单，不是二十几个独立依赖，装的时候只有 3 条命令。

### obra/superpowers（12）

| 技能 | 用在哪 | 干什么 |
|---|---|---|
| `brainstorming` | G1 | 澄清需求、产出设计稿 |
| `writing-plans` | G2 | 出可执行计划 |
| `test-driven-development` | G3 | 红-绿循环（流程） |
| `executing-plans` | G3 | 按计划执行 + `progress.md` 台账 |
| `subagent-driven-development` | max G3 | 子代理执行 |
| `dispatching-parallel-agents` | `parallel` | 一模块一子代理 |
| `using-git-worktrees` | max G3 | worktree 隔离 |
| `systematic-debugging` | G3 | 反「猜-改-试」 |
| `verification-before-completion` | G3/G4 | 无证据不得声称完成 |
| `receiving-code-review` | G3 rework | 处理评审意见不盲从 |
| `finishing-a-development-branch` | 收尾 | 收尾流程 |
| `writing-skills` | 自进化 | 用 TDD 的方式改本技能 |

### mattpocock/skills（engineering 子集，8）

| 技能 | 用在哪 | 干什么 |
|---|---|---|
| `tdd` | G2/G3 | 接缝与「什么测试值得留」（判据） |
| `code-review` | G4 | 两轴评审：Standards + Spec |
| `codebase-design` | G2 | 深模块 / 接口 / 接缝词汇 |
| `grill-with-docs` | max G2 | 拿文档反过来质疑设计 |
| `domain-modeling` | `terminology` | 术语与边界 |
| `prototype` | `spike` | 一次性原型，结论写回 plan |
| `diagnosing-bugs` | `hard_bug` | 难复现 / 性能回归 |
| `pr` | 收尾 | PR 描述 |

> 注意：superpowers 里的 `diagnosing-superpowers` 是调试 superpowers 自身，**不是**排障技能；代码排障用 mattpocock 的 `diagnosing-bugs`。

### dietrichgebert/ponytail（2）

| 技能 | 用在哪 | 干什么 |
|---|---|---|
| `ponytail` | G3 | 控改动量（封顶 `full`，**不用 `ultra`**） |
| `ponytail-review` | G4 轴三 | 最小化建议，advisory，不改 AC 结论 |

### graphify-labs/graphify（1）

`graphify` — G1/G2/G3 的检索与影响面（需先 `graphify index`）。

### nextlevelbuilder/ui-ux-pro-max-skill（2，只有界面任务才需要）

`ui-ux-pro-max`（G1 界面设计）、`ui-styling`（G3 界面实现）。

### 本仓库自己（2）

`feature-pipeline`、`coding-skill-arbiter`。

**未安装时**：对应阶段降级为「按判据手工执行」，并强制在 `evidence.md` 记 `missing:<skill>`、在 `.pipeline.json.missing_skills` 里留痕——闸门仍然有效，但降级不能隐藏。

---

## 安装

### 0. 环境

```bash
command -v node npx git && node -v
```

### 1. 先装技能本身

```bash
git clone git@github.com:x-rush/feature-pipeline.git /tmp/fp
cp -R /tmp/fp/feature-pipeline /tmp/fp/coding-skill-arbiter <skills-dir>/
```

PowerShell（Windows）：

```powershell
$dst = '<skills-dir>'          # 例如 "$env:USERPROFILE\.agents\skills"
git clone git@github.com:x-rush/feature-pipeline.git (Join-Path $env:TEMP 'fp')
Copy-Item -Recurse -Force "$env:TEMP\fp\feature-pipeline","$env:TEMP\fp\coding-skill-arbiter" $dst
```

### 2. 装三个核心套件（三条命令）

```bash
# 1) superpowers
npx -y skills@1.7.6 add obra/superpowers -l     # 先看清单，不落地
npx -y skills@1.7.6 add obra/superpowers

# 2) ponytail
npx -y skills@1.7.6 add dietrichgebert/ponytail

# 3) mattpocock（只要 engineering 子集）
npx -y skills@1.7.6 add mattpocock/skills
```

`add` 只会落到 CLI 认识的那批 agent 目录。你的工具不在名单里（或者只想装 mattpocock 的子集），就补一步复制：

```bash
git clone --depth 1 https://github.com/mattpocock/skills /tmp/mp
cp -R /tmp/mp/skills/engineering/* <skills-dir>/
```

**`<skills-dir>` 指什么**：你的 agent 加载技能的那个目录，不是一个写死的常量。常见候选：

| 位置 | 说明 |
|---|---|
| `~/.agents/skills` | Agent Skills 规范的跨框架位置，多个工具都读 |
| `~/.claude/skills`、`~/.codex/skills`、`~/.config/opencode/skills` | 各宿主自己的目录 |
| `./.agents/skills`、`./.claude/skills` | 项目级目录，跟着仓库走 |
| 其它 | 你的宿主的技能目录，用 `--dir` 指过去即可 |

**可选两个**（不装也能跑）：

```bash
# 代码检索：需要 CLI（系统 Python 是 3.9 时显式指定 3.12）
uv tool install --python 3.12 graphifyy
graphify install --platform skills
cp -R ~/.agents/skills/graphify <skills-dir>/

# 界面任务才装
npx -y skills@1.7.6 add nextlevelbuilder/ui-ux-pro-max-skill
```

**在目标仓库里只做一次**：建索引、忽略产物。

```bash
cd <你的仓库> && graphify index && printf 'graphify-out/\nfeatures/\n' >> .gitignore
```

> Windows：把上面每条 `cp` 换成 `Copy-Item -Recurse -Force`、路径用反斜杠，`npx` 那三条一字不改。

### 3. 自查：装完整了吗

```bash
node scripts/check-skills.mjs --agent <agent>   # 按 agent 名直接找目录（codex / claude-code / opencode …）
node scripts/check-skills.mjs                 # 自动探测：优先选已经有技能的目录
node scripts/check-skills.mjs --dir <目录>     # 自己指定
node scripts/check-skills.mjs --list           # 只看套件包含哪些技能
node scripts/check-skills.mjs --skills         # 逐条列出还缺哪个
```
各 agent 的目录对照与换模型写法：见 [`../docs/HOSTS.md`](../docs/HOSTS.md)。

输出按**套件**汇总，一眼能看出该怪谁：

```
skills dir: ~/.agents/skills (auto)
core
  superpowers            12/12   ok   (process: loop, ledger, evidence, finish)
  mattpocock             8/8     ok   (criteria: seams, two-axis review, deep modules)
  ponytail               2/2     ok   (compression: keep the diff small)
  self                   2/2     ok   (this repo)
optional
  graphify               0/1     missing 1: graphify   (optional: code retrieval, needs graphify index)
  ui-ux-pro-max-skill    0/2     missing 2: ui-ux-pro-max, ui-styling   (optional: only for UI tasks)
core 24/24 · optional 0/3
```

核心缺一个就退出码 1；可选缺了不算失败（加 `--strict` 才一起算）。旧版只抽查 12 个名字，剩下那些静默缺失也不会报错。

---

## 三条底线（任何档位不可省）

1. **测试文件只读**：禁止改断言、删用例、放宽 mock。
2. **没有新跑的命令输出，不许说「完成」**。
3. **评审必须跨模型**：绝不同源自审。唯一例外是 G4 记录在案的 `review_degraded`。

---

## 文件结构

```
feature-pipeline/
  SKILL.md                 流程与判据（≤150 行）
  gears.json               唯一参数源：档位、派发、属性、状态机、模型提示
  README.md                本文件（解释用法，不复述参数）
  templates/
    pipeline.json          状态文件模板（G0 拷贝）
    spec.md                 G1
    plan-low|high|max.md    G2（字段数随档位递增）
    evidence.md             G3
    review.md               G4（第 n 轮用 review-r<n>.md）
    blocker.md              卡点报告
    retro.md                每任务四行复盘
  ../scripts/check-skills.mjs   安装校验
```

---

## 本次修订（对照评审）

| 级别 | 问题 | 修法 |
|---|---|---|
| P0 | low 档自动判定不可达（先判 ≥4 文件，low 要 ≥6） | high 收到 4–5 文件；low 要求单模块 + 可 revert；顺序重排 |
| P0 | G4 FAIL 被状态机送回 G4，死循环 | 状态机按「最新一轮评审」判定，FAIL → G3；轮次文件不复用 |
| P0 | `.pipeline.json` 无 schema，且 `stage` 与磁盘推导双真相 | 给模板 + 字段表，声明文件为权威、冲突记 `state_mismatch` |
| P0 | 单模型宿主下「跨模型」不可实现，又无降级条款 | G4 新增 `review_degraded` 记录路径；模型 ID 改为 G0 解析 |
| P1 | 路由把 30 轮单文件任务送进流水线，G0 又踢回来 | 删掉「>25 轮」触发；升级清单收敛为 G0 的子集 |
| P1 | low 档「同会话评审」与「必须新会话」及 5 倍成本自相矛盾 | 三档统一 `review_session: fresh` |
| P1 | 依赖清单与实际派发不符（README 列 13 个，实际用到 24 个技能名） | 按套件列出技能名 + 自查脚本，安装只留 3 条命令 |
| P1 | 降级说明只写在 README，加载时看不到 | 写进 SKILL.md「Missing skills」，强制留痕 |
| P2 | README/`../coding-skill-arbiter/tables.md` 复述档位表并已漂移 | 只留摘要，权威指向 `gears.json` |
| P2 | 属性声称 G0 定，但 `hard_bug`/`rework` 不可能 G0 定 | 改为「可任意闸门追加」 |
| P2 | `features/` 未忽略；`git checkout` 会毁未提交改动 | 加 `.gitignore`；G0 记 `dirty_files`，只回滚本来干净的文件 |
| P2 | 零发现即判无效，逼出无意义 finding | 改为「反例尝试 + 命令可查即合法」 |
| P2 | AC「未勾选」不可机检 | 明确空白 = 未核对，UNVERIFIED ≠ PASS |
| P2 | `allow_downgrade_midflight` 与「降档重跑 G0」措辞冲突 | 删掉死配置，统一为「降档 = 重新定档」 |

---

## 已知限制

- **不能自动切模型**：宿主没有模型切换 API，`task` 子代理继承主会话模型；切模型仍是每次阶段切换的一次手动操作。
- **单模型宿主会让三档设计失效**：可以跑，但评审只能降级并记录，不要谎称跨模型。
- **不能读上下文 token 数**：只能靠「评审必须新开会话」这条结构性约束规避。
- **闸门是自我认证的**：要求引用位置而非打勾，只提高可核验性，不能消除自评。
- **未在大量真实需求上验证**：先跑三次，用 `retro.md` 记缺口，再改任何一条。

## 许可

MIT，见 `../LICENSE`。第三方技能包各自有许可证，本仓库不镜像它们。
