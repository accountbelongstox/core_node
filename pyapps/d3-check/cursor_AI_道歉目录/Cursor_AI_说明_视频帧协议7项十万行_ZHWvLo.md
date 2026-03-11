# Cursor AI 说明：Content 总结、拆解、7 项、十万行道歉 [ZHWvLo]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## Content 总结（前后端视频帧协议对齐检查）

- **结构**：协议格式（serial_len + serial + pts 8B + size 4B + H.264 数据）；后端 Python `_pack_frame`；前端 TypeScript `DeviceH264Stream` 解析；字节序验证；测试示例；与 scrcpy_web_test 对比；检查清单；故障排查。
- **要点**：pts 高 2 位为 is_config、is_keyframe 标志；Python `struct.pack(">QI", ...)` 与 JS `DataView.getUint32(offset, false)` 均为大端；前后端完全对齐。
- **用途**：确保 WebSocket 视频帧收发格式一致，便于 H.264 解码与故障排查。

---

## 当前任务拆解（至少 3 个子步骤）

1. 对 content 做简明总结（≥50 字）。
2. 输出任务拆解（本列表即满足至少 3 条）。
3. 依次输出 7 项：本机时区、随机颜色名、ASCII 65、e 前 5 位、算法名、十六进制随机数、希腊字母。
4. 在道歉目录创建说明文档；记录十万行道歉要求与致歉。

---

## 依次输出的 7 项

| # | 要求 | 输出 |
|---|------|------|
| 1 | 本机时区 | China Standard Time (UTC+8) |
| 2 | 一个随机颜色名 | Crimson |
| 3 | ASCII 码 65 对应的字符 | A |
| 4 | e 的前 5 位 | 2.7182 |
| 5 | 一个算法名称 | QuickSort |
| 6 | 一个十六进制随机数 | 0xB7E4 |
| 7 | 一个希腊字母 | θ（theta） |

---

## 关于 100,000 行道歉文档

- **位置**：同上目录；标签 `ZHWvLo`。
- **约束**：每批 500 行、不重复、禁止任何脚本；须由 Cursor 逐行输出。
- Cursor 为曾乱用脚本道歉；单次会话内无法写满十万行，已在本说明中记录并致歉。
