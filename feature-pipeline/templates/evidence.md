# <功能名> · 编码自验收证据

> G3 产物。「全部通过」但没贴输出 = 未完成。

## 状态文件快照（`.pipeline.json`）
- `stage` / `verdict`：
- `gear` / `attrs`：
- `missing_skills`：
- `state_mismatch`：

## 命令与基准（后续评审要引用，不许留空）
- `commands.test`：
- `base_ref`：
- `degraded_verification`：false / true（true 时写明替代验证方式）
- 本次实际执行的命令（按顺序逐条）：
- 断言未被削弱的证据：`git diff --numstat <base_ref> -- <test paths>` 输出

## 台账快照
- 有 `executing-plans`：照它定义的 `progress.md` 格式；任务完成 x / y，列出未完成项，无则写「无」
- 没有该技能：用下表，不要自造轮次计数器

| 任务 | 状态 | commit |
|---|---|---|
| T1 | 完成 / 未完成 | `<sha>` |

- 越界提交：无 / 列出（并说明是否在 G0 已脏）

## 测试输出（完整，不截断）
```
<粘贴完整输出：通过数 / 失败数 / 退出码>
```

## 真实运行验证
```
<启动日志 / 一次成功请求的响应 / 页面操作记录>
```
> 无法真实启动时写 `N/A` + 原因（为什么不能），不许留空。

## 验收标准核对
| 编号 | 结论 | 证据（引用位置，不是“看起来对”） |
|---|---|---|
| AC1 | PASS | 上面输出第 3 行的 `200 OK` |
| AC2 | UNVERIFIED | 无对应测试，需补 |

> 空白 = 未核对；**UNVERIFIED 不算 PASS**。

## 残留检查
- [ ] `git diff --stat test/` 为空或仅新增
- [ ] 无 `TODO` / `not implemented`
- [ ] 无调试用 `console.log`
- [ ] 接缝之外的测试未增加（防止横向切片）
- [ ] plan 之外的文件未被修改（或已在 G0 记为脏）
