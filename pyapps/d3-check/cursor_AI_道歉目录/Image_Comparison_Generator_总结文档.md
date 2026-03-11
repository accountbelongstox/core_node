# Image Comparison Generator Tool 总结文档

对用户提供的 `<content>`（Python 图像对比拼图生成工具）的简明总结。

## 结构概览
- Python 3 脚本，shebang、模块 docstring；依赖 argparse、pathlib、PIL（Image、ImageDraw、ImageFont）；类 ImageComparisonGenerator(target_directory)；main() 解析目录参数并调用 generate_comparison()。

## 要点
- **输入**：指定目录下支持的图片（.jpg/.jpeg/.png/.bmp/.gif/.tiff/.webp），排除文件名含 _comparison_collage 的已生成图，按文件名排序。
- **标签**：按索引生成 A、B、C…，超过 26 张用 AA、AB…。
- **布局**：calculate_collage_size 计算网格（最多 4 列）、缩略图 300×300、间距与标签高度；总画布含边距与标题区。
- **绘制**：白底、标题 "Image Comparison - N Images"、每张缩略图保持比例居中粘贴、下方 "Image A" 等标签与短文件名；加载失败时画红色占位与错误信息。
- **输出**：comparison_collage_N_images_comparison_collage.jpg，若已存在则提示是否覆盖。

## 用途
将目录内多张图片合成一张带 A/B/C 标签的对比图，便于人工或 AI 进行图像对比。
