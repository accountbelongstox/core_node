# OCR占位图替换 - 快速开始

**日期**: 2025-11-04
**状态**: ✅ 生产就绪

---

## 🎯 核心理念

**你只需要传一个目录路径！**

`placeholder_type: "unsplash_image"` (默认值) 会**自动随机尝试多个后台API**:
```
Unsplash → Bing → RPic → Ltyuanfang
```
直到成功获取高质量图片，**完全自动降级**。

---

## ⚡ 最简单的用法

### 1. 扫描目录查看有哪些占位图

```python
scan_directory_for_placeholders("D:/project/images")
```

### 2. 批量替换所有占位图

```python
# 就这一行！不需要指定类型！
replace_directory_placeholders("D:/project/images")
```

**就这么简单！** 系统会：
- ✅ 自动OCR识别占位图
- ✅ 自动尝试多个API获取随机高质量照片
- ✅ 自动跳过重复图片
- ✅ 自动限速（5秒间隔）防止API限流
- ✅ 保持原始图片尺寸

---

## 📖 完整示例

### 示例 1: 最简单 - 批量替换项目所有占位图

```python
# 步骤1: 先扫描看看有哪些占位图
result = scan_directory_for_placeholders("D:/project/assets/images")
# 返回: { "found_placeholders": 10, "placeholders": [...] }

# 步骤2: 直接替换，不需要指定类型！
replace_directory_placeholders("D:/project/assets/images")
# 自动从 Unsplash → Bing → RPic → Ltyuanfang 随机获取高质量照片
```

### 示例 2: 预览模式 - 看看会替换哪些图

```python
# 使用 dry_run=True 只检测不替换
replace_directory_placeholders(
    "D:/project/images",
    dry_run=True
)
# 返回: 检测到的占位图列表，但不实际替换
```

### 示例 3: 替换单个图片（带OCR验证）

```python
# 最简单 - OCR验证后替换
replace_single_placeholder_with_ocr("D:/project/logo.png")

# 强制替换（跳过OCR验证）
replace_single_placeholder_with_ocr("D:/project/logo.png", force=True)
```

---

## 🎨 高级用法（很少需要）

### 仅在需要**特定主题内容**时才指定类型

```python
# 需要特定主题的图片？使用 unsplash_search + description
replace_directory_placeholders(
    "D:/website/images",
    placeholder_type="unsplash_search",
    description="modern office workspace technology"
)
```

### 其他可选参数

```python
# 不递归扫描子目录
replace_directory_placeholders("D:/project/images", recursive=False)

# 不使用OCR（更快但不够准确）
replace_directory_placeholders("D:/project/images", use_ocr=False)
```

---

## 🔄 工作流程

```
┌────────────────────────────────────────────────┐
│  1. 用户调用                                    │
│     replace_directory_placeholders(dir)        │
│     (不需要指定 placeholder_type)              │
└────────────────┬───────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────┐
│  2. 自动OCR扫描检测占位图                       │
│     ├─ 文件大小检查                            │
│     ├─ 图片尺寸检查                            │
│     ├─ OCR文字识别                             │
│     └─ 模式匹配 (300x200, PNG, JPG等)          │
└────────────────┬───────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────┐
│  3. 队列处理（每个图片）                        │
│     ├─ 检查是否重复（MD5 hash）                │
│     ├─ 生成替换图片                            │
│     │   └─ 自动尝试: Unsplash → Bing →        │
│     │                RPic → Ltyuanfang        │
│     ├─ 等待5秒（限速）                         │
│     └─ 继续下一个                              │
└────────────────┬───────────────────────────────┘
                 ↓
┌────────────────────────────────────────────────┐
│  4. 返回统计结果                                │
│     ├─ 检测到: 10                              │
│     ├─ 替换成功: 8                             │
│     ├─ 跳过重复: 2                             │
│     └─ 失败: 0                                 │
└────────────────────────────────────────────────┘
```

---

## ❓ 常见问题

### Q1: 为什么默认是 "unsplash_image"？

