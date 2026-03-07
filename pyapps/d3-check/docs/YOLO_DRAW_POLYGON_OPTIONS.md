# 鼠标画线/画图形并自动闭合得到小图 — 方案调研

基于 MCP 文档查询（OpenCV、Matplotlib、Napari）整理，目标：**鼠标绘制线条/多边形，自动闭合后得到封闭区域并裁剪出小图**。

---

## 1. Matplotlib — PolygonSelector（推荐：现成组件）

- **库**：`matplotlib.widgets.PolygonSelector`
- **能力**：在 axes 上通过**鼠标点击依次添加顶点**，多边形**自动闭合**（首尾相连），通过 `onselect` 回调返回顶点坐标（数据坐标）。
- **与图像结合**：用 `ax.imshow(img, extent=[0, w, h, 0], origin='upper')` 显示图像时，`extent` 使 axes 数据坐标等于像素坐标，则 `onselect(verts)` 得到的 `verts` 即为像素坐标，可直接用于后续裁剪。
- **得到小图**：用 `verts` 构造多边形 → `cv2.fillPoly` 做 mask → 取多边形外接矩形 → 对原图裁剪并应用 mask 得到多边形内的小图。
- **优点**：官方组件、自动闭合、坐标与像素一致；无需自己写闭合逻辑。
- **缺点**：通常跑在独立 matplotlib 窗口中，若要在现有 Tk 主界面内嵌需用 `matplotlib.backends.backend_tkagg.FigureCanvasTkAgg` 嵌入；或作为独立“选区域”弹窗使用。

**示例（独立窗口）**：

```python
import matplotlib.pyplot as plt
from matplotlib.widgets import PolygonSelector
import numpy as np

def onselect(verts, eventx, eventy):
    # verts 为闭合多边形顶点 (N, 2)，数据坐标 = 像素坐标（若 extent 设好）
    print("Polygon vertices:", verts)

fig, ax = plt.subplots()
ax.imshow(img, extent=[0, img.shape[1], img.shape[0], 0], origin='upper', aspect='equal')
selector = PolygonSelector(ax, onselect, props=dict(color='lime', linewidth=2))
plt.show()
```

---

## 2. OpenCV — 自带与自绘

- **selectROI / selectROIs**：仅支持**矩形**框选，不支持任意多边形。
- **鼠标回调自绘多边形**：可用 `cv2.setMouseCallback` 自己实现：  
  - 左键点击：将当前点加入列表并画线连到上一点；  
  - 右键或按 Enter/空格：**自动闭合**（把当前点与起点相连），然后 `cv2.fillPoly` 做 mask，再按外接矩形裁剪得到小图。
- **优点**：无额外依赖（项目已有 cv2），窗口风格统一，闭合逻辑简单（一次按键/右键即可）。
- **缺点**：多边形绘制与闭合需自己写（约几十行）。

---

## 3. Napari

- **库**：`napari`，带 `add_shapes(..., shape_type='polygon')`，可交互绘制、编辑多边形。
- **能力**：专业图像查看与标注，支持多边形、椭圆等形状层。
- **缺点**：依赖 Qt、体量较大，适合独立应用或科学工作流，**嵌入现有 Tk 主窗口成本高**，对本需求偏重。

---

## 4. 现有 Tkinter Canvas 扩展（无新库）

- 当前 YOLO 标注窗口已用 Tk Canvas 做矩形/圆标注。
- **扩展方式**：增加“多边形”模式：  
  - 每次点击在画布上打点并画线连到上一点；  
  - 提供“闭合”按钮或**双击**闭合（最后一点连回第一点）；  
  - 闭合后得到像素坐标下的顶点列表 → 用 `cv2.fillPoly` 生成 mask → 外接矩形裁剪 + mask 得到小图。
- **优点**：与现有 UI 一致、无新依赖、逻辑清晰。
- **缺点**：需自己实现点击序列与闭合交互。

---

## 5. 方案对比与建议

| 方案               | 自动闭合     | 得到小图     | 集成现有 Tk | 依赖/工作量   |
|--------------------|-------------|-------------|-------------|----------------|
| Matplotlib PolygonSelector | 是（组件内置） | 需 verts→mask→crop | 可嵌入或独立窗口 | 需 matplotlib |
| OpenCV 自绘        | 自己实现（一键闭合） | fillPoly + crop | 独立 OpenCV 窗口 | 仅 OpenCV，少量代码 |
| Napari             | 是          | 需取 shapes 数据再 crop | 难嵌入 Tk   | 重量级        |
| Tk Canvas 扩展     | 自己实现（按钮/双击） | fillPoly + crop | 直接集成     | 无新库，中等代码 |

- **若要“现成组件 + 自动闭合”**：优先用 **Matplotlib PolygonSelector**；若希望选区域在独立窗口完成，用独立 figure 即可；若必须嵌在 Tk 里，用 `FigureCanvasTkAgg` 把 figure 嵌进 Tk 窗口。
- **若要坚持现有 Tk 且不加库**：在 **Tk Canvas 上增加多边形模式 + 闭合（按钮/双击）**，闭合后统一走 **OpenCV fillPoly + 外接矩形裁剪** 得到小图。

**得到小图的通用步骤（任意方案得到顶点后）**：

1. 顶点列表 `verts`（像素坐标，形如 (N, 2) 或 list of (x,y)）。
2. `cv2.fillPoly(mask, [np.array(verts)], 255)` 得到二值 mask。
3. `x, y, w, h = cv2.boundingRect(np.array(verts))` 取外接矩形。
4. 小图 = 原图裁剪 `img[y:y+h, x:x+w]` 后，与 `mask[y:y+h, x:x+w]` 按位与（或只保留 mask 区域内像素，其余透明/黑）。

确定采用哪一种（Matplotlib 独立/嵌入 或 Tk 扩展）后，可在当前 YOLO 采集流程中接“多边形标注 → 自动闭合 → 导出小图”的完整实现。
