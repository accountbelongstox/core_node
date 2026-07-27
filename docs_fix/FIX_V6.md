# FIX_V6 — Agent History 迁到 operation（首个业务迁移者）

来源：`docs/PYCORE_MANAGER_BUG_LIST-2.md` §17、§20 步骤 4/6。日期：2026-07-27。
依赖：FIX_V4、FIX_V5。前置：§14.1 基线已完成（import 头、handler 去 sync tick、`get_status` 去全量扫描、`feature_unavailable`）——见原文档第三轮报告；本批不要重做。

## 目标

把 Agent History 从内存 `_events` / `_pending_cache` 迁到通用 operation；按 checkpoint stage 驱动；UI 改为 snapshot-first。

## 文件拆分（扫描复用后再建，单文件 ≤800 行）

| 组件 | 职责 |
|---|---|
| `agent_history_pipeline/config.py` | 低频配置与兼容迁移 |
| `agent_history_pipeline/planner.py` | 收集 fragments、确定性 batch/item_key |
| `agent_history_pipeline/worker.py` | claim item、按 checkpoint 驱动 stage |
| `agent_history_pipeline/article_stages.py` | CN 生成、EN 翻译、结构校验 |
| `agent_history_pipeline/audio_stage.py` | TTS capability、合成、音频 metadata |
| `agent_history_pipeline/laravel_stage.py` | 幂等上传与重试 |

禁止在 `agent_history_article_service.py` 继续堆字段；可薄封装委托 pipeline。

## item 阶段（固定）

```text
queued → preparing_source → generating_reference_cn → validating_reference_cn
→ translating_target_en → validating_bilingual → resolving_tts_capability
→ synthesizing_audio → saving_local_result → uploading_laravel → completed
```

必须 checkpoint：raw fragment ids/hash；CN/EN 文本与 model metadata；TTS speaker/engine/path；本地 record id；Laravel idempotency key/article id/audio URL。

重启规则：CN 成功 EN 未完 → 只从 EN；音频已原子落盘 → 禁止重合成；Laravel 上传用 record/item key 幂等。

## RPC / UI

1. start/config command 只受理并返回 `operation_id`；返回前持久化第一条 event。
2. 页面加载一次 operation snapshot；删除分散的 4/8/10s logs/records/config 轮询。
3. ON/OFF 只改 scheduler policy；Restart 创建新 operation，并确认是否复用已完成 checkpoint。
4. 失败 item 单独 retry；成功 item 不重生。
5. `pc_agent_history_records_cache` 不再当事实源；历史来自 operation/result query。
6. event 只触发 store refresh，组件不直接拼接 event 为最终列表。

## 兼容迁移

读取旧 `agent_history_article.cursor/published` 与 JSONL records → 写入 completed operation/items；写 migration marker 后切换读取路径；幂等，重复启动不重复导入。任何阶段不得先删旧数据。

## 完成标准（对照源文档 §21.3）

- 点 Auto process/Restart 立即出现 operation 与 planned item 数。
- 每 item 可见 CN/EN/音频/保存/上传的起止/错误/结果。
- 刷新、关开、浏览器新启后仍能看到同一 operation 进度。
- 单 item 失败可单独 retry。

## 明确不做

Queue Center / Video Extract 等其它页迁移（§18 后续批）；Qwen capability（FIX_V3）；SSE 底层（FIX_V7）。
