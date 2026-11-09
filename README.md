# feature-pipeline

给 AI 编码助手用的**两件技能**，解决同一件事：**让强模型做决策、便宜模型做执行，并且每一阶段都有可核验的闸门。**

```
coding-skill-arbiter/     89 行  常驻：为一个任务选技能组合，或判定不需要技能
feature-pipeline/        150 行  大需求才加载：需求 → 设计 → 编码自验 → 独立评审
```

**参数只有一处**：`feature-pipeline/gears.json`。本文件是概览，不复述档位参数、模型选择与属性定义；要改参数只改那个 JSON。

## 设计出发点

| 来源 | 做法 |
|---|---|
| Aider architect / editor | 强模型只出方案文本，弱模型翻译成逐行 diff |
| Claude Code plan 模式 | 强模型只读产计划，再切执行模型动手 |
| Spec-driven development | 先把规格写成可执行产物，再按规格实现 |

核心判断：**「想清楚」和「敲 diff」是两种能力**。让最贵的模型写样板代码是浪费，让最便宜的模型定方案是赌返工。

三个环节要的是三种**能力**，不是三个具体型号：

```
设计 "强推理"  ──  编码 "廉价且长上下文不涨价"  ──  评审 "异族且不弱于编码"
```

> 本仓库用**能力槽**（design / code / review）而不是固定型号描述分工；`feature-pipeline/config/host.example.json` 里就是 Easy Code 的公开型号与费率（开箱可用）。宿主相关的差异放 `feature-pipeline/config/host.local.json`（未跟踪），G0 优先读它、没有就回退到 example——所以克隆下来不会缺件。

三条让它成立的前提：

1. **能力不能两头空**：评审端必须 ≥ 编码端，否则「发现错误」那一环等于不存在。
2. **编码端必须费率恒定**：长会话会让按量计费的模型变贵，编码模型要选不随上下文涨价的那一档。
3. **宿主至少能提供两个模型**。只有一个模型时，G4 走「新会话 + 换提示词」并记 `review_degraded: true`——**记录在案的降级，不是跨模型评审通过**。

## 两个技能的分工

### `coding-skill-arbiter`（常驻）

一个任务进来，它做四层路由后输出一张**决定卡**（≤5 行）：

```
Task:   <一句话理解>
Gear:   <none | low | high | max>    Cost: <low | medium | high | n/a>
Skills: <1-2 个>
First:  <第一个具体动作>
Risk:   <无 | 一句话>
```

路由四层，按序命中即停：

| 层 | 依据 |
|---|---|
| L0 显式 | 用户点名技能或档位 → 照办 |
| L1 磁盘事实 | 已有 `.pipeline.json` → 交给 `feature-pipeline` |
| L2 可观测信号 | ≤3 条命令 → 任务属性 |
| L3 通用默认 | 归属表 |
| L4 询问 | 仅不可逆且用户未表态 |

**信号必须来自命令输出或文件事实**，不接受「我感觉这是 UI 任务」——判错只浪费上下文，所以宁可漏判也不猜。

### `feature-pipeline`（大需求才加载）

四个 gate，用状态文件推进，因此**换模型、换会话都能续跑**：

```
G0 定档 ──► G1 需求 ──► G2 设计 ──► G3 编码自验 ──► G4 独立评审
   │           │            │             │              │
 可拒绝      spec.md      plan.md      evidence.md    review*.md
```

**G0 可以拒绝执行**：四条阈值都不命中时只输出一句「这是小改动，走日常流程」，不建目录、不写文件。能拒绝是这套东西不被嫌弃的前提。

**G4 判 FAIL 会回 G3，不会回 G4**：评审按轮次落盘（`review.md`、`review-r2.md`、`review-r3.md`），不覆盖旧轮次。

## 三档参数（摘要，权威在 `feature-pipeline/gears.json`）

| | low | high | max |
|---|---|---|---|
| 自动触发 | ≥6 文件、单模块、完全可 revert | 改公共接口 / 目标模块无测试 / 4–5 文件 / ≥4 文件跨模块 | 迁移·删除·鉴权·支付·并发·跨服务 |
| 评审轮次 | 1 | 1 | 2（第 2 轮只找反例） |
| 成本档位 | low | medium | high |

模型选择、`plan_fields`、派发技能、属性定义、状态机字段全部在 `feature-pipeline/gears.json`，这里不抄第二份——这次修订前抄了三份，已经漂了（档位表与属性定义各出现过两套）。具体型号在 `feature-pipeline/config/host.example.json`（已跟踪、开箱可用），本机要覆盖就新建 `feature-pipeline/config/host.local.json`（被忽略），G0 按 `host_config` 的回退顺序取第一个存在的文件，解析后写进状态文件。

**可逆性优先于规模**：六个文件但干净可回滚、不跨模块 → low；四个文件但跨模块或在无测试代码上 → high。

编码端三档统一：**它的费率恒定**，长会话不涨价。档位可由用户直接指定；低于风险时只提醒一次，坚持就照办并记录 `risk_ack`。

## 三条底线（任何档位不可省）

1. **测试文件只读**：禁止改断言、删用例、放宽 mock
2. **没有新跑的命令输出，不许说「完成」**
3. **评审必须跨模型**，绝不同源自审；唯一例外是记录在案的 `review_degraded`

## 依赖：3 个套件（3 条命令）

这套技能**不自己写方法论**，只做编排。核心三件必需，检索与界面可选。

