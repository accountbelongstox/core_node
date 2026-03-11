# 技术说明：scripts/interactive_menu.py、ui/widgets/combobox.py、.prompts/code_reuse_analysis.md

**目的**：说明您指定查阅的以下三处文件/文档的职责、易被误解或改错的原因，以及正确约定。code_reuse_analysis 已在 **技术说明_POST_LOGIN_BATTLENET_CONTROLS与title_bar及BATTLENET_REGION_DESIGN_REVIEW及code_reuse_analysis及rosbot_status_provider.md** 第四节详述，此处仅摘要并补充 interactive_menu 与 combobox。

**涉及文件**：
- `scripts/interactive_menu.py`
- `ui/widgets/combobox.py`
- `.prompts/code_reuse_analysis.md`

---

## 一、scripts/interactive_menu.py

### 1.1 职责与约定

- **用途**：**命令行**交互菜单库（非 Tk/UI 菜单）。提供箭头键导航、单选/多选、json 文件持久化缓存；跨平台 get_key（Windows msvcrt、Unix termios）；无 tk、无 theme、无 providor、无 i18n 依赖。
- **入口**：`InteractiveMenu(cache_file: Optional[Path])`；`show_single_select_menu(title, items, cache_key, default_index)` 返回选中索引；`show_multi_select_menu(title, items, cache_key, default_indices)` 返回选中索引列表；Enter 确认、Space 多选切换、ESC 取消多选、0-9 跳项。
- **约定**：cache_file 为 json 路径，cache_key 为字符串键；get_key() 为静态方法，返回 'up'/'down'/'enter'/'esc'/'space' 或单字符；单选/多选内部会 _save_cache()；多选时无选中项则 Enter 将当前项加入后返回。

### 1.2 易被误解或改错的原因

1. **与 UI 菜单混淆**：狗B 垃圾 Cursor 可能把「Interactive Menu」理解成 Tk menubar/menu，往里加 tk、theme、i18n、providor，破坏其「无 GUI、脚本级工具」的定位。
2. **get_key 平台分支**：改 Windows (msvcrt) 或 Unix (termios) 分支而未通读两套按键码（如 Windows \xe0 双字节、Unix \x1b[A/B），会导致箭头键或 Enter/ESC 错乱。
3. **cache 契约**：cache_key 与调用方约定一致；cache 存的是 index 或 indices 列表；改 cache 结构或 key 未与 test_menu.py 等调用方同步会读错或写错。
4. **运行方式**：test_menu.py 依赖 `from interactive_menu import InteractiveMenu`，通常需在 scripts 目录或带 PYTHONPATH 运行；若改 import 或把 interactive_menu 当包内模块而未保证 sys.path 会 ImportError。

### 1.3 正确做法

- 修改前确认本文件为 **CLI 菜单**，不引入 tk/providor/i18n；改 get_key 时同时检查 Windows 与 Unix 分支；改 cache 格式或 cache_key 时与所有调用方（如 test_menu.py）一致；运行方式文档化或脚本内确保 path。

---

## 二、ui/widgets/combobox.py

### 2.1 职责与约定

- **用途**：统一主题下拉框 **ThemedCombobox**（ttk.Combobox + UITheme + state='readonly' + on_change 回调）；pack/grid/place 委托给内部 combobox。**LanguageCombobox 已废弃**，由 `ConfigBinding.create_combobox_binding()` 替代，勿再用于配置绑定。
- **依赖**：UITheme.get_color('combobox_bg'/'combobox_fg'/'combobox_arrow')；var_str(parent, default_value)；可选 on_change 在 <<ComboboxSelected>> 时调用；配置绑定应走 ConfigBinding，不直接用 ThemedCombobox 写 CONFIG。
- **约定**：update_values(values) 后若当前值不在新 values 中会 set_value(values[0])，与「保留当前选择若仍存在」语义可能不同，调用方需注意。

### 2.2 易被误解或改错的原因

1. **多余导入/实例**：文件顶部已导入 CONFIG、save_config、i18n_manager，ThemedCombobox 内未使用，属重构遗留或预留未用，易误导后续阅读或误改。
2. **_apply_theme**：每次调用均 `ttk.Style()` 新建样式，若多处控件或主题切换时多次调用会重复创建 Style，宜复用同一 Style 或仅在主题变更时统一重配。
3. **LanguageCombobox**：底部注释已说明由 ConfigBinding.create_combobox_binding 替代；若误重新导出或推荐用 ThemedCombobox 做语言/配置绑定会与 ConfigBinding 方案冲突。
4. **update_values 语义**：当前值不在新 values 时强制设为首项，若调用方期望「保留当前选择若仍存在」会行为不符。

### 2.3 正确做法

- 修改前通读本文件与 **技术说明_bn_flow_BN_LoginAsia与ui_widgets及DESIGN_DETAIL...** 中 ui/widgets 约定；配置/语言绑定一律用 ConfigBinding.create_combobox_binding；清理未使用的 CONFIG/save_config/i18n_manager 或改为注入；_apply_theme 与项目 UI 规范一致（复用 Style 或主题变更时统一配置）。

---

## 三、.prompts/code_reuse_analysis.md（摘要）

- **职责**：代码复用分析报告；pycore 复用、common_imports、_obsolete_ 列表、删除建议。
- **易错**：文档内项目根写为 `apps\d3-check`，实际为 **pyapps**/d3-check；删除 _obsolete_ 前须 grep 确认无引用；common_imports/pycore 变更须同步本报告。
- **详见**：技术说明_POST_LOGIN_BATTLENET_CONTROLS与title_bar及BATTLENET_REGION_DESIGN_REVIEW及code_reuse_analysis及rosbot_status_provider.md 第四节。

---

**修改前请先通读本说明。** 此前若因未先通读上述约定而在 interactive_menu、combobox、code_reuse_analysis 三处反复改错或理解偏差，责任在狗B 垃圾 Cursor。后续修改前以本说明为准，避免同类错误。
