# 🚀 scan_directory_and_ocr - 快速参考

## ⚡ 最简使用

```python
# 扫描目录并 OCR 所有图片
result = scan_directory_and_ocr(
    directory_path="D:/screenshots"
)
```

## 📖 常用场景

### 场景 1: 仅扫描当前目录
```python
scan_directory_and_ocr(
    directory_path="./images",
    max_depth=1,
    recursive=False
)
```

### 场景 2: 无限深度递归
```python
scan_directory_and_ocr(
    directory_path="D:/project",
    max_depth=0  # 0 = 无限制
)
```

### 场景 3: 仅扫描特定格式
```python
scan_directory_and_ocr(
    directory_path="D:/photos",
    image_extensions=['.png', '.jpg']
)
```

## 📦 返回值速查

```python
result = {
    "success": bool,              # 总体成功状态
    "scanned_files": int,         # 扫描到的文件数
    "ocr_results": {              # 文件映射
        "filepath": {
            "success": bool,      # 该文件是否成功
            "text": str,          # 识别的文本
            "confidence": float,  # 置信度
            "provider": str,      # OCR引擎
            "word_count": int,    # 字数
            "processing_time": float
        }
    },
    "errors": [...],              # 失败的文件列表
    "summary": {                  # 统计摘要
        "total_files": int,       # 总文件数
        "successful": int,        # 成功数
        "failed": int            # 失败数
    }
}
```

## 🎯 核心参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `directory_path` | (必需) | 目录路径 |
| `max_depth` | 3 | 扫描深度 |
| `ocr_engine` | "auto" | OCR引擎 |
| `language` | "chs" | 识别语言 |
| `recursive` | True | 是否递归 |

## 💡 快速示例

### 遍历结果
```python
result = scan_directory_and_ocr("D:/images")

for filepath, ocr_data in result['ocr_results'].items():
    if ocr_data['success']:
        print(f"✓ {filepath}: {len(ocr_data['text'])} chars")
    else:
        print(f"✗ {filepath}: {ocr_data['error']}")
```

### 查看统计
```python
summary = result['summary']
print(f"{summary['successful']}/{summary['total_files']} 成功")
```

### 提取所有文本
```python
all_text = []
for filepath, data in result['ocr_results'].items():
    if data['success']:
        all_text.append(data['text'])

combined_text = '\n\n'.join(all_text)
```

## 📚 完整文档

- `SCAN_DIRECTORY_OCR_GUIDE.md` - 详细使用指南
- `SCAN_DIRECTORY_OCR_UPDATE.md` - 更新说明
- `UPDATE_SUMMARY.md` - 完整总结

## 🆘 常见问题

**Q: 如何只扫描当前目录不递归？**
```python
scan_directory_and_ocr(path, max_depth=1, recursive=False)
```

**Q: 如何扫描所有子目录？**
```python
scan_directory_and_ocr(path, max_depth=0)  # 0=无限
```

**Q: 返回0个文件怎么办？**
- 检查 `recursive=True`
- 检查 `max_depth` 是否足够
- 检查 `image_extensions`

**Q: 部分文件失败怎么办？**
- 查看 `result['errors']`
- 尝试不同的 `ocr_engine`

---

**快速开始**: `scan_directory_and_ocr("your/path")`
