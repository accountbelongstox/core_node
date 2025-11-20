# Images Directory

本目录用于存放设计图片。

## 占位图机制

- **文件名**: `_placeholder.png`
- **说明**: 当目录为空时自动生成，提醒开发者放置实际设计图
- **清理**: 当有实际图片时会自动删除

## 建议放置的图片

根据设计需求，可放置以下类型的图片：

- `architecture.png`: 架构图
- `user_flow.png`: 用户流程图
- `data_model.png`: 数据模型图

## 命名规范

- 使用 `snake_case` 命名（英文目录）或直接中文命名（中文目录）
- 描述性名称
- 版本号用 `_v1`, `_v2` 后缀
- 设备/模式用下划线分隔（如 `_mobile`, `_dark`）

## 支持的格式

- PNG（推荐，支持透明背景）
- JPG/JPEG（照片级效果图）
- SVG（矢量图，可缩放）
- GIF（动图）

## 参考文档

完整规范请参考: `doc/DESIGN_IMAGES_PLACEMENT.md`
