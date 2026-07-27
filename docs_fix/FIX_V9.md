# FIX_V9 — 其余 pycore UI 按页迁移（§18 清单）

来源：`docs/PYCORE_MANAGER_BUG_LIST-2.md` §18、§20 步骤 9–10。日期：2026-07-27。
依赖：FIX_V5、FIX_V6（Agent History 已作为模板）、FIX_V7。

## 目标

统一 provider 放在 pycore-manager routes 之上；逐页把“任务进度事实源”迁出 localStorage/内存轮询。本批是清单与验收模板，实施时按序开子 PR / 子会话，每次只迁一页。

## 迁移顺序

| 序 | 页面 | 当前风险 | 迁移目标 |
|---|---|---|---|
| 1 | Agent History | （已由 FIX_V6 覆盖，本批跳过） | — |
| 2 | Queue Center | 多处 poll、控制 intent 与运行态混合 | 控制 snapshot + worker operations |
| 3 | Video Extract | context/localStorage reattach | backend operation id + stage/checkpoint |
| 4 | Books/Content | 页面持有进度、localStorage 恢复 | 每本书/文件为 item |
| 5 | Sentence/Word Audio | worker 状态与 UI 设置分散 | queue item + engine/speaker/result |
| 6 | Code Sync | 页面本地 transfer 日志 | transfer operation + file items |
| 7 | AI/Translation | request 与长结果耦合 | accepted command + provider stage |
| 8 | Voice Subtitle/Media | 事件驱动但缺快照恢复 | durable session/queue snapshot |
| 9 | Laravel logs | （FIX_V8 覆盖，本批跳过） | — |

## localStorage 分类

1. 声称 “progress survives refresh” 的数据 → operation store。
2. worker concurrency / engine 默认值 → 低频配置或 UI profile，不与运行进度混存。
3. tab / drawer / expanded tree 可留本地；要跨浏览器一致再迁 `ui_snapshots`。
4. `browser_id/tab_id/pycore target` 仍是连接偏好，不得用于判断任务是否存在或归谁执行。

## 每页最小完成标准

1. 页面卸载不销毁顶层 operation store。
2. 初次进入只依赖 pycore snapshot 重建当前任务/item/阶段/结果/错误。
3. 断线后重连不依赖丢失事件。
4. 删除该页作为事实源的 localStorage key（保留纯显示偏好除外）。

## 收尾（全部页完成后）

删除兼容 `_events`、旧 published 数组、旧 article logs RPC、重复 transport fallback。删前确认无读取方。

## 明确不做

在本单文档一次改完所有页面；禁止先删旧数据。
