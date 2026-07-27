# FIX_V4 — SQLite state store 地基

来源：`docs/PYCORE_MANAGER_BUG_LIST-2.md` §16.1–16.2、§19.1。日期：2026-07-27。
依赖：无。后续 FIX_V5/V6 依赖本批。

## 目标

在 `pyfoundations` 增加独立 SQLite store，承接高频 operation/item/event；`user_data.json` 只保留低频配置。

## 范围

新建（仅标准库 `sqlite3` + 更低层 pyfoundations；禁止 import `pyutils`/`pyctl`/`callmodule`）：

```text
pycore/pyfoundations/state_store/__init__.py
pycore/pyfoundations/state_store/schema.py
pycore/pyfoundations/state_store/models.py
pycore/pyfoundations/state_store/repository.py
```

库文件建议：`pycore_state.sqlite3`（app local data 目录），WAL + 事务 + 单 owner thread。

## 最小 schema

| 表 | 用途 |
|---|---|
| `operations` | 一次可恢复工作 |
| `operation_items` | 每个短文/音频/文件等 item |
| `operation_events` | 结构化事件与 UI 增量（含单调 `seq`） |
| `ui_snapshots` | 跨 UI 启动恢复的视图状态 |
| `consumer_offsets` | 可选跨连接消费水位 |
| `remote_cursors` | Laravel logs 等远程增量镜像 |

字段以源文档 §16.2 为准。状态枚举固定：

```text
queued -> running -> succeeded
queued/running -> cancel_requested -> cancelled
running -> retry_wait -> queued
running -> interrupted -> queued or failed
```

禁止从 `running` 直接跳回 `queued` 且不记原因；每次转换必须在事务内同时 bump `revision` 并写 event。

## 修复步骤

1. 实现 schema migration（版本号表 + 幂等升级）。
2. repository 提供基础 CRUD：create/get/list operation、upsert item、append event（返回新 seq）、get/put snapshot、get/put cursor。
3. 启动时 open DB、跑 migration、recover：过期 lease 的 running item → `interrupted`。
4. 不在本批接入任何业务（Agent History / Queue Center）；只交付可 import、可 open、可写读的 store。

## 完成标准

- `from pycore.pyfoundations.state_store import ...` 可导入，无上层依赖。
- 能创建一条 operation + item + event，重启进程后仍可读，seq 单调不归零。
- `user_data.json` 本批零改动。

## 明确不做

operation service API、Agent History 迁移、前端、Laravel。
