# FIX V6：Agent History 迁到 operation

## 1. 目标

完成已有 Agent History pipeline 对 V5 operation 和 V7 event stream 的迁移。展示详细启动、每 item 双语短文、音频生成、终态结果；UI 断开、新启动和 Pycore 重启均可恢复。

## 2. 勿重做

保留 import/cycle、handler 去重活、get_status 去全扫描、pipeline/checkpoint、feature_unavailable 修复。禁止把工作塞回 RPC handler。

## 3. operation 模型

一次 Auto process history 是一个 operation；每个 source/history record 是稳定 item_key。建议 stage：

1. initialize
2. discover
3. extract
4. normalize
5. generate_bilingual_text
6. synthesize_audio
7. persist_result
8. finalize

item 记录当前 stage/progress、中文/英文结果状态、audio 状态、artifact、warning、error。

## 4. 详细启动日志

开工前持久化并发布：

- request accepted、idempotency；
- 脱敏配置；
- source scope/filter；
- discovered count；
- text model、TTS engine/capability revision；
- cache hit/miss plan；
- worker/queue allocation；
- resume/recovery decision；
- operation started。

仅一行 Started 不合格。日志带 operation_id/stage/count，不含 secret、完整敏感 prompt、binary。

## 5. 每 item 进度

UI 必须看到：

- queue position；
- extract start/complete；
- text start 和真实/indeterminate progress；
- 中英文完成及结果引用；
- audio queued；
- voice/capability；
- synthesis start/progress；
- audio metadata；
- completed/failed/skipped/cancelled；
- elapsed 和结构化 error。

引擎无百分比就报告 stage + indeterminate，不伪造。

## 6. checkpoint/recovery

checkpoint 是 database 中 operation/item 状态，不是浏览器或临时扫描。

Pycore 重启：查询 nonterminal；校准 artifact/checkpoint；resume 或显式 interrupted；重建 aggregate；发布 recovery event；只按原 idempotency/cancel policy 继续。

UI 启动：取 snapshot 并重放，按 revision/seq merge，不触发重跑。

## 7. routes 与 UI

薄 route 支持 start、get snapshot、分页 recent operations/events、cancel、显式 retry failed items、artifact metadata。get_status 中不得 extract、扫描、模型或同步 synthesis。

页面显示 overall、item counts、逐 item timeline、双语状态、音频和播放引用、offline/recovered、cancel/retry、server revision/time。浏览器只保存展示偏好。

## 8. 失败语义

单 item 失败不隐藏成功；Qwen speaker 使用 V3 结构化错误；model/synthesis/storage/cancel 分 code；retry 形成新 attempt，不覆盖原历史；summary 显示 partial success；callback failure 不影响 worker。

## 9. 验收

- 启动 timeline 有完整初始化事实。
- 每 item 有双语和音频全过程及结果。
- 断线/新 UI 可恢复。
- Pycore 重启可恢复或明确终止，不静默丢失。
- handler/get_status 无重活和全目录扫描。
- 所有状态来自 V5。