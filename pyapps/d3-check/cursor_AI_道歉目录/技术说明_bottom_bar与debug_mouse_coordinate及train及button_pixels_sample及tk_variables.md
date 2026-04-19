# 技术说明：bottom_bar、debug_mouse_coordinate、train、button_pixels_sample、tk_variables

**目的**：说明此五处组件/脚本/数据/工具的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `ui/components/bottom_bar.py`
- `scripts/debug/debug_mouse_coordinate.py`
- `train.py`
- `athtest/button_pixels_sample.json`
- `ui/utils/tk_variables.py`

---

## 一、ui/components/bottom_bar.py

### 1.1 职责与约定

- **用途**：底部栏组件：**Row0** = 宏 + 每 Tab 选项（BottomBarOptionsBlock），**Row1** = 状态一行（BottomBarStatusBlock），**Row2** = 单行占位。**status_vars** 传入 BottomBarStatusBlock，须含 **STATUS_ROW_1/STATUS_ROW_2** 的 var_key：battlenet、ros、d3、map、stage、oauth、window_size；当前还含 ros_found（若 status_row_config 无 ros_found 则该项无对应 label）。**_register_status_labels** 保存 value_labels（var_key → Label），供 **_do_window_status_ui_update** 与 **update_status_from_state** 更新文案与 fg。**update_status_from_state** 的 fg_map 含 battlenet、ros、d3、map、stage、oauth；window_size 在 on_window_status_update 中单独设 fg。
- **约定**：status_vars 的 key 与 status_row_config 的 var_key 一致才有对应 label；fg_map 的 key 与 _value_labels 一致才能更新颜色；state 的 key（battlenet_window_found、rosbot_extended_status、d3_running 等）与状态提供方约定一致。

### 1.2 易被误解或改错的原因

1. **status_vars 与 STATUS_ROW_1/2 不一致**：若在 status_row_config 增删项未在 bottom_bar 的 status_vars 中同步（或反之），会多出空列、少列或 _value_labels 缺 key，fg 更新不到。
2. **fg_map 漏 key**：update_status_from_state 中 fg_map 若漏掉某 var_key，该列不会随状态变色；window_size 不在 fg_map 中，在 on_window_status_update 单独处理。
3. **state 键名与提供方不一致**：若 game_interface_data 或 notify_state_sync 写的键名与 bottom_bar 期望的 battlenet_disconnected、rosbot_extended_status 等不同，显示错或不变。
4. **ros_found 与 row config**：status_vars 含 ros_found_status，若 status_row_config 无 "ros_found" 项，该变量无对应 Label；若需显示 ros_found 须在 status_row_config 增加对应项。

### 1.3 正确做法

- 修改 status_row_config 时同步 bottom_bar 的 status_vars 与 update_status_from_state 的 fg_map；保证 state 键名与状态提供方一致；需要显示的列均在 row config 中有对应项。

---

## 二、scripts/debug/debug_mouse_coordinate.py

### 2.1 职责与约定

- **用途**：**调试脚本**，悬浮窗实时显示鼠标坐标：屏幕坐标、游戏坐标（相对 D4 窗口）、标准分辨率坐标（窗口模式下按 D4_STANDARD_RESOLUTION_* 与边框常量换算）。依赖 **get_d4_interface_data()**：window_offset、game_window_size、is_windowed_mode()；窗口模式下从 **game_interface_data** 导入 WINDOW_BORDER_LEFT、WINDOW_BORDER_RIGHT、TITLE_BAR_HEIGHT、WINDOW_BORDER_BOTTOM 计算 client 区域再缩放。路径 _project_root = __file__.parent.parent（d3-check）。更新线程每 0.05s 读 pyautogui.position() 与 d4_data，用 root.after(0, lambda: ...) 更新 Label。
- **约定**：运行前需有 D4 窗口信息（截图/采集过），否则 game 坐标与标准坐标为 N/A；边框常量须与 game_interface_data 或 D4 常量模块一致；root.after(0, lambda) 中若依赖循环变量须用默认参数捕获，避免闭包捕获错误值。

### 2.2 易被误解或改错的原因

1. **d4_data 未就绪**：若从未执行 D4 截图，window_offset/game_window_size 为空，游戏坐标与标准坐标显示 N/A。
2. **边框常量来源**：脚本从 game_interface_data 导入 WINDOW_BORDER_LEFT 等；若这些常量改到 providor.constants.d4 或别处未同步，换算错。
3. **after(0, lambda) 闭包**：update_coordinates 中设置 game_coord_text 等后 root.after(0, lambda: label.config(text=game_coord_text))；若 lambda 无参数，执行时读取的是当前闭包变量，在 20 FPS 下可能已被下一轮覆盖；若需固定当次值应用默认参数 lambda t=game_coord_text: ...。
4. **路径**：从 scripts/debug 或 d3-check 根运行，保证 _project_root 正确否则 import 失败。

### 2.3 正确做法

- 先有 D4 采集再运行；边框常量与项目约定一致；after(0) 回调若依赖循环内变量用默认参数捕获；从 d3-check 根或 scripts/debug 运行。

