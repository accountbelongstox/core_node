# imagePath / imageSize / shapes JSON — 总结文档

对用户提供的 `<content>`（单帧图像元数据 JSON）的简明总结。

## 结构
- 根对象含：imagePath（字符串）、imageSize（二元数组 [宽, 高]）、shapes（数组，可为空）。

## 要点
- **imagePath**：如 "frame_000088.png"，当前帧文件名。
- **imageSize**：[540, 360]，即宽 540、高 360。
- **shapes**：[]，无标注形状；可扩展为框、多边形等标注列表。

## 用途
作为标注或检测流程中单帧的元数据（路径、尺寸、形状），供脚本或标注工具统一读取与扩展。
