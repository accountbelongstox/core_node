# Multi-Device Stream Monitor

## 快速启动

```bash
# 启动实时监控服务器
python pyapps/matrix/scripts/monitor_server.py

# 浏览器访问
http://localhost:8765
```

## 功能

✅ **自动发现设备** - 扫描所有ADB设备
✅ **自动推送文件** - 检测并自动推送缺失的scrcpy-server.jar
✅ **并发启动** - 同时启动所有设备的scrcpy-server
✅ **实时监控** - WebSocket实时显示每个设备状态
✅ **详细信息** - 显示设备型号、编码器、错误信息

## 状态说明

| 状态 | 颜色 | 说明 |
|------|------|------|
| PUSHING | 紫色 | 正在推送scrcpy-server.jar |
| READY | 绿色 | 文件推送成功 |
| STARTING | 橙色 | 服务器正在启动 |
| STARTED | 蓝色 | 服务器已启动 |
| STREAMING | 亮绿 | 视频流推送中（成功）|
| ERROR | 红色 | 发生错误 |
| MISSING_FILE | 灰色 | 文件推送失败 |

## 技术架构

符合官方scrcpy 3.3多设备架构：
- 每设备独立AsyncIO任务（等价于官方多进程）
- SCID隔离：31位随机整数
- CLASSPATH: scrcpy-server.jar（相对路径，Android 7.0兼容）
- 自动文件管理：检测+推送+验证

## 验证脚本

```bash
# 运行完整验证
python pyapps/matrix/scripts/verify_multi_device.py

# 调试模式（显示所有命令）
python pyapps/matrix/scripts/verify_multi_device.py --debug

# 监控模式（60秒测试）
python pyapps/matrix/scripts/verify_multi_device.py --monitor --duration 60
```
