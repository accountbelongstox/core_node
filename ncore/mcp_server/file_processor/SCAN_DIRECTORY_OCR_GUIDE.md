# 目录扫描 OCR 功能使用指南

## 功能概述

`scan_directory_and_ocr` 方法用于扫描指定目录下的所有图片文件，并对每张图片进行 OCR 识别，返回完整的识别结果映射表。

## 主要特性

- ✅ **递归扫描**: 支持扫描子目录，可配置最大深度
- ✅ **深度控制**: 默认扫描深度为 3 层，可自定义或设为 0（无限制）
- ✅ **自动识别**: 自动识别常见图片格式（PNG, JPG, GIF, BMP, WEBP 等）
- ✅ **批量处理**: 一次性处理目录下所有图片
- ✅ **结果映射**: 返回 filepath -> OCR结果 的完整映射
- ✅ **错误处理**: 单个文件失败不影响其他文件处理
- ✅ **详细统计**: 提供扫描和识别的详细统计信息

## 方法签名

```python
def scan_directory_and_ocr(
    directory_path: str,              # 必需：目录路径
    max_depth: int = 3,               # 可选：最大扫描深度（默认3，0=无限）
    ocr_engine: str = "auto",         # 可选：OCR引擎（auto/free/tencent）
    language: str = "chs",            # 可选：识别语言（chs/eng/auto）
    recursive: bool = True,           # 可选：是否递归扫描子目录
    image_extensions: Optional[List[str]] = None  # 可选：自定义图片扩展名
) -> Dict[str, Any]
```

## 参数说明

### directory_path (必需)
- 要扫描的目录路径
- 支持相对路径和绝对路径
- 示例: `"D:/images"` 或 `"./screenshots"`

### max_depth (可选, 默认: 3)
- 最大扫描深度
- `0`: 无限制深度，扫描所有子目录
- `1`: 仅扫描指定目录，不扫描子目录
- `2`: 扫描指定目录及其直接子目录
- `3`: 扫描到第三层子目录（默认）

### ocr_engine (可选, 默认: "auto")
- OCR 识别引擎
- `"auto"`: 自动选择最佳引擎（推荐）
- `"free"`: 使用免费 OCR.space API
- `"tencent"`: 使用腾讯云 OCR（需要配置密钥）

### language (可选, 默认: "chs")
- OCR 识别语言
- `"chs"`: 简体中文
- `"eng"`: 英文
- `"auto"`: 自动检测语言

### recursive (可选, 默认: True)
- 是否递归扫描子目录
- `True`: 递归扫描（受 max_depth 限制）
- `False`: 仅扫描指定目录

### image_extensions (可选)
- 自定义要扫描的图片扩展名
- 默认: `['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.webp', '.tiff', '.tif']`
- 示例: `['.png', '.jpg']` 仅扫描 PNG 和 JPG

## 返回值结构

```json
{
  "success": true,
  "scanned_files": 4,
  "ocr_results": {
    "D:/images/image1.png": {
      "success": true,
      "text": "识别的文本内容...",
      "confidence": 85.5,
      "provider": "FreeOCR",
      "word_count": 120,
      "processing_time": 2.5
    },
    "D:/images/image2.jpg": {
      "success": true,
      "text": "另一张图片的文本...",
      "confidence": 90.0,
      "provider": "FreeOCR",
      "word_count": 95,
      "processing_time": 2.3
    },
    "D:/images/image3.png": {
      "success": false,
      "error": "OCR processing failed"
    }
  },
  "errors": [
    {
      "file": "D:/images/image3.png",
      "error": "OCR processing failed"
    }
  ],
  "summary": {
    "total_files": 4,
    "successful": 3,
    "failed": 1,
    "scan_path": "D:/images",
    "max_depth": 3,
    "recursive": true,
    "ocr_engine": "auto",
    "language": "chs"
  }
}
```

## 使用示例

### 示例 1: 基础使用（使用默认参数）

```python
# 扫描目录，使用默认深度3，自动选择OCR引擎
result = scan_directory_and_ocr(
    directory_path="D:/screenshots"
)
```

### 示例 2: 仅扫描当前目录（不递归）

```python
# 仅扫描指定目录，不扫描子目录
result = scan_directory_and_ocr(
    directory_path="D:/screenshots",
    max_depth=1,
    recursive=False
)
```

### 示例 3: 无限深度扫描

```python
# 扫描所有子目录，无深度限制
result = scan_directory_and_ocr(
    directory_path="D:/project/images",
    max_depth=0,  # 0 表示无限制
    recursive=True
)
```

### 示例 4: 自定义 OCR 配置

