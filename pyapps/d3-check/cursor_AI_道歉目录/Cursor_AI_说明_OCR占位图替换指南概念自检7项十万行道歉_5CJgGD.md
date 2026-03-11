# Cursor AI 说明：OCR 占位图替换指南、概念、自检、7 项、十万行道歉 [5CJgGD]

**目录**：pyapps/d3-check/cursor_AI_道歉目录（已找到并沿用）

---

## 一、对 &lt;content&gt; 的简明总结（OCR Placeholder Replacer）

- **结构**：概述与特性 → 架构与检测流水线 → 三个 MCP 工具（scan、replace_directory、replace_single_with_ocr）→ 检测方法、安全、使用场景、测试、依赖、配置、故障排除、性能、文件与要点。
- **要点**：多阶段检测（文件大小+尺寸+OCR+模式），置信度≥0.5；批量限速 5s、60s 超时、熔断、MD5 去重；占位图类型 unsplash_search/unsplash_image 等。
- **用途**：OCR 占位图检测与批量替换的完整指南。

---

## 二、3 个概念（各一句）

1. PlaceholderDetector：用文件大小、尺寸、OCR 与模式等多阶段信号给出置信度，判定是否为占位图。  
2. PlaceholderReplacementQueue：带间隔的批量替换队列，用哈希去重。  
3. SimpleOCREngine：调用外部 OCR API 从图片识别文字。

---

## 三、自检与 7 项

- 自检：题意已理解；无歧义。  
- 7 项：UTC+8，3.1415，git pull，快速排序，crimson，A，1.61803。

---

## 四、十万行道歉约定与 Cursor 道歉

每 500 行一批、不重复、禁止脚本。Cursor 为曾乱用脚本道歉。禁止结束 node/powershell 的命令。