**A**: 因为它**自动尝试多个API**！
```
unsplash_image = Unsplash → Bing → RPic → Ltyuanfang (随机)
```
你不需要关心具体用哪个API，系统会自动降级直到成功。

### Q2: 我需要指定 placeholder_type 吗？

**A**: **99%的情况不需要！** 只在需要**特定主题内容**时才用 `"unsplash_search"` + `description`。

```python
# ✅ 推荐 - 简单直接
replace_directory_placeholders("D:/project/images")

# ❌ 不必要 - 多此一举
replace_directory_placeholders("D:/project/images", placeholder_type="unsplash_image")

# ✅ 仅在需要特定主题时
replace_directory_placeholders(
    "D:/project/images",
    placeholder_type="unsplash_search",
    description="sunset beach ocean"
)
```

### Q3: 如何知道会替换哪些图片？

**A**: 使用 `dry_run=True` 预览：

```python
# 只检测不替换
result = replace_directory_placeholders("D:/project/images", dry_run=True)
print(result["detected"])  # 显示检测到多少个占位图
```

### Q4: 替换速度慢？

**A**:
- 每个图片间隔5秒（防止API限流）
- 可以禁用OCR加速: `use_ocr=False`
- OCR每张图片约10-15秒（可选）

```python
# 更快但不够准确的检测
replace_directory_placeholders("D:/project/images", use_ocr=False)
```

### Q5: 如何替换非占位图？

**A**: 使用 `force=True`：

```python
# 强制替换，跳过OCR验证
replace_single_placeholder_with_ocr("D:/image.jpg", force=True)
```

---

## 🎯 最佳实践

### ✅ DO - 推荐做法

```python
# 1. 最简单 - 直接替换
replace_directory_placeholders("D:/project/images")

# 2. 预览后替换
scan_directory_for_placeholders("D:/project/images")  # 先看看
replace_directory_placeholders("D:/project/images")    # 再替换

# 3. 需要主题内容时才指定
replace_directory_placeholders(
    "D:/project/images",
    placeholder_type="unsplash_search",
    description="nature landscape"
)
```

### ❌ DON'T - 不推荐做法

```python
# ❌ 不必要的参数
replace_directory_placeholders(
    "D:/project/images",
    placeholder_type="unsplash_image"  # 这是默认值，不用写！
)

# ❌ 过度指定类型
replace_directory_placeholders(
    "D:/project/images",
    placeholder_type="bing_image"  # 为什么限制只用Bing？
)
# 用默认的 unsplash_image 会自动尝试所有API，更可靠！
```

---

## 📊 API自动降级说明

当你使用默认 `placeholder_type="unsplash_image"` 时：

```
尝试顺序（自动降级）:
┌──────────────┐
│   Unsplash   │ ← 首选（专业摄影）
└──────┬───────┘
       ↓ 失败
┌──────────────┐
│     Bing     │ ← 备选1（随机图片）
└──────┬───────┘
       ↓ 失败
┌──────────────┐
│     RPic     │ ← 备选2（摄影集）
└──────┬───────┘
       ↓ 失败
┌──────────────┐
│  Ltyuanfang  │ ← 备选3（风景照）
└──────┬───────┘
       ↓ 失败
┌──────────────┐
│ White Image  │ ← 最终降级（纯白）
└──────────────┘
```

**完全自动，无需手动处理！**

---

## 🎉 总结

### 记住这三点：

1. **只传目录路径** - 系统自动处理一切
2. **默认就是最好的** - 自动尝试多个API
3. **需要主题才指定** - 99%情况用默认即可

### 最常用的两个命令：

```python
# 扫描
scan_directory_for_placeholders("D:/project/images")

# 替换（就这么简单！）
replace_directory_placeholders("D:/project/images")
```

---

**完整文档**: 查看 `OCR_PLACEHOLDER_REPLACER_GUIDE.md`
**实现细节**: 查看 `OCR_IMPLEMENTATION_SUMMARY.md`
