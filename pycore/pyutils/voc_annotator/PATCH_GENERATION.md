# 补丁图生成训练数据逻辑文档

## 1. 概述

补丁图（patch images）是项目级别的**小图集合**，用于**生成合成训练数据**，而非直接标注。通过将小图随机变换后粘贴到大图（背景）上，生成带标注的合成图像，扩充训练数据集。

**核心特点**：
- **项目级别**：所有段（segment）共享同一套补丁图，存储在项目根目录的 `patch_data.json`
- **无需标注**：补丁图本身不需要标注，类别名默认等于文件名（不含扩展名）
- **仅用于生成**：补丁图不参与直接标注流程，只在最终生成数据集时使用

---

## 2. 补丁数据管理

### 2.1 存储格式

**文件位置**：`{项目根目录}/patch_data.json`

**JSON 结构**：
```json
{
  "base_dir": "D:/patches",
  "items": [
    {"file": "enemy.png", "class": "enemy"},
    {"file": "item.png", "class": "item"},
    {"file": "door.png", "class": "door"}
  ]
}
```

- `base_dir`：补丁图所在目录（可为空，表示 `file` 为绝对路径）
- `items`：补丁图列表，每项包含 `file`（文件名或绝对路径）和 `class`（类别名）

### 2.2 类别名规则

- **默认**：类别名 = 文件名（不含扩展名）
  - 例如：`enemy.png` → 类别 `"enemy"`
  - 例如：`item_001.png` → 类别 `"item_001"`
- **可编辑**：UI 中可双击修改类别名，或将多个小图合并为同一类别

### 2.3 导入方式

1. **导入文件夹**：扫描目录下所有图片（`.jpg`, `.jpeg`, `.png`, `.bmp`），自动提取类别名
2. **导入单张图片**：选择一张图片，类别名 = 文件名（不含扩展名）

**代码位置**：
- `patch_data.py`: `load_patch_dir()`, `load_patch_data()`, `save_patch_data()`
- `main_window.py`: `_load_external_dir()` (UI 导入)
- `coordinate_calibration_panel.py`: `_on_yolo_patch_import()` (d3-check UI)

---

## 3. 生成流程

### 3.1 入口

**voc_annotator UI**：`File` → `Generate YOLO dataset`
- 选择输出目录
- 输入合成图数量（0 = 仅导出已标注图，不生成合成图）

**代码位置**：`main_window.py` → `_generate_yolo_dataset()`

### 3.2 生成步骤

#### 步骤 1：导出已标注的大图

1. 遍历当前图像列表（`self._image_list`）
2. 对每张图：
   - 加载标注（JSON 或 VOC XML）
   - 导出 YOLO 检测格式 `.txt`（`export_yolo_detection_txt`）
   - **仅导出有标注的图**（至少 1 个目标，符合 Ultralytics 规范：无目标不写 `.txt`）
3. 复制图片到 `output/images/`，标签到 `output/labels/`

**输出**：`count_annot` 张已标注图

#### 步骤 2：生成合成图（如果存在补丁数据且 `num_synthetic > 0`）

**前置条件**：
- `self._external_items` 非空（补丁图列表）
- `self._external_base_dir` 非空（补丁图目录）
- `self._image_list` 非空（有背景图）

**流程**：

1. **构建补丁项列表**：
   ```python
   patch_items = []
   for filename, class_name in self._external_items:
       if class_name not in self._classes:
           continue  # 跳过不在类别列表中的补丁
       cid = self._classes.index(class_name)  # 获取类别ID
       full = os.path.join(self._external_base_dir, filename)
       if os.path.isfile(full):
           patch_items.append((full, cid))  # (补丁图路径, 类别ID)
   ```

2. **选择背景图**：
   - 从当前图像列表（`self._image_list`）中筛选出图片文件
   - 这些大图作为背景

3. **调用生成函数**：
   ```python
   detection_paste_generator.generate_detection_by_paste(
       background_image_paths=bg_paths,  # 背景图路径列表
       patch_items=patch_items,          # [(补丁路径, 类别ID), ...]
       class_names=self._classes,        # 类别名列表
       output_images_dir=images_out,     # 输出图片目录
       output_labels_dir=labels_out,     # 输出标签目录
       num_images=num_syn,               # 生成数量
       patches_per_image=(2, 8),        # 每张图粘贴 2-8 个补丁
   )
   ```

**输出**：`count_syn` 张合成图

#### 步骤 3：写入 data.yaml

使用 `yolo_data_layout.write_data_yaml()` 写入 Ultralytics 数据集配置：
- `path`: 数据集根目录
- `train`: `images`（训练图目录）
- `val`: `images`（验证图目录，与训练相同）
- `nc`: 类别数量
- `names`: `{0: "class0", 1: "class1", ...}`

---

## 4. 合成图生成细节（detection_paste_generator）

### 4.1 函数签名

