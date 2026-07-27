# FIX V9：其余 UI 按页迁移

## 1. 目标

每个 Pycore Manager 页面统一使用服务端持久 snapshot、V5 operation、V7 connection/events。禁止页面私有 progress store、reconnect、cursor、callback bus。

## 2. 必须先交付页面清册

从真实 route/page registry 逐页生成：

| 字段 | 内容 |
|---|---|
| page_key | 稳定页面身份 |
| component/route | 实际源码 |
| reads | snapshot/query routes |
| mutations | command + idempotency |
| long work | operation kind 或 none |
| topics | 精确 V7 topics |
| persistent state | 服务端字段 |
| presentation state | 浏览器字段 |
| migration status | 状态 |
| legacy removal | 待删 poller/store/SSE/cache |

必须覆盖实际注册的 dashboard/status、Agent History、Qwen/TTS、Laravel/log、service/runtime、settings/config 和所有其他页面，不以“能渲染”判完成。

## 3. 共享 page snapshot

字段：client_id、page_key、scope_key、revision、updated_at、data、active_operations、available_actions。

服务端保存跨新浏览器仍需要的 scope、operation association、语义 filter、必要 draft、last domain revision。expanded row、hover、临时校验、scroll 默认本地。secret、audio blob、无界 log、完整 operation history 不进 snapshot。

operation progress 只引用 operation_id，不复制，避免双真相源。

## 4. load/reconnect

1. 恢复 stable client_id。
2. WS welcome。
3. callback 只注册一次。
4. 请求 page snapshot + active operations。
5. replay last ACK 后事件。
6. event_id dedup，entity revision merge。
7. 接纳后 ACK。
8. 明示 offline/stale/reconnecting。
9. 重连校准，不重置 command/progress。

snapshot/replay 可竞态，任何到达顺序都必须正确。

## 5. command

本地校验；生成 request_id/idempotency；带 absolute deadline 发送；只禁冲突 action；显示 accepted operation_id；跟随 snapshot/events；timeout 后先查 idempotency/status 再允许 retry；终态只来自 server。transport timeout 是 unknown outcome。

## 6. 公共进度组件

支持 determinate/indeterminate、overall/item stage、counts、timeline、reconnecting/recovered、partial success、cancellation requested/cancelled、显式新 attempt retry、artifact/result、有限 error details。禁止页面复制不同 status 词汇。

## 7. subscription

使用 V7 callback；一 topic 可多订阅；确定性 cleanup；mount/reconnect 不倍增；异常进公共诊断；按 revision 更新 normalized entity cache；迁移页不直连 SSE。

## 8. 每页清理

- 仅为 progress 的 interval polling；
- direct WebSocket/EventSource；
- localStorage job/progress；
- singleton callback overwrite；
- 无 idempotency mutation；
- 页面私有 status vocabulary；
- 服务端 memory pending；
- handler 同步长任务；
- 重复 retry/reconnect timer。

只有公共契约完成后删除 legacy。

## 9. 跨页和权限

多页显示同一任务时引用同 operation_id/revision。导航不取消任务。全局 activity 只聚合不拥有。服务端按认证授权 client snapshot/event audience；不能伪造 client_id 读取别人 stream。

## 10. 顺序

1. 真实页面清册。
2. shared snapshot/operation/connection/progress adapter。
3. Agent History 做首个参考校准。
4. Qwen/TTS、Laravel。
5. 其余 long-running/control pages。
6. 需要 revision 的 read-only pages。
7. 删除 poller/SSE/重复 client。
8. 每行附验收证据后完成。

## 11. 验收

- 清册含全部注册页面。
- 任意页关闭再开可恢复。
- 新 tab 可见 active operation。
- 重连不重复 callback/command/terminal notice。
- 长任务统一 V5/V7，持久页面状态统一 V4。
- 无迁移页拥有 direct SSE/private WS/browser-only progress。