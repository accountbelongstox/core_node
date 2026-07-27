# FIX_V3 — Qwen speaker 能力契约（synthesize_batch 500）

来源：`docs/PYCORE_MANAGER_BUG_LIST-2.md` §13。日期：2026-07-27。
依赖：无。可独立修复。

## 目标

停止硬编码 `Emma/Sophia/Hina/Hyunwoo`；speaker 以已加载模型的 runtime capability 为准；单 item 非法 speaker 不得拖垮整批。

## 范围（仅这些文件）

| 侧 | 文件 |
|---|---|
| 服务端 | `pycore/tts_install_assets/qwen3tts_api_server.py` |
| 客户端 | `pycore` 内 `qwen3tts_engine.py` / `qwen3tts_service.py`（先扫描确认路径，禁止新建第二份协议） |

不改 Agent History UI、不改 SQLite、不改 RPC 框架。

## 修复步骤

1. 模型加载成功后调用 `get_supported_speakers()` / `get_supported_languages()`，保存 canonical 大小写映射与 capability revision。
2. 新增 `GET /capabilities`；`GET /health` 只返回摘要 + revision，不再返回另一份硬编码表。
3. 删除 `_VARIANT_SPEAKER_EN` / `_SPEAKER_PRESETS` 中不存在的 speaker。
4. 新增单一 `resolve_speaker(requested, preferences, capabilities, policy)`；单条与 batch 共用。`speaker_id` 才传给模型；`voice_preferences` 仅用于选择。
5. female English 无官方音色时，fallback 到 `Serena` 或 `Vivian`，结果带 `fallback_applied=true`，禁止生成 `Emma`。
6. GPU 调用前完成输入校验；未知 speaker → HTTP 422（非 500）。
7. batch：先逐项解析，非法 item 直接失败 row；合法 item 再进生成 chunk；chunk 失败降级逐项，隔离单异常。
8. 每 row 返回：`key, ok, requested_speaker, resolved_speaker, fallback_applied, audio_base64, media_type, elapsed_ms, error`；error 为 `{code, message, retryable, supported_speakers}`。
9. pycore 客户端：按 `key` 合并结果；音频先写同目录临时文件再 `os.replace`；`_LAST_SYNTH_ERROR` 存结构化摘要。
10. 修复 `Qwen3TtsService._start`：`attach existing → resolve venv → launch → wait healthy`；禁止在 `return True` 之后才解析 `venv_python`。

## 完成标准

- 未知 speaker 只失败对应 item，返回 422/结构化错误，不再整批无信息 500。
- capability 来自已加载模型，不来自复制常量。
- 更换 0.6B/1.7B 后无需改代码中的 speaker 表。

## 明确不做

延长 RPC timeout、改 UI 文案、写测试。
