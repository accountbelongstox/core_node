# Voice Subtitle API - 后端报告 — 总结文档

对用户提供的 `<content>`（Voice Subtitle API 后端报告）的简明总结。

## 结构
- Markdown 报告：结论（后端无需修改）→ 问题概述（Remote 模式下多功能失效）→ 根本原因（前端将本地资源请求发往远程）→ 后端 API 验证（queue/categories/audio 测试与响应示例）→ 后端实现验证（/audio 端点代码片段）→ 前端修复总结（api.js 三处：getAudioUrl forceLocal、Code Sync forceLocal、addImage/addVoice 警告）→ 仅本地/可远程 API 分类表（各 13 个）→ 测试场景与后端建议 → 总结表与相关文档。

## 要点
- **结论**：后端实现正确，无需修改；问题由前端在 Remote 模式下错误使用 baseUrl 导致，已通过 forceLocal 与警告修复。
- **后端**：/voice-subtitle/queue、/categories、/audio 行为符合预期；/audio 使用 FileResponse 按本地 path 流式返回；队列返回 audio_path 为本地路径。
- **前端**：getAudioUrl 与 Code Sync 相关方法改为 forceLocal=true；addImage/addVoice 增加 JSDoc 与 console.warn 说明仅本地路径有效。
- **分类**：13 个仅本地 API（音频、剪贴板、截图、Code Sync、文件路径）；13 个可远程 API（队列、分类、任务等）。当前不需要远程播放音频的后端改动。

## 用途
记录 Voice Subtitle 在 Remote API 模式下的问题根因与前端修复方案，确认后端无需改动，供测试与后续维护参考。