```python
# 使用腾讯云OCR，识别英文
result = scan_directory_and_ocr(
    directory_path="D:/documents",
    max_depth=2,
    ocr_engine="tencent",
    language="eng"
)
```

### 示例 5: 仅扫描特定图片格式

```python
# 仅扫描 PNG 和 JPG 文件
result = scan_directory_and_ocr(
    directory_path="D:/photos",
    max_depth=3,
    image_extensions=['.png', '.jpg', '.jpeg']
)
```

## 实际应用场景

### 场景 1: 功能截图分析

```python
# 扫描功能截图目录并生成功能清单
result = scan_directory_and_ocr(
    directory_path="D:/project/docs/func_screenshot",
    max_depth=1,
    language="chs"
)

# 提取所有识别的文本
all_text = []
for filepath, ocr_data in result['ocr_results'].items():
    if ocr_data['success']:
        all_text.append({
            'file': filepath,
            'text': ocr_data['text']
        })
```

### 场景 2: 文档批量识别

```python
# 批量识别扫描的文档
result = scan_directory_and_ocr(
    directory_path="D:/scanned_documents",
    max_depth=0,  # 扫描所有子目录
    ocr_engine="tencent",  # 使用更准确的OCR
    language="chs"
)

# 生成识别报告
print(f"Total files: {result['summary']['total_files']}")
print(f"Successful: {result['summary']['successful']}")
print(f"Failed: {result['summary']['failed']}")
```

### 场景 3: 错误处理

```python
result = scan_directory_and_ocr(
    directory_path="D:/images",
    max_depth=3
)

if result['success']:
    # 处理成功的识别结果
    for filepath, ocr_data in result['ocr_results'].items():
        if ocr_data['success']:
            print(f"✓ {filepath}: {len(ocr_data['text'])} characters")
        else:
            print(f"✗ {filepath}: {ocr_data['error']}")

    # 查看统计信息
    summary = result['summary']
    print(f"\nSummary: {summary['successful']}/{summary['total_files']} files processed")
else:
    print(f"Error: {result['error']}")
```

## 性能优化建议

1. **控制扫描深度**: 设置合理的 `max_depth` 避免扫描过多文件
2. **限制文件类型**: 使用 `image_extensions` 参数仅扫描需要的格式
3. **分批处理**: 对于大量文件，可以分目录多次调用
4. **选择合适的引擎**:
   - `"auto"`: 适合大多数场景
   - `"free"`: 免费但有速率限制
   - `"tencent"`: 更准确但需要配置

## 注意事项

1. ⚠️ **速率限制**: Free OCR 有每月请求限制，大量文件建议配置腾讯云 OCR
2. ⚠️ **文件大小**: 图片会自动压缩以满足 OCR 引擎限制
3. ⚠️ **处理时间**: OCR 处理需要时间，大量文件请耐心等待
4. ⚠️ **中文路径**: 支持中文路径，自动进行路径规范化

## 对比旧方法

### 旧方法 (smart_ocr_recognize)
```python
# 需要手动提供文件列表
smart_ocr_recognize(
    file_paths=["file1.png", "file2.png", "file3.png"],
    wait_for_completion=True
)
```

**问题**:
- ❌ 需要手动收集文件列表
- ❌ 批量处理可能失败
- ❌ 没有直接的结果映射

### 新方法 (scan_directory_and_ocr)
```python
# 自动扫描目录并处理
scan_directory_and_ocr(
    directory_path="D:/images",
    max_depth=3
)
```

**优势**:
- ✅ 自动扫描和发现文件
- ✅ 可控的深度递归
- ✅ 直接返回 filepath -> result 映射
- ✅ 详细的错误报告和统计

## 故障排查

### 问题: 返回 "OCR system not available"
**解决**: 检查 OCR 引擎是否正确安装和初始化

### 问题: 返回 "Directory not found"
**解决**: 检查目录路径是否正确，支持相对和绝对路径

### 问题: 扫描到0个文件
**解决**:
1. 检查 `recursive` 是否设为 True
2. 检查 `max_depth` 是否足够
3. 检查 `image_extensions` 是否包含目标格式

### 问题: 部分文件识别失败
**解决**:
1. 查看 `errors` 数组了解具体错误
2. 尝试使用不同的 `ocr_engine`
3. 检查图片质量和大小

## 更新日志

- **2025-11-04**: 新增 `scan_directory_and_ocr` 方法
  - 支持目录扫描和批量 OCR
  - 可配置扫描深度（默认3）
  - 返回完整的 filepath -> result 映射表
  - 提供详细的统计信息和错误报告
