# GifTextOverlay 功能说明

## 概述

GifTextOverlay 是一个 .NET WPF 应用，用于在 GIF 动图中插入带文字的帧，支持多种文字效果、背景和布局。

## 源目录与 GIF 扫描

- **源目录**：默认 `D:\programing\core_node\.temp_gifs`，可切换
- **扫描方式**：勾选「包含子目录」可递归扫描子目录中的 GIF
- **源 GIF 列表**：右侧大区域显示，可滚动，每项为缩略图+文件名
- **右键操作**：在 GIF 项上右键可删除或重命名

## 文字背景

- **GIF 帧复制**：从当前 GIF 随机选一帧作为文字背景
- **文件夹随机**：从 `{源目录}\背景图` 或指定目录随机选图作为背景
- **指定图片**：选择单张图片作为文字背景

**持续时长**：文字帧持续时间（秒），默认 2 秒，对以上三种背景方式均生效。

## 文字区域

### 多文字区域

- 点击「+ 添加文字区域」可添加多个文字块
- 每个文字区域单独设置效果、位置、字体、字号
- 选中后可在「选中区域设置」中编辑

### 效果

- **预设**：经典、投影、霓虹、漫画、金色、火焰、冰霜、贴纸、浮雕、赛博
- **自定义**：选择「自定义」后，可单独设置：
  - **填充色**：单色或多种色（逗号/分号/空格分隔），多色为渐变
  - **阴影**：颜色、Dx、Dy、半径
  - **描边**：颜色、宽度

### 位置（百分比）

- **Left / Top / Right / Bottom**：边距百分比（0–50）
- **水平对齐**：左 / 居中 / 右（在扣除边距后的区域内）
- **垂直对齐**：上 / 居中 / 下
- **自动字号**：以扣除边距后的区域宽高为基准，自动缩放字号填满

### 字体

- 从 `GifTextOverlay\ttfs` 递归扫描 `.ttf`、`.otf`、`.ttc`
- 排除非法字体文件
- 编译时由 csproj `CopyTtfsFonts` 目标复制到输出目录

## 插入帧预览

- 右侧顶部显示预览
- 根据当前选中文字区域、效果、位置实时渲染
- 选中不同 GIF 时以该 GIF 第一帧为背景预览

## 生成效果（批量）

- 勾选效果 1–10 中的若干项
- 生成时为每个勾选的效果各生成一张图
- 输出文件名格式：`{原文件名}_{效果名}.gif`
- 未勾选时按各文字区域自身效果生成

## 生成目录

- 在输出目录下自动创建时间戳子目录（如 `yyyyMMdd_HHmmss`）
- 可指定输出目录，默认与源目录相同

## Giphy 在线下载

- **API Key**：在 giphy.com 注册获取
- **预置关键词**：20 个可多选（cat, dog, funny, meme, ok, laugh, cool, fire, happy, sad, love, angry, wow, yeah, dance, party, food, sleep, work, game）
- **自定义关键词**：空格分隔，可输入多个
- **下载 URL**：`https://media.giphy.com/media/{ID}/giphy.gif`
- 下载后的 GIF 保存到源目录

## 技术依赖

- SixLabors.ImageSharp（图像处理）
- SixLabors.ImageSharp.Drawing（绘制、渐变）
- SixLabors.Fonts（字体、测量）
- WPF、Windows Forms（文件夹选择等）

## 编译与运行

- 执行 `D:\programing\core_node\.temp_gifs\start.ps1`
- 会自动 `dotnet restore`、`dotnet build`，并复制 ttfs 到输出目录
