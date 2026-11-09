# <功能名> · 独立评审（第 <n> 轮）

> G4 产物。**文件名即轮次**：`review.md` 第 1 轮，`review-r2.md` 第 2 轮，`review-r3.md` 第 3 轮。
> **不覆盖旧轮次**——历史轮次是 rework 的证据。
> **新会话 + 跨模型**；只给 diff 与 spec，不给编码会话的对话与辩解。

## 本轮环境
- 轮次 / 文件：1 / `review.md`
- 评审模型：<model id>
- `review_degraded`：false
- 输入材料：diff、spec（high 加 plan + blockers；max 加 history + blast_radius）
- `base_ref` 与 diff 命令：`git diff <base_ref>...HEAD`

## 验证方法（必填，写不出就是没评审）
- 读了哪些文件：
- 跑了什么命令：
- 为哪几条 AC 构造了反例（逐条列，不能留空）：

> **零发现是合法的**，但必须能回答上面三行；「没发现问题」不是答案。

---

## 轴一：Spec 符合度（对照 `spec.md`）

| 编号 | 结论 | 证据（命令输出行号 / 文件行号） | 构造的反例与结果 |
|---|---|---|---|
| AC1 | PASS / FAIL / UNVERIFIED | `npm test -- x` 输出第 5 行 | 空输入 → 返回 400 ✓ |
| AC2 | FAIL | 无对应测试，实际返回 500 | 并发两次 → 都成功 ✗ |

> **UNVERIFIED 不算 PASS。** 任一 FAIL → 本轴 FAIL。

## 轴二：Standards 符合度（对照仓库规范）

| 位置 | 规范条目 | 符合 | 证据 |
|---|---|---|---|
| `src/x.ts:42` | 错误处理统一用 `AppError` | ✓ | 第 42 行 |

> 工具已检查的项（lint、类型、格式化）跳过，不重复。

## 轴三：最小化（`ponytail-review`，仅参考）

| 位置 | 能否更少 | 建议 |
|---|---|---|

> **本轴不得改变轴一的 AC 结论**，只能作为独立建议。

---

## 越界检查
- [ ] 是否改了 plan 之外的文件（贴 `git diff --name-only`）
- [ ] 测试是否被改弱（断言减少、用例删除、mock 放宽）
- [ ] 是否引入未批准依赖
- [ ] 是否在接缝之外新增测试（横向切片迹象）
- [ ] 旧轮次评审文件是否被覆盖（本轮文件名是否为下一个轮次号）

## 结论

| 轴 | 结论 |
|---|---|
| Spec | PASS / FAIL |
| Standards | PASS / FAIL |
| **总体** | 任一轴 FAIL 即 **FAIL** |

## 下一步
- PASS → 走 `finishing-a-development-branch` + `pr`
- FAIL → 回 G3，逐条列出待修项（带 AC 编号）；根因在 spec 则回 G1，并声明 `rework`
