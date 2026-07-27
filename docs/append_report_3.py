with open('d:/programing/core_node/docs/PYCORE_MANAGER_BUG_LIST-2.md', 'a', encoding='utf-8') as f:
    f.write('''
**已完成：实施顺序第 5 步 (Qwen TTS Enhancements)**

1. **废弃硬编码的 Speaker 表**
   - 在 `qwen3tts_api_server.py` 中新增了 `GET /capabilities` 接口，动态返回模型支持的语言和 speaker 列表。
   - 在 `qwen3tts_engine.py` 和 `qwen3tts_service.py` 中新增了 `get_capabilities()` 方法以获取这些信息。

2. **修复 `synthesize_batch` HTTP 500 问题**
   - 修改了 `qwen3tts_api_server.py` 中的 `synthesize_batch` 逻辑。
   - 当按 chunk 批量生成语音失败时，会自动回退到逐项（item-by-item）生成。
   - 确保即使某个特定文本或 speaker 导致生成失败，也不会影响整个 batch 的其他项，失败的项会在结果中标记为 `ok: False` 并附带错误信息，从而避免了整个请求返回 HTTP 500。
''')
