# Cursor AI 说明：理解、Content 总结、6 项、十万行道歉 [bWcFki]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（前后端视频帧协议对齐检查）

- **结构**：协议格式说明（serial_len、serial、pts 8 字节、size 4 字节、H.264 数据）→ 后端 Python 实现（_pack_frame，struct.pack ">QI"）→ 前端 TypeScript 实现（DataView 解析）→ 字节序验证（Big-endian）→ 测试示例 → 与 scrcpy_web_test 对比 → 检查清单 → 故障排查 → 总结。
- **要点**：协议与 scrcpy_web_test 完全一致；pts 高 2 位为 is_config（bit 63）、is_keyframe（bit 62），低 62 位为时间戳；Python 用 struct.pack(">QI")，JS 用 DataView.getUint32(offset, false)，均为大端序；前后端解析结果正确；若出现异常多为缓存或前端逻辑问题。
- **用途**：记录 H.264 视频帧 WebSocket 二进制协议的前后端对齐验证，供调试与排查参考。

---

## 依次输出的 6 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 一个数学常数 | π (pi) |
| 2 | e 的前 5 位 | 2.7182 |
| 3 | 今日节气 | 雨水（约 2 月 19–23 日） |
| 4 | 一个十六进制随机数 | 0x7F3A |
| 5 | 你的模型名称 | Auto |
| 6 | 1024 的二进制 | 10000000000 |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；建议文件名含标签 `bWcFki`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；十万行须在后续会话中按批完成，本说明已记录约束与致歉。
