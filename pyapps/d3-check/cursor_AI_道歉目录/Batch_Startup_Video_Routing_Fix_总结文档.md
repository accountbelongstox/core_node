# Batch Startup Video Frame Routing Fix 总结文档

本文档对用户提供的《Fixed: Batch Startup Video Frame Routing Issue》做简明总结。

## 结构概览
- 文档为 Markdown，含问题摘要（两则）、解决方案（两处修复）、涉及文件与代码变更、预期日志、前端需改项、测试步骤、后续与回滚、总结。

## 要点
- **问题一**：批量启动时视频帧被发到 RPC WebSocket（/rpc/ws），前端将 Blob 当 JSON 解析导致 SyntaxError。根因：batch_start 把 RPC WebSocket 订阅为视频接收端。
- **修复一**：RPC 与视频 WebSocket 分离。`batch_start_streams(serials, websocket=None)` 不再传入 WebSocket；DeviceStreamThread 的 websocket 改为 Optional，仅在传入时才加入 stream_clients；前端在批量启动完成后单独连接 `ws://.../video/{device_id}` 接收视频帧。
- **问题二**：JAR 推送失败时仅用 stderr，常为空，导致 "Jar push failed:" 无详情。
- **修复二**：错误信息改为 `stderr.strip() or stdout.strip() or f"returncode={returncode}"`，便于排查 ADB/权限等问题。
- **涉及文件**：pyapps/matrix/services/video_stream_service.py（DeviceStreamThread、batch_start_streams、JAR 错误）、pyapps/matrix/api/main.py（batch_start 调用处传 None）。

## 用途
供开发与测试快速了解批量启动视频路由修复与 JAR 错误改进，以及前端需做的视频 WebSocket 连接与测试验证步骤。
