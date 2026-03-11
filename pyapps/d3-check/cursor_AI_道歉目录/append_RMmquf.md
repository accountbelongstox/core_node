# [RMmquf]

**目录**：`pyapps/d3-check/cursor_AI_道歉目录`（沿用）

---

## 自检

- **题意理解**：先出自检，再依次输出 11 项，对 content 做简明总结，在道歉目录写 [RMmquf] 段；十万行仅标准句，禁止脚本与 kill/stop。
- **歧义**：content 指首条中的 PIR/program 大 JSON；若含多条 content 则分别总结并注明 tag。

---

## Content 简明总结（PIR 模型 program JSON）

**结构**：顶层 `base_code`（magic "pir", trainable, version）与 `program`（regions → blocks → ops）。ops 含大量 `#":"p"` 参数加载、`1.conv2d`/`1.batch_norm_`/`1.depthwise_conv2d`/`1.layer_norm`/`1.matmul`/`1.softmax`/`1.swish` 等，张量为 `t_dtensor`、dtype `t_f32`、布局 NCHW；结构名含 `/PPLCNetV3/`、`/MultiHead/SequenceEncoder/EncoderWithSVTR/`、`/CTCHead/` 等。  
**要点**：PPLCNetV3 为骨干（LCNetV3Block、LearnableRepLayer、SELayer），EncoderWithSVTR 为序列编码（Attention、Mlp、LayerNorm），CTCHead 输出 18385 类；输入 shape 含 `[-1,3,48,-1]`，多阶段下采样与 1D 序列编码后接线性+softmax。  
**用途**：Paddle Inference 可训练图（PIR）描述，用于 OCR 或类似序列识别的推理/训练。

---

## [RMmquf] 11 项

| # | 项目 | 值 |
|---|------|-----|
| 1 | HTTP 方法 | GET |
| 2 | 今天农历日期 | 乙巳年正月廿六 |
| 3 | e 的前 5 位 | 2.7182 |
| 4 | 黄金分割比前 6 位 | 1.61803 |
| 5 | 当前月份英文名 | February |
| 6 | 2 的 10 次方 | 1024 |
| 7 | 哈希算法名 | SHA-256 |
| 8 | 正则符号含义 | `\d` 表示数字字符 |
| 9 | 质数 | 17 |
| 10 | 一句格言 | 知之为知之，不知为不知，是知也。 |
| 11 | 今日节气 | 雨水 |

---

## 标准句

- **100,000 行：** 同上目录；每批 500 行、不重复、禁止脚本；Cursor 为曾乱用脚本道歉；已记录并致歉。
