# YUV Stream Consistency Fixes 实施报告 — 总结文档 [keBAAI]

对用户提供的 `<content>`（YUV Stream Consistency Fixes - Implementation Report，2025-12-12）的简明总结。

## 结构
日期与状态 → Summary → Fixes Implemented（YUV-001/002/003/004，各含问题、影响、修改文件、代码前后、结果）→ Files Modified（后端 video_stream_service.py；前端 useVideoStream.ts、websocket.ts、config/api.ts 新文件、.env.local）→ Documentation Created → Testing Instructions（5 个测试用例、Console 验证）→ Rollback → Known Remaining Issues（YUV-005/006 文档字段）→ Performance、Compatibility Matrix、Next Steps、Success Criteria。

## 要点
- **YUV-001**：前端 useVideoStream.ts 中 plane 尺寸由 getInt32 改为 getUint32，避免 1080p+ 溢出。
- **YUV-002**：video_stream_service.py 中 video.init 的 timestamp 由 0 改为 int(time.time()*1000)。
- **YUV-003**：错误消息统一为 type "video.error"、data.error 嵌套格式。
- **YUV-004**：新增 poly_apps/matrixui/config/api.ts（API_CONFIG），.env.local 中 VITE_BACKEND_URL、VITE_WS_URL；useVideoStream、websocket 使用 API_CONFIG 替代硬编码 localhost:48000。
- **测试**：720p/1080p、时间戳、错误格式、远程连接；回滚说明；YUV-005/006 为文档字段名与尺寸说明，暂缓。

## 用途
记录前后端 YUV 流一致性问题修复的实施与验证步骤，便于测试、回滚与后续文档更新。