```python
def generate_detection_by_paste(
    background_image_paths: List[str],      # 背景图路径列表
    patch_items: List[Tuple[str, int]],     # [(补丁路径, 类别ID), ...]
    class_names: List[str],                 # 类别名列表（用于验证）
    output_images_dir: str,                 # 输出图片目录
    output_labels_dir: str,                 # 输出标签目录
    num_images: int = 50,                   # 生成数量
    patches_per_image: Tuple[int, int] = (2, 8),  # 每张图粘贴数量范围
    aug_config: Optional[Dict] = None,       # 增强配置（可选）
    image_format: str = "png",              # 输出格式
) -> int:  # 返回生成的图片数量
```

### 4.2 生成单张合成图的流程

对每张合成图（循环 `num_images` 次）：

#### 4.2.1 准备背景

```python
bg = random.choice(backgrounds).copy()  # 随机选择一张背景图并复制
h, w = bg.shape[:2]  # 获取背景尺寸
```

#### 4.2.2 选择补丁

```python
n_paste = random.randint(min_p, min(max_p, len(patches)))  # 随机选择粘贴数量（2-8）
chosen = random.sample(patches, n_paste)  # 随机选择 n_paste 个补丁（不重复）
```

#### 4.2.3 对每个补丁进行变换并粘贴

**变换顺序**（依次应用）：

1. **缩放（Scale）**（默认开启，`allow_scale=True`）
   - 缩放范围：`scale_range=[0.6, 1.4]`（默认）
   - 随机缩放因子：`s = random.uniform(0.6, 1.4)`
   - 新尺寸：`nw = max(10, int(pw * s))`, `nh = max(5, int(ph * s))`
   - 使用 `cv2.resize()` 缩放

2. **拉伸（Stretch）**（默认开启，`allow_stretch=True`）
   - X 轴拉伸：`stretch_x_range=[0.8, 1.2]`（默认）
   - Y 轴拉伸：`stretch_y_range=[0.9, 1.1]`（默认）
   - 随机拉伸因子：`sx = random.uniform(0.8, 1.2)`, `sy = random.uniform(0.9, 1.1)`
   - 新尺寸：`nw = max(10, int(nw * sx))`, `nh = max(5, int(nh * sy))`
   - 再次 `cv2.resize()` 拉伸

3. **旋转（Rotation）**（默认开启，`allow_rotation=True`）
   - 旋转角度范围：`rotation_range=[-15, 15]`（默认，单位：度）
   - 随机角度：`angle = random.uniform(-15, 15)`
   - 计算旋转后尺寸（避免裁剪）：
     ```python
     abs_cos = abs(np.cos(np.radians(angle)))
     abs_sin = abs(np.sin(np.radians(angle)))
     rw = int(nh * abs_sin + nw * abs_cos)
     rh = int(nh * abs_cos + nw * abs_sin)
     ```
   - 使用 `cv2.getRotationMatrix2D()` 和 `cv2.warpAffine()` 旋转
   - 边框填充：`borderValue=(0, 0, 0)`（黑色）

4. **颜色抖动（Color Jitter）**（默认开启，`color_jitter=True`）
   - 随机亮度调整：50% 概率，因子 `0.9-1.1`
   - 随机对比度调整：50% 概率，因子 `0.9-1.1`
   - 使用 `ultralytics_comm.color_jitter()` 实现

**粘贴**：
```python
if nw >= w or nh >= h:
    continue  # 跳过过大的补丁（超出背景）
x = random.randint(0, max(0, w - nw))  # 随机 X 位置
y = random.randint(0, max(0, h - nh))  # 随机 Y 位置
bg[y : y + nh, x : x + nw] = patch  # 直接覆盖粘贴
```

#### 4.2.4 生成 YOLO 标签

对每个粘贴的补丁，计算归一化坐标：

```python
cx = (x + nw / 2) / w      # 中心 X（归一化 0-1）
cy = (y + nh / 2) / h      # 中心 Y（归一化 0-1）
nw_n = nw / w              # 宽度（归一化 0-1）
nh_n = nh / h              # 高度（归一化 0-1）

# 格式：class_id x_center y_center width height
line = f"{class_id} {cx:.6f} {cy:.6f} {nw_n:.6f} {nh_n:.6f}"
annotations.append(line)
```

**格式说明**：
- 符合 Ultralytics YOLO 检测格式
- 坐标归一化到 `[0, 1]`
- 类别 ID 为零索引（0, 1, 2, ...）

#### 4.2.5 保存文件

```python
out_name = "syn_%04d" % img_idx  # 例如：syn_0000, syn_0001, ...
img_path = os.path.join(output_images_dir, out_name + "." + image_format)
lbl_path = os.path.join(output_labels_dir, out_name + ".txt")

cv2.imwrite(img_path, bg)  # 保存图片
with open(lbl_path, "w", encoding="utf-8") as f:
    f.write("\n".join(annotations) + "\n")  # 保存标签（每行一个目标）
```

---

## 5. 数据流图

