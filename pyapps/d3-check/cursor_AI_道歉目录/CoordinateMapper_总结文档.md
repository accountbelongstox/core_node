# CoordinateMapper — 总结文档

对用户提供的 `<content>`（CoordinateMapper 坐标映射类）的简明总结。

## 结构
- Python 类 CoordinateMapper，仅静态方法：map(x, y, from_width, from_height, to_width, to_height) 返回 (mapped_x, mapped_y)；map_batch(points, from_*, to_*) 对多点调用 map；reverse_map(x, y, from_*, to_*) 交换 to/from 调用 map 实现逆向。依赖 typing Tuple, List。

## 要点
- **映射公式**：mapped_x = x * to_width / from_width，mapped_y 同理；再边界裁剪到 [0, to_width-1] 与 [0, to_height-1]。
- **用途说明**：浏览器坐标到设备坐标、不同分辨率适配、支持旋转场景；示例 720×1280 → 1440×3120。
- **reverse_map**：设备坐标映射回浏览器坐标，即 map 参数对调。

## 用途
在自动化、投屏或测试中将一种分辨率（如浏览器视图）下的坐标转换到另一种分辨率（如设备屏幕），实现点击/坐标的跨分辨率与旋转适配。
