# IconGenerator — 总结文档

对用户提供的 `<content>`（IconGenerator Python 类）的简明总结。

## 结构
- 类 IconGenerator：__init__（空）；resize_image(size) 用 PIL Image.open + LANCZOS 缩放；create_icns(output_path) 用 7 档尺寸生成 ICNS；generate_icons(input_image) 设置 self.input_image、按 sizes 字典生成多文件到 .icons_design_{timestamp}、最后调用 create_icns 生成 icon.icns；__main__ 示例 logo.png。
- 依赖：os、PIL（Image、ImageOps、IcnsImagePlugin）、datetime。

## 要点
- **输入**：由 generate_icons(input_image) 传入，存为 self.input_image。
- **输出目录**：.icons_design_%Y%m%d%H%M%S，不存在则创建。
- **sizes**：含 128x128.png、16x16.png、@2x、256、512、favicon、icon.ico、icon.png、Square*Logo、StoreLogo 等，覆盖常见平台与 Store 要求。
- **ICNS**：16/32/64/128/256/512/1024 七档，append_images 写入单文件。
- **注意**：resize_image 在循环中多次调用会重复 open 同一文件，可改为只打开一次再多次 resize。

## 用途
从单张源图批量生成多尺寸 PNG/ICO 及 macOS .icns，供应用图标、网站 favicon、多平台打包使用。