```
┌─────────────────┐
│  补丁图目录      │
│  (小图集合)      │
└────────┬────────┘
         │ load_patch_dir()
         ▼
┌─────────────────┐
│ patch_data.json │  (项目级别，所有段共享)
│ base_dir +      │
│ items[]          │
└────────┬────────┘
         │ load_patch_data()
         ▼
┌─────────────────┐
│ 标注工具 UI      │  (可选：编辑类别、合并)
│ 补丁图列表       │
└────────┬────────┘
         │ 用户操作：Generate YOLO dataset
         ▼
┌─────────────────┐
│ 已标注大图       │  ──┐
│ (images_dir)    │    │
└─────────────────┘    │
                        │ generate_detection_by_paste()
┌─────────────────┐    │
│ 补丁图列表       │  ──┘
│ (patch_items)   │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ 对每张合成图：                        │
│ 1. 随机选择背景                       │
│ 2. 随机选择 N 个补丁 (2-8)            │
│ 3. 对每个补丁：                       │
│    - 缩放 (0.6-1.4x)                 │
│    - 拉伸 (X: 0.8-1.2x, Y: 0.9-1.1x)│
│    - 旋转 (-15° 到 +15°)              │
│    - 颜色抖动                         │
│    - 随机位置粘贴                     │
│ 4. 计算 YOLO 标签（归一化坐标）       │
│ 5. 保存图片 + .txt                   │
└────────┬────────────────────────────┘
         │
         ▼
┌─────────────────┐
│ output/         │
│ ├─ images/      │  (已标注图 + 合成图)
│ ├─ labels/      │  (YOLO .txt)
│ └─ data.yaml    │  (数据集配置)
└─────────────────┘
```

---

## 6. 配置参数

### 6.1 默认增强配置

```python
aug_config = {
    "allow_scale": True,
    "scale_range": [0.6, 1.4],
    "allow_stretch": True,
    "stretch_x_range": [0.8, 1.2],
    "stretch_y_range": [0.9, 1.1],
    "allow_rotation": True,
    "rotation_range": [-15, 15],
    "color_jitter": True,
}
```

### 6.2 生成参数

- `num_images`: 合成图数量（默认 50）
- `patches_per_image`: 每张图粘贴数量范围（默认 `(2, 8)`）
- `image_format`: 输出格式（默认 `"png"`）

---

## 7. 输出格式

### 7.1 目录结构

```
output_dir/
├── images/
│   ├── image001.png          (已标注图)
│   ├── image002.png
│   ├── syn_0000.png          (合成图)
│   ├── syn_0001.png
│   └── ...
├── labels/
│   ├── image001.txt          (已标注图标签)
│   ├── image002.txt
│   ├── syn_0000.txt          (合成图标签)
│   ├── syn_0001.txt
│   └── ...
└── data.yaml                 (数据集配置)
```

### 7.2 标签文件格式

**示例 `syn_0000.txt`**：
```
0 0.523456 0.376543 0.284123 0.418765
1 0.735123 0.298456 0.193456 0.337890
```

- 每行一个目标
- 格式：`class_id x_center y_center width height`（归一化 `[0, 1]`）
- 类别 ID 对应 `data.yaml` 中的 `names` 字典

### 7.3 data.yaml 格式

```yaml
# YOLO dataset config (Ultralytics).
path: D:/output
train: images
val: images
nc: 3
names:
  0: enemy
  1: item
  2: door
```

---

## 8. 使用场景

### 8.1 适用场景

- **小目标检测**：补丁图是小目标（如 UI 图标、游戏道具），需要粘贴到不同背景上
- **数据增强**：已有少量标注图，通过合成扩充数据集
- **类别平衡**：某些类别样本少，通过补丁图生成更多样本

### 8.2 注意事项

1. **补丁图质量**：补丁图应为**透明背景或纯色背景**，粘贴效果更好
2. **背景选择**：背景图应来自实际场景（如游戏截图），保证真实性
3. **类别一致性**：补丁图的类别名必须在项目的类别列表中
4. **路径处理**：
   - 如果补丁图来自同一目录，`base_dir` 存储目录路径，`file` 为相对路径
   - 如果补丁图来自不同目录，`base_dir` 为空，`file` 存储绝对路径

---

## 9. 代码位置

- **补丁数据管理**：`pycore/pyutils/voc_annotator/patch_data.py`
- **生成逻辑**：`pycore/pyutils/voc_annotator/detection_paste_generator.py`
- **UI 集成**：`pycore/pyutils/voc_annotator/main_window.py` → `_generate_yolo_dataset()`
- **d3-check UI**：`pyapps/d3-check/ui/panels/coordinate_calibration_panel.py` → `_on_yolo_patch_import()`
- **公共工具**：`pycore/pyutils/common/ultralytics_comm/`（color_jitter, format_detection_line）

---

## 10. 总结

补丁图生成流程通过**随机变换 + 随机粘贴**的方式，将小图合成到背景图上，生成带标注的训练数据。整个过程自动化，无需手动标注补丁图，适合快速扩充数据集。生成的合成图与已标注图合并，统一输出为 Ultralytics YOLO 格式，可直接用于训练。
