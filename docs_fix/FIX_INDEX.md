# FIX 执行索引

## 1. 使用方式

本索引是剩余 Pycore Manager 修复的唯一执行顺序。docs/PYCORE_MANAGER_BUG_LIST-2.md 只保留当前基线，不再作为历史上下文提示词。

## 2. 批次

| 批次 | 文档 | 结果 | 依赖 |
|---|---|---|---|
| V3 | docs_fix/FIX_V3.md | Qwen3TTS 使用 RPC v2 WS 和主动 job/item 事件。 | V4、V7 |
| V4 | docs_fix/FIX_V4.md | 持久化统一到修复后的 pycore/database。 | 无 |
| V5 | docs_fix/FIX_V5.md | 一个 operation service 管理 job/item/event/snapshot。 | V4 |
| V6 | docs_fix/FIX_V6.md | Agent History 完成详细进度、结果和恢复。 | V5、V7 |
| V7 | docs_fix/FIX_V7.md | 统一 WS、outbox、ACK/replay、callback。 | V4、V5 |
| V8 | docs_fix/FIX_V8.md | Laravel 最后更新日志持久镜像并返回 UI。 | V5、V7 |
| V9 | docs_fix/FIX_V9.md | 所有剩余 UI 使用统一持久状态架构。 | V3、V6、V8 |
| V10 | docs_fix/FIX_V10.md | pyfoundations 中较高层模块全部归位。 | V9 |
| S1 | docs_fix/FIX_20260727_1635.md | 规范横向合规扫描：>800行拆分、`__init__`重活、127处局部import、database外直接驱动、SSE收敛、deprecated删除。 | 按节并入 V4/V7/V10 |

## 3. 顺序

~~~text
V4
└─ V5
   └─ V7
      ├─ V3
      ├─ V6
      └─ V8
         └─ V9
            └─ V10
~~~

V3、V6、V8 可并行。V10 不与行为修复混做；仅 state_store 按 V4 提前移出。S1 不单独执行：B1/C 节并入 V4，F 节并入 V7，`database_base.py` 迁出并入 V10，E 节（`__init__` 重活）可随时先做。

## 4. 已有实现处理规则

实现者先按现状分类：

- 已正确：保留；
- 概念正确但层级错误：迁移，不重写行为；
- 集成未完成：补齐；
- 重复冲突：合并到公共实现并删除重复。

禁止创建 operation_v2、state_store_v2、qwen_ws_private 或第二套 RPC client。

## 5. 每批交付

交接必须列出：

- 修改文件；
- schema/migration 标识；
- 新增/删除公共契约；
- 暂留兼容行为；
- 明确转交后续批次的事项；
- 对应验收场景的证据。

不得粘贴历史调查内容。

## 6. 共同禁令

- pyfoundations 中无持久化。
- database 外无直接数据库驱动。
- Qwen 无新增 HTTP 合成或 fallback。
- SSE 无新增依赖。
- 浏览器不是真实进度来源。
- 持久事件必须先提交数据库再发送。
- socket 地址不是 client_id。
- RPC 无无限等待。
- 单个 callback 失败不能中断分发。
- 事件 JSON 不放大体积音频 base64。