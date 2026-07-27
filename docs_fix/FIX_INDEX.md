# docs_fix 批号索引（来自 PYCORE_MANAGER_BUG_LIST-2）

源文档：`docs/PYCORE_MANAGER_BUG_LIST-2.md`（保留，未删除）。
本目录既有 `FIX_V1`（首轮问题清单）、`FIX_V2`（深层重构总览）；下列批号从第二轮重构清单拆出，供按批独立修复。

| 批号 | 文件 | 内容 | 依赖 |
|---|---|---|---|
| V3 | `FIX_V3.md` | Qwen speaker 能力契约 / batch 500 | 无 |
| V4 | `FIX_V4.md` | SQLite state store 地基 | 无 |
| V5 | `FIX_V5.md` | 通用 operation service | V4 |
| V6 | `FIX_V6.md` | Agent History → operation | V4+V5 |
| V7 | `FIX_V7.md` | RPC 语义 + 事件流 + callback | 建议 V5 后 |
| V8 | `FIX_V8.md` | Laravel 日志镜像链 | V4，建议 V7 |
| V9 | `FIX_V9.md` | 其余 UI 按页迁移清单 | V5+V6+V7 |

**建议实施顺序**：V3 ∥ V4 → V5 → V6 ∥ V7 → V8 → V9。

**已完成（勿重做）**：源文档 §20 第 1 步 / §14.1 基线（import 头、handler 去 sync tick、`get_status`、`feature_unavailable`）见 BUG_LIST-2 第三轮报告。

历史清单 §1–§11 与“全部已修”结论已被第二轮复核查否；修复以 V3–V9 及源文档 §12–§21 为准。
