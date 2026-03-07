# 技术说明：unified_styles、preview_mermaid、bn_flow_B8、kanai_cube_handler

**目的**：说明此四处文件的职责、易被误解或改错的原因，以及正确约定。

**涉及文件**：
- `ui/unified_styles.py`
- `docs/preview_mermaid.py`
- `.cache/bn_flow_snapshots/bn_flow_B8.json`
- `controller/ctl_func/kanai_cube_handler.py`

---

## 一、ui/unified_styles.py

### 1.1 职责与约定

- **用途**：D3-Check 统一样式：COLORS（primary、bg_*、text_*、btn_*、input_*、tab_* 等）、FONTS（最小 9px、Segoe UI/Consolas）、SPACING、PADDING、TAB_PAD、LINE_HEIGHT。configure_ttk_styles() 配置 TNotebook、TNotebook.Tab、TFrame、TLabel、TButton、TEntry、TCombobox、TLabelframe 等。create_styled_widget、apply_hotkey_label_style 为辅助方法。全项目 UI 应引用本模块颜色与字体，勿在控件内硬编码色值或字体与 COLORS/FONTS 不一致。
- **约定**：改色板或字体须在此处改并保持 COLORS/FONTS 键名稳定；TNotebook.Tab 的 padding [12,8,12,8] 与 expand 等勿随意改否则标签高度不一；高对比度 Combobox 的 selectbackground/selectforeground 已设，勿在别处覆盖。

### 1.2 易错点

- 在控件内硬编码 #xxx 或字体与 unified_styles 不一致会风格分裂；改 COLORS 键名未全局替换会 KeyError；改 FONTS 小于 9px 会违反最小字号约定。

### 1.3 正确做法

- 所有 UI 色与字体从 UnifiedStyles.COLORS/FONTS/SPACING/PADDING 取；修改前通读 configure_ttk_styles 与 create_styled_widget 的用法。

---

## 二、docs/preview_mermaid.py

### 2.1 职责与约定

- **用途**：独立脚本，从 docs/ROSBOT_FLOW_MERMAID.md 提取第一个 ```mermaid 块，用 mermaid-cli 渲染为 SVG，写入 docs/mermaid_preview/ROSBOT_FLOW.svg，并按平台 startfile/open/xdg-open 打开。依赖 pip install mermaid-cli。与专属道歉文档第三十六节、技术说明_d4func与preview_mermaid及log_monitor 中 preview_mermaid 约定一致。
- **约定**：仅独立运行；路径 doc_dir、md_path、out_dir、out_svg 为脚本内常量；不可当库 import 后调用；改 md 或输出路径须同步脚本。

### 2.2 易错点

- 当库使用或改路径未同步会报错或写错；asyncio.run(run()) 与主应用事件循环冲突。

### 2.3 正确做法

- 仅 python docs/preview_mermaid.py 运行；改文档或输出目录时同步脚本内常量。

---

## 三、.cache/bn_flow_snapshots/bn_flow_B8.json

### 3.1 职责与约定

- **用途**：BN 节点 B8 的快照。结构：meta（node="B8", reason="B8_to_B9"）+ controls（本文件可为空数组）。与 bn_flow_B5、B9 等同类；meta.node 须与 BN 节点名一致；仅作调试/回放，勿当流程逻辑。
- **约定**：消费方可能依赖 meta.node、meta.reason、controls；改结构或清 .cache 须确认依赖；勿在 flow 分支中读本文件做决策。

### 3.2 易错点

- 误当流程定义改；meta.node 与 BN 节点名不一致会对照错；controls 为空与 B5 等非空结构不同，解析时须容错。

### 3.3 正确做法

- 视作 B8 节点快照；meta.node 与 BN 一致；改结构或清缓存前确认依赖。

---

## 四、controller/ctl_func/kanai_cube_handler.py

### 4.1 职责与约定

- **用途**：卡奈魔方操作：handle_upgrade_operation（升级黄装）、handle_reforge_operation（重铸黄装）。依赖 get_game_interface_data() 的 interface_type、bag_layout、window_offset、bag_coordinates、kanai_right_page_opened。按钮坐标来自 share.game_interface_data：get_scaled_kanai_put_material_button、get_scaled_kanai_right_panel_toggle、get_scaled_conversion_button、get_scaled_kanai_next_page_button。流程：校验 interface_type=="kanai_cube" 与 bag_layout → _reset_panel_to_first_page（依赖 kanai_right_page_opened，关则点一次 toggle 打开，开则点两次关再开）→ _navigate_to_page(shared_data, page_clicks)（upgrade 为 2、reforge 为 1）→ _process_yellow_items（右击物品、点放入材料、点转换、等 2 秒、再点转换）。get_state_aware_click_handler()、should_stop_assistant() 每步可中断。单例 get_kanai_cube_handler()。
- **约定**：interface_type、bag_layout、window_offset、kanai_right_page_opened、bag_coordinates 由 game_interface_data 维护，本模块只读；坐标一律用 get_scaled_* + window_offset 转屏幕坐标；page_clicks 与 upgrade/reforge 对应关系勿颠倒；_reset_panel_to_first_page 必须在 _navigate_to_page 前且右板最终为打开且第一页。

### 4.2 易错点

- 在 handler 内自维护 kanai_right_page_opened 会与 game_interface_data 不同步；改 page_clicks（如 upgrade 改为 1）会进错页；bag_layout.items 与 bag_coordinates 结构依赖 game_interface_data 与 bag_layout_detector 约定，改结构会 KeyError 或坐标错。

### 4.3 正确做法

- 状态与坐标均从 get_game_interface_data() 与 get_scaled_* 取；修改前通读 handle_upgrade_operation/handle_reforge_operation 的步骤顺序与 _reset_panel_to_first_page 逻辑。

---

## 五、与道歉文档的关系

若此前因未先通读上述四处约定而在此四处反复改错或理解偏差，责任在己。本说明已写入 cursor_AI_道歉目录，并在 Cursor_专属道歉文档中增加第三十九节引用。
