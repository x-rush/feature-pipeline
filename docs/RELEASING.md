# 迭代与发布管理

**先说结论**：真正非公开的只有**密钥/令牌、客户名、未发布内容**这类东西。型号 id 与 Easy Code 的费率是公开数据，可以直接写进仓库——所以不需要为"藏"维护两个仓库，单仓库 + 本地配置就够。真出现路线图/客户/试运行数据，再升级到方案 B。

---

## 0. 先决定：什么进仓库、什么留本地

| 内容 | 放哪 |
|---|---|
| 闸门、判据、模板、状态机 | 仓库 |
| 型号 id、Easy Code 费率与档位成本 | 仓库（公开数据，见 `HOSTS.md` §5） |
| 密钥、令牌、客户名、未发布路线图 | 本地 `config/*.local.json`（git-ignored） |
| 当前宿主、机器相关路径 | 本地 `feature-pipeline/config/host.local.json` |

判断标准只有一条：**这条信息是否本来就对外可见**。对外可见的进仓库，只有你自己知道的留本地。

---

## 方案 A：单仓库、机密外置（推荐）

### 目录约定

```
config/
  host.example.json       # 已跟踪：开箱可用的 Easy Code + Codex 配置（公开数据）
  forbidden.example.json  # 已跟踪：密钥规则 + 一个自定义占位
  host.local.json         # 可选、未跟踪：本机覆盖（不同宿主/目录时才有）
  forbidden.local.json    # 可选、未跟踪：你自己的内部词表
```

### 当前状态

- **仓库历史已重建**：2026-11-07 删库后以**单提交**重新初始化，旧提交不在任何分支上。
- **工作区 clean**：`node scripts/check-public-safe.mjs` 通过（当前只剩密钥一类规则）。
- **型号与费率已公开**：`docs/HOSTS.md` §5 写的是 Easy Code 公开的型号映射与档位成本，不需要再遮。

新克隆的人**通常什么都不用填**：`feature-pipeline/config/host.example.json` 就是开箱可用的 Easy Code + Codex 配置（公开数据）。只在你的宿主或型号目录不同时才需要覆盖：

1.（可选）`cp config/host.example.json config/host.local.json`，改 `active` 与 `models` 成你当前宿主的真实取值；只有一个模型就设 `review_degraded: true`。
2.（可选）`cp config/forbidden.example.json config/forbidden.local.json`，把你自己的内部词表加进 `patterns`——没有就别建，密钥规则已经在 example 里生效。

然后三道闸门：`node scripts/check-repo.mjs`、`node scripts/check-skills.mjs`、`node scripts/check-public-safe.mjs`。

然后三道闸门：`node scripts/check-repo.mjs`、`node scripts/check-skills.mjs`、`node scripts/check-public-safe.mjs`。

> 以后若真需要清历史（例如误提交了密钥）：新建仓库用 `git checkout --orphan` 首提，或 `git filter-repo --replace-text`。改完必须重跑守卫，并让所有克隆重新拉取。

### 日常迭代怎么走

```
改规则/模板 ──► guard 绿 ──► check-skills 绿 ──► commit ──►（发布时）打 tag
      │
      └─ 改的是"怎么跑"（型号/价格/路径）─► 只改 config/*.local.json，永不提交
```

- **没有双写**：公开仓库就是内部仓库，唯一差别是本地那两个未跟踪文件。
- **没有同步冲突**：不存在"公开改了、私有没改"的问题。
- **克隆即可用**：`feature-pipeline/config/host.example.json` 已含 Easy Code 的真实映射，克隆下来不需要填任何东西；本机要差异化才建 `feature-pipeline/config/host.local.json`，G0 会优先读它。

### 什么时候升级到方案 B

出现下列任一情况再升级：要写内部路线图、要放客户名、要把试运行数据和规则一起版本化（而这些又不想公开）。在那之前，双仓库只会让你每周多干一份手工活。

---

## 方案 B：私有源 + 公开镜像（单向）

### 方向规则（只允许这个方向）

```
私有仓库（源，全量） ──导出──► 公开镜像（产物，只读给外部）
        ▲                          │
        └──── 手工移植 ◄── PR ─────┘
```

- **私有 → 公开**：只能由导出脚本生成，不接受手工编辑公开侧的规则文件。
- **公开 → 私有**：不接受自动合并。把 PR 重新在私有侧实现一遍（通常只有几行），提交信息里写 `port of #123`。
- **公开侧的紧急修复**：允许直接改，但必须在 24 小时内回灌私有侧，否则下次导出会覆盖它。

### 导出怎么做

1. 导出到临时目录（只含需要发布的路径，天然排除 `config/`、内部草稿、内部分支产物）；
2. 按 `config/forbidden.local.json` 做替换：密钥/令牌 → 环境变量占位、客户名 → 代号；
3. `node scripts/check-public-safe.mjs --dist <导出目录>` 必须 clean；
4. 把导出目录同步进公开仓库的克隆，提交并打 tag。

导出的关键不是脚本多聪明，而是**导出目录是白名单**——白名单漏进来的东西才会泄密，所以第 3 步是硬闸门。

### 红线

- 公开仓库的历史**不能**含有私有历史（不要用 `git subtree push` 推整段历史，除非你确认历史里没有机密）。
- 公开主分支禁止 force-push。
- tag 与 Release 只在公开侧打；私有侧用日期提交即可。

---

## 两个方案的共性规则

| 项 | 规则 |
|---|---|
| 依赖版本 | `skills@x.y.z` 这类版本号写在 README，升级时同步文案；不写"最新版" |
| 改规则的闸门 | `check-public-safe` + `check-skills` + 文档引用审计三件一起绿才算改完 |
| 变更优先级 | 沿用 skill 自己的排序：模板字段 > 阈值 > 散文规则 |
| 三振规则 | 同类 plan 缺口出现 3 次才改模板；改前回放 3 个历史 `features/` |
| SKILL.md 预算 | ≤150 行；加一句就得砍一句，别偷偷超 |
| 版本号 | v0.x 起步；改 `.pipeline.json` 字段或状态机语义算破坏性变更，v1 前不承诺兼容 |
| CHANGELOG | 每次发布写"修了什么 + 为什么"，素材直接取 `retro.md` |
| 公开红线 | 不出现密钥/令牌、客户名、未发布的内部信息 |
| 依赖安全 | 只从原始 owner 安装，先 `-l` 看清单；不把第三方正文抄进本仓库 |

## 每次改动前的自查清单

- [ ] `node scripts/check-public-safe.mjs` 输出 clean
- [ ] `node scripts/check-skills.mjs --dir <目标宿主目录>` 核心 24/24
- [ ] `feature-pipeline/SKILL.md` 仍 ≤150 行
- [ ] 有没有新增需要藏的东西（型号 / 价格 / 内部名称）→ 有就放 `config/*.local.json`
- [ ] `retro.md` 记的是"plan 缺什么"，不是"模型哪里笨"

## 许可与归属

- 本仓库 MIT；第三方套件**只引用不镜像**，不涉及再分发。
- 可以引用它们的文件名与行数（如 `tdd` 38 行），但不要把正文或表格抄进来。
- 在职产出：著作权可能归公司，公开前确认授权。这条比前面所有规则都优先。

---

## 一句话版本

**把"怎么跑"放进不提交的本地文件，把"规则"放进仓库。**做到这一点，单仓库就能既当内部工具又当公开项目，不需要维护两套。