---

## 三、train.py

### 3.1 职责与约定

- **用途**：**统一训练入口**，交互菜单或 CLI（--mode classification/detection/both、--epochs、--batch、--device）；train_classification/train_detection/train_both 调用 **controller.training.D3CheckTrainingController**；interactive_mode() 列出项目、显示菜单、根据选项 1/2/3 调用 train_*。路径 current_dir = dirname(abspath(__file__))，即 pyapps/d3-check，sys.path.insert(0, current_dir)。
- **约定**：应从 pyapps/d3-check 运行；controller.training 模块须存在且 D3CheckTrainingController 实现 train_unified_classification、train_unified_detection 等。

### 3.2 易被误解或改错的原因

1. **interactive_mode 中 choice '3' 的代码错误**：在 choice == '3' 分支内，result = train_both() 之后有数行引用 **project**、**best_model_dst**、**self.controller**、**metadata_file**，这些在 interactive_mode() 函数作用域内**未定义**（来自别处粘贴），执行到会 **NameError**。应删除或改为与 train_both() 返回值一致的总结输出。
2. **模块级 def run(self)**：文件约 181 行起有 **def run(self):** 及大段缩进体，形如从某类中粘贴出来的 run 方法；在模块顶层 run(self) 的 self 无意义，且 main() 未调用 run()，该段为**死代码**。若为误粘贴应删除或移回对应类。
3. **运行目录**：若从 repo 根或别处运行，current_dir 不是 d3-check，import controller.training 可能失败。

### 3.3 正确做法

- 修复 choice '3' 分支：去掉对 project、best_model_dst、self、metadata_file 的引用，仅保留与 train_both() 结果一致的提示；将误粘贴的 run(self) 及后续死代码删除或移入正确类；从 pyapps/d3-check 运行。

---

## 四、athtest/button_pixels_sample.json

### 4.1 职责与约定

- **用途**：**athtest** 采样产出示例：**success**、**file_path**、**image_info**、**regions**（**region**、**region_info**、**hex_pixels** 数组，每项 **color**（hex）、**x**、**y**）。**square_sampler**、**button_detector** 等通过 **data['regions']['hex_pixels']** 读取颜色与坐标；load_button_colors 等期望该结构。
- **约定**：消费者（scripts/athtest）与产出格式一致；file_path 常为绝对路径，作 fixture 或跨机时需注意可移植性；若 regions 或 hex_pixels 键名/结构变更，所有读取处须同步。

### 4.2 易被误解或改错的原因

1. **file_path 为绝对路径**：示例中 file_path 含 apps\d3-check；若项目为 pyapps/d3-check 或他机路径不同，作参考时易误导；作测试 fixture 应用相对路径或占位。
2. **regions.hex_pixels 结构**：若改为 regions.pixels 或 hex_pixels 项改为 {r,g,b} 等，square_sampler、button_detector 会 KeyError 或解析错。
3. **与主流程混用**：本文件属 athtest 采样输出；主流程 D3/D4 检测勿直接依赖此文件路径或结构，除非文档化约定。

### 4.3 正确做法

- 消费代码统一从 data['regions']['hex_pixels'] 读取；修改 JSON 结构时同步 square_sampler、button_detector 等；fixture 或文档用相对路径或说明可移植性。

---

## 五、ui/utils/tk_variables.py

### 5.1 职责与约定

- **用途**：**Tk 变量工厂**，避免「no default root window」：**var_bool(master, value)**、**var_str(master, value)**、**var_int(master, value)**、**var_double(master, value)**，均需传入 **master**（Tk 或 Widget）。所有需 Tk 变量的 UI 应通过本模块创建变量，保证变量绑定到正确根窗口。
- **约定**：不在模块层或无 master 时直接 tk.StringVar() 等；新建 UI 组件时变量一律用 tk_variables 的工厂创建。

### 5.2 易被误解或改错的原因

1. **直接 tk.BooleanVar() 等**：在无 Tk 根或错误时机创建变量会报 "no default root window" 或绑定到错误根，导致变量不随窗口销毁或无法更新。
2. **master 传错**：若传入的 master 不是目标窗口树的 widget/toplevel，变量可能属于另一窗口，行为异常。
3. **新增变量类型未提供工厂**：若需要其他 Tk 变量类型且未在本模块增加对应工厂，调用方可能直接 tk.XXXVar() 导致上述问题。

### 5.3 正确做法

- 所有 Tk 变量通过 tk_variables 的 var_bool/var_str/var_int/var_double 创建并传入正确 master；不直接使用 tk.XXXVar() 无参或非 master 构造。

---

## 六、与道歉文档的关系

若此前因上述任一点（如 bottom_bar 的 status_vars/fg_map 与 row config 或 state 键不同步、debug_mouse_coordinate 的 d4_data 或 after 闭包、train.py 的 choice '3' 未定义变量与死代码 run(self)、button_pixels_sample 结构或路径与消费者不一致、tk_variables 未用导致 no default root）导致反复改错或理解偏差，可视为未先通读约定所致。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档.md 中增加对本文的引用。
