# IconGenerator — 总结文档 [O9vXyU]

对用户提供的 `<content>`（IconGenerator Python 类）的简明总结。

## 结构
- 类 IconGenerator：__init__（空）；resize_image(size) 用 PIL Image.open + LANCZOS 缩放；create_icns(output_path) 用 7 档尺寸生成 ICNS；generate_icons(input_image) 设置 self.input_image、按 sizes 字典生成多文件到 .icons_design_{timestamp}、最后调用 create_icns 生成 icon.icns；__main__ 示例 logo.png。依赖 os、PIL、datetime。

## 要点
- 输入由 generate_icons(input_image) 传入；输出目录 .icons_design_%Y%m%d%H%M%S；sizes 含 128x128、16x16、@2x、icon.ico、icon.png、Square*Logo、StoreLogo 等；ICNS 为 16/32/64/128/256/512/1024 七档。

## 用途
从单张源图批量生成多尺寸 PNG/ICO 及 macOS .icns，供应用图标、favicon、多平台打包使用。
