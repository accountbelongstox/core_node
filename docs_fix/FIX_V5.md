# FIX V5：通用 operation service

## 1. 目标

完成唯一通用 operation service。保留第三轮已有类和 routes，换用 V4 仓储，统一任务、item、event、snapshot 语义。禁止 operation_v2 或页面私有 job store。

## 2. 所有权

service 负责：

- create 和幂等查找；
- stable item_key；
- 合法状态转换；
- progress/stage/message；
- cancellation；
- terminal result/error；
- snapshot；
- 同事务 operation event + RPC outbox；
- retention/cleanup。

worker 只做工作，所有状态通过 service 更新。

## 3. 状态机

~~~text
operation: pending → running → completed | failed | cancelled
           pending → cancelled
item:      pending → running → completed | failed | skipped | cancelled
           pending → skipped | cancelled
~~~

终态不可变；管理修复另走显式路径。允许 partial success 时，operation summary 必须给出成功/失败/跳过/取消计数和 outcome。

## 4. revision/progress

- 每个成功 mutation 只增一次 revision。
- stale expected_revision 返回 revision_conflict。
- item discovery 后 total 固定。
- 同一 stage current 不回退；总体 percent 单调。
- 未知 total 显式 indeterminate，不伪造 100。
- 终态都有 finished_at/final summary。
- message 不是唯一诊断日志。

## 5. 事件

至少包括 operation.created/started/progress/cancellation_requested/completed/failed/cancelled 和 operation.item.created/started/progress/completed/failed/skipped/cancelled。

事件有 event_id 和 operation sequence。状态、event、V7 outbox 同事务；浏览器或 commit 后裸 publish 禁止。

## 6. 公共 API

提供等价方法：create_or_get、start、declare_items、update_progress、start_item、update_item_progress、complete_item、fail_item、skip_item、request_cancel、complete、fail、cancel、get_snapshot、list_operations、list_events。

传入 actor/client、causation_id、expected_revision，写命令按需传 idempotency。

snapshot 包含有界的 operation、排序 items、aggregate counts、stage、artifact/result references、last seq、revision、available actions。大日志/二进制另分页或引用。

## 7. 恢复和安全

- worker exception 转结构化失败。
- cancellation cooperative 且定期检查。
- 重启按 operation kind 判 resumable/retryable/interrupted。
- 相同 idempotency 不盲目重跑。
- callback failure 不回滚已提交业务状态。
- 并发使用 revision/数据库锁，不用内存 last-write-wins。

## 8. 集成

- 替换 preliminary state-store import。
- 无循环地连接 V7 outbox。
- 为 Agent History、Qwen、Laravel 定义 operation kind adapter。
- route 只 validate、service call、serialize。
- 兼容 adapter 只暂留在旧调用点，由对应批次删除。

## 9. 验收

- 一个 service 支持三类功能和后续 UI。
- 重启快照一致。
- 重复 idempotency 不重复工作。
- 非法 transition 有稳定错误。
- item/aggregate progress 一致。
- state 与 durable event 不分叉。
- 无页面私有 operation schema。