# IconGenerator Python 脚本 — 总结文档 [THXbOa]

对用户提供的 `<content>`（IconGenerator 类）的简明总结。

## 结构
- 导入：os、PIL（Image, ImageOps, IcnsImagePlugin）、datetime。
- IconGenerator：__init__ 无参。resize_image(self, size)：Image.open(self.input_image)，resize(size, Image.Resampling.LANCZOS)，返回。create_icns(self, output_path)：sizes 为 7 种 (16,32,64,128,256,512,1024)，循环 resize 得到列表，icon_images[0].save(output_path, format='ICNS', append_images=icon_images[1:])。generate_icons(self, input_image)：self.input_image = input_image；sizes 字典（键为文件名如 128x128.png、icon.ico、StoreLogo.png 等，值为 (宽,高)）；当前时间 strftime('%Y%m%d%H%M%S')，输出目录 .icons_design_{current_time}；mkdir 后对每 (filename, size) resize 并保存；最后 create_icns(icon.icns)。__main__：input_image="logo.png"，实例化后 generate_icons(input_image)。

## 要点
- 多尺寸 PNG/ICO 及单文件 ICNS；含 favicon、Windows Store 等命名约定；输出目录带时间戳避免覆盖。

## 用途
从单张图批量生成多平台图标（含 .ico、.icns、favicon、Store 图标），供桌面应用或网页使用。
