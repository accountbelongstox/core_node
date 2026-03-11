# IconGenerator Python 脚本 — 总结文档 [RuieDb]

对用户提供的 `<content>`（IconGenerator 类）的简明总结。

## 结构
- 导入：os、PIL（Image, ImageOps, IcnsImagePlugin）、datetime。类 IconGenerator：__init__ 无参；resize_image(size)；create_icns(output_path) 七种尺寸、append_images 写 ICNS；generate_icons(input_image) 设 input_image、sizes 字典、.icons_design_{timestamp} 目录、逐项保存、create_icns(icon.icns)；__main__ 用 logo.png。

## 要点
- 多尺寸 PNG/ICO 及单文件 ICNS；输出目录带时间戳；依赖 PIL、IcnsImagePlugin。

## 用途
从单张图批量生成多平台图标（.ico、.icns、favicon、Store 等），供桌面应用或网页使用。