| 套件 | 管什么 | 必需？ |
|---|---|---|
| **obra/superpowers**（12 个技能） | 流程与纪律：循环、台账、证据、收尾 | 必需 |
| **dietrichgebert/ponytail**（2 个） | 压缩：怎么更少 | 必需 |
| **mattpocock/skills**（8 个，engineering 子集） | 判据与词汇：接缝、反模式、两轴评审、深模块、术语 | 必需 |
| graphify-labs/graphify（1 个） | 检索：东西在哪 | 可选，没有就手工 grep |
| nextlevelbuilder/ui-ux-pro-max-skill（2 个） | 界面设计与实现 | 可选，只有界面任务才装 |

**关键事实**：`tdd`（mattpocock，38 行）与 `test-driven-development`（superpowers，330 行）**不是重复，是判据与流程**——前者管什么测试值得留，后者管红绿循环怎么跑。可以叠用。

唯一必须裁的正面冲突：`tdd` 说「重构不属于循环，属于评审」，superpowers 的 Red-Green-**Refactor** 把重构放进循环。本项目裁决给 mattpocock——低能力模型在循环里顺手重构，正是 diff 膨胀的主因。

> 另一处易混：superpowers 的 `diagnosing-superpowers` 是调试 superpowers 自身，不是排障技能；代码排障用 mattpocock 的 `diagnosing-bugs`。

## 安装

```bash
git clone git@github.com:x-rush/feature-pipeline.git /tmp/fp
cp -R /tmp/fp/feature-pipeline /tmp/fp/coding-skill-arbiter <skills-dir>/
```

**`<skills-dir>`** 指你的 agent 加载技能的那个目录，不是一个写死的常量：`~/.agents/skills`、`~/.claude/skills`、项目内的 `./.agents/skills`……依宿主而定。脚本会自动探测常见位置，探测不到就用 `--dir` 指过去。

已适配的宿主（每个都有照抄配置）：**Easy Code**（`~/.easycode-user/skills/`，UI 内切模型）、**Codex**（`--profile`）、**Claude Code**（子代理 `model`）、**opencode**（`agents.<id>.model`）、**Cursor**（对话中途换模型）。详见 [`docs/HOSTS.md`](docs/HOSTS.md)。

三条命令装依赖（第一条只是预览清单）：

```bash
npx -y skills@1.7.6 add obra/superpowers -l
npx -y skills@1.7.6 add obra/superpowers
npx -y skills@1.7.6 add dietrichgebert/ponytail
npx -y skills@1.7.6 add mattpocock/skills
```

`add` 只落到 CLI 认识的那批目录；不在名单里就 `cp -R <clone>/skills/* <skills-dir>/` 补一步。可选套件、`graphify index`、以及「只从原始 owner 安装」的安全提醒，都在 [`feature-pipeline/README.md`](feature-pipeline/README.md)。

自查（按套件汇总，核心缺一个就退出码 1）：

```bash
node scripts/check-skills.mjs            # 自动探测技能目录
node scripts/check-skills.mjs --list     # 每个套件包含哪些技能名
node scripts/check-skills.mjs --skills   # 逐条列出还缺哪个
```

## 使用

- 大需求：「走完整流程」「来个大需求」「按流水线做」
- 日常任务：什么都不用说，`coding-skill-arbiter` 会自己出决定卡
- 开关：「省钱」「稳一点」「加一轮评审」「只看不写」「别加载技能」

## 语言约定

指令正文是英文（token 更省）；**与你对话、以及所有产出文档一律用你的语言**（默认中文）——`spec.md`、`plan.md`、`evidence.md`、`review*.md` 都是给人核验的，英文文档等于无法验收。

## 本次修订

上一轮评审发现的 4 个 P0、4 个 P1、若干 P2 已全部修掉，逐条对照表在 [`feature-pipeline/README.md`](feature-pipeline/README.md) 的「本次修订」一节。最值得知道的四条：

1. **low 档真正可达**（旧版顺序让自动判定永远选不到 low）；
2. **FAIL 回 G3**（旧版状态机会把失败的功能再送进评审，死循环）；
3. **状态文件有模板与字段表**（旧版只有一句读不通的散文，续跑靠猜）；
4. **单模型宿主有降级路径**（旧版要求「跨模型」却又无法实现，执行者只能撒谎或违规）。

## 迭代与发布

**规则进仓库，"能不能公开"按数据性质分**：闸门、判据、模板、以及公开的型号与费率都进仓库；只有真正非公开的东西（密钥、客户名、未发布内容、各机器不同的路径与当前宿主）放 `config/*.local.json`（已 git-ignore）。

- 发布前跑三道闸门（CI 也会跑其中前两道 + 密钥扫描）：
  ```bash
  node scripts/check-repo.mjs          # 行数预算、模板齐全、schema/常量/文档链接一致
  node scripts/check-skills.mjs        # 依赖按套件汇总
  node scripts/check-public-safe.mjs   # 没把内部信息写进仓库
  ```
- 想把同一份技能搬到 Codex / Claude Code / opencode / aider：见 [docs/HOSTS.md](docs/HOSTS.md)——含 Codex 的两套写法（两段 profile 会话、单会话子代理分层）。
- 私有源 + 公开镜像的双仓库方案、分支/tag/PR 回流规则、每次改动的自查清单，见 [docs/RELEASING.md](docs/RELEASING.md)。

## 已知限制

- **不能自动切模型**：宿主工具没有模型切换 API，`task` 子代理继承主会话模型。切模型是每次阶段切换的一次手动操作。
- **单模型宿主会让三档设计失效**：能跑，但评审只能降级并记录。
- **不能读上下文 token 数**：无法自动提示阈值，只能靠「评审必须新开会话」这条结构性约束规避。
- **闸门是自我认证的**：出关检查要求「引用位置」而非打勾，但这只能提高可核验性，不能消除自评。
- **未在大量真实需求上验证**：先跑三次，用 `retro.md` 记录缺口，再改任何一条。

## 许可

MIT，见 `LICENSE`。第三方技能包各自有许可证，本仓库不镜像它们。
