
# Flutter Icon Reduction - Asset Generators

这个目录包含了用于Flutter项目的多平台资产生成器，用于从源图像生成平台特定的图像资源。

## 文件结构

```
flutter_icon_reduction/
├── base_asset_generator.py      # 基础资产生成器类（包含所有公共功能）
├── android_asset_generator.py   # Android平台资产生成器
├── ios_asset_generator.py       # iOS平台资产生成器
└── README.md                    # 本说明文件
```

## Features

- **多平台支持**: 支持Android和iOS平台
- **智能尺寸分析**: 基于文件夹名称自动识别DPI级别
- **等比例缩放**: 智能裁剪，确保一边与目标尺寸完全匹配
- **图像压缩**: 支持PNG、JPEG、WebP格式的优化
- **占位图跳过**: 自动跳过1x1px的占位图像
- **批量处理**: 详细的日志记录和错误处理

## Usage

### 1. Android资产生成

```bash
cd scripts/flutter_icon_reduction
python android_asset_generator.py
```

### 2. iOS资产生成

```bash
cd scripts/flutter_icon_reduction
python ios_asset_generator.py
```

## Configuration

### 源图像目录

所有脚本都会从 `assets/.internal_common` 目录读取源图像。

### 资产映射

每个平台都有自己的硬编码映射配置：

```python
# Android映射示例
self.android_mapping = {
    "background": ["background.png"]
}

# iOS映射示例  
self.ios_mapping = {
    "background": ["background.png"]
}
```

映射格式：`源文件名 => [目标文件名列表]`

### DPI模式识别

#### Android DPI模式
- `drawable-mdpi`: 1.0x
- `drawable-hdpi`: 1.5x
- `drawable-xhdpi`: 2.0x
- `drawable-xxhdpi`: 3.0x
- `drawable-xxxhdpi`: 4.0x
- `mipmap-*`: 同上

#### iOS DPI模式
- `1x` 或 `@1x`: 1.0x
- `2x` 或 `@2x`: 2.0x
- `3x` 或 `@3x`: 3.0x

## 图像类型识别

脚本会自动识别以下图像类型：

- **小图标**: ≤48x48像素
- **大图标**: 49x49 - 96x96像素
- **超大图标**: 97x97 - 384x384像素
- **横向背景**: 宽高比>1.5且尺寸>1000像素
- **纵向背景**: 宽高比<0.67且尺寸>1000像素
- **横幅图像**: 其他情况下的较大图像
- **占位图**: 1x1像素的图像

## 推荐尺寸

每个图像类型在不同DPI级别下都有推荐的尺寸：

```python
"small_icon": {
    1.0: (24, 24),      # mdpi
    1.5: (36, 36),      # hdpi
    2.0: (48, 48),      # xhdpi
    3.0: (72, 72),      # xxhdpi
    4.0: (96, 96)       # xxxhdpi
}
```

## 输出文件

每个脚本运行后会生成相应的映射JSON文件：
- `android_asset_mapping.json`: Android平台映射
- `ios_asset_mapping.json`: iOS平台映射

## Notes

1. **不要运行脚本**: 在完全配置好之前，请不要运行这些脚本
2. **备份重要文件**: 运行前请备份重要的图像文件
3. **检查映射配置**: 确保资产映射配置正确
4. **测试环境**: 建议先在测试环境中验证

## 扩展开发

如需添加新平台支持，请：

1. 继承 `BaseAssetGenerator` 类
2. 实现平台特定的方法：
   - `find_dpi_from_path()`
   - `find_target_file_in_platform()`
   - `generate_asset_mapping()`
   - `process_platform()`
   - `run()`
3. 添加平台特定的DPI模式识别
4. 配置平台特定的资产映射

## 依赖要求

- Python 3.7+
- Pillow (PIL) 库
- 标准库：os, sys, re, pathlib, json, typing

## Error Handling

脚本包含完善的错误处理机制：
- 文件不存在时的警告
- 图像处理失败时的错误记录
- 压缩失败时的回退机制
- 详细的日志记录

## License

Flutter Asset Generator

