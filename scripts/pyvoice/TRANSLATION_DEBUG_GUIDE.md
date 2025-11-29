# 视频文件名翻译调试指南
Translation Debug Guide for Video Filename Translation

## 问题描述
部分文件名翻译成功，部分文件名翻译失败或只翻译了部分内容。

## 现在可以查看的调试信息

### 1. 详细翻译日志（默认开启）

运行脚本时，会自动显示每个文件的翻译详情：

```
[3/23] Processing: 第一课_单元音_xະ_xາ_ເxາະ_xໍ_和中辅音_ກ.mp4
  - Original filename: 第一课_单元音_xະ_xາ_ເxາະ_xໍ_和中辅音_ກ
  - Translating to English...
    [INFO] Translating: '第一课_单元音_xະ_xາ_ເxາະ_xໍ_和中辅音_ກ'
    [INFO] Text length: 29 chars
    [DEBUG] Translation Details:
      - Original text: 第一课_单元音_xະ_xາ_ເxາະ_xໍ_和中辅音_ກ
      - Translated text: 第一课_电影音_xẹ_xẫ_ịxặ_xệ_和中辅音_a
      - Detected source lang: zh-CN
      - Target lang: en
      - From cache: False
      - Pronunciation: None
    [SUCCESS] Translation completed
  - Sanitized: 第一课_电影音_xẹ_xẫ_ịxặ_xệ_和中辅音_a
  - Copying to: 第一课_电影音_xẹ_xẫ_ịxặ_xệ_和中辅音_a.mp4
  ✓ Success
```

### 2. 关键调试信息说明

| 字段 | 说明 |
|------|------|
| **Original text** | 原始文本 |
| **Translated text** | Google 翻译返回的结果 |
| **Detected source lang** | Google 检测到的源语言（zh-CN=简体中文） |
| **Target lang** | 目标语言（en=英语） |
| **From cache** | 是否来自缓存（True=缓存，False=新翻译） |
| **Pronunciation** | 发音标注（如果有） |

### 3. 翻译失败的常见原因

#### 原因1：特殊字符无法翻译
**现象**：文件名中包含老挝语字符（ໂ, ະ, ຶ, ື等），Google翻译无法正确识别

**示例**：
```
Original: 第一课_单元音_xະ_xາ_ເxາະ_xໍ_和中辅音_ກ
Translated: 第一课_电影音_xẹ_xẫ_ịxặ_xệ_和中辅音_a  ❌ 只翻译了部分
```

**解释**：老挝语字符（Unicode范围：U+0E80-U+0EFF）可能被Google翻译误识别或跳过

#### 原因2：混合语言翻译不完整
**现象**：文件名包含中文+英文+特殊符号，Google翻译只翻译了部分

**示例**：
```
Original: 第二十课_高辅音_ຫມ(ໝ)_ຜ
Translated: 第二十课_高超音_Mr  ❌ "第二十课"没有被翻译
```

#### 原因3：翻译API限制
**现象**：翻译速度过快，触发Google翻译限制

**查看方法**：看到以下信息表示遇到API限制
```
[WARNING] Translation API returned error: Too Many Requests
[RETRY] Attempt 2/3
```

**解决方法**：脚本会自动重试2次，每次间隔1秒

### 4. 使用不同的调试模式

#### 模式1：详细模式（默认）
显示所有翻译细节，包括缓存状态、语言检测等
```bash
python scripts/pyvoice/trim_and_concat_videos.py "D:\videos"
```

#### 模式2：静默模式
只显示重要信息，隐藏详细调试日志
```bash
python scripts/pyvoice/trim_and_concat_videos.py "D:\videos" --quiet
```

### 5. 翻译缓存位置

翻译结果会被缓存，避免重复翻译：
```
{wwwroot}/pycore_db/translator_cache/auto_to_en/{md5_hash}.json
```

**查看缓存**：
```bash
# Windows
dir %USERPROFILE%\wwwroot\pycore_db\translator_cache\auto_to_en

# Linux/Mac
ls ~/wwwroot/pycore_db/translator_cache/auto_to_en
```

**清空缓存**：
```bash
python -m pycore.pyutils.translator --clear-cache --src auto --dest en
```

### 6. 手动测试翻译

测试单个文件名的翻译效果：
```bash
python -m pycore.pyutils.translator \
    --text "第一课_单元音_xະ_xາ_ເxາະ_xໍ_和中辅音_ກ" \
    --src auto \
    --dest en \
    --output test_result.json
```

查看结果：
```bash
cat test_result.json
```

### 7. 改进建议

#### 方案1：分段翻译
将文件名按分隔符（_）拆分，逐段翻译，最后组合：
```
第一课 → Lesson 1
单元音 → Monogram
xະ_xາ → 保持原样（特殊字符）
和中辅音 → and middle consonant
ກ → 保持原样
```

#### 方案2：预定义映射表
创建常用术语的翻译映射表：
```python
TRANSLATION_MAP = {
    "第一课": "Lesson_1",
    "第二课": "Lesson_2",
    "单元音": "vowel",
    "辅音": "consonant",
    "高辅音": "high_consonant",
    "低辅音": "low_consonant",
    "中辅音": "middle_consonant",
    # ... 更多
}
```

#### 方案3：保留原始字符
检测到特殊语言字符（老挝语）时，保留原样不翻译：
```python
# 检测老挝语字符
import re
if re.search(r'[\u0E80-\u0EFF]', text):
    # 保留老挝语部分，只翻译中文部分
```

### 8. 当前翻译结果分析

根据你提供的日志：

| 原始文件名 | 翻译结果 | 状态 | 原因 |
|-----------|---------|------|------|
| concatenated_20251128_220322 | concatenated_20251128_220322 | ✅ 正确 | 已是英文 |
| 第七课_单元音_ໂxະ_ໂx_和_中辅音_ຢ | Lesson 7_Monogram_ໂxະ_ໂx_and_Middle Consonant_ຢ | ⚠️ 部分 | 老挝语字符保留 |
| 第二十课_高辅音_ຫມ(ໝ)_ຜ | 第二十课_高超音_Mr | ❌ 失败 | "第二十课"未翻译 |
| 第三课_单元音_xຶ_xື_和中辅音_ດ | Lesson 3_Monogram_x_x_and middle consonant_ດ | ⚠️ 部分 | 老挝语字符丢失 |

### 9. 下一步行动

1. **收集完整日志**：使用详细模式运行一次，保存完整输出
2. **分析翻译模式**：查看哪些术语翻译成功，哪些失败
3. **创建映射表**：为常用术语创建固定翻译
4. **测试改进方案**：选择方案1、2或3进行测试

## 需要帮助？

运行脚本并复制完整的翻译日志（包括 `[DEBUG]` 信息），我可以帮你分析具体的翻译问题。
