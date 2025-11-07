# pycore 与 ncore 功能映射关系

## 模块对应关系

### pyfoundations
- `__init__.py`: 基础类库整合，对应 ncore 的 `foundation/common` 目录
- `color_print.py`: 日志输出功能，对应 ncore 的 `foundation/common/logger.js`
- `encyclopedia.py`: 全局常量管理，对应 ncore 的 `global_vars/index.js`

### pygvar
- `__init__.py`: 全局变量管理，对应 ncore 的 `global_vars/global_dir/globaldir.js`
- `global_var_manager.py`: 变量计算与存储，对应 ncore 的 `global_vars/tool/gconfig.js`

### pyutils
- `common/`:
  - `__init__.py`: 工具类基础功能，对应 ncore 的 `foundation/utilities/index.js`
  - `window_finder.py`: 窗口查找功能，对应 ncore 的 `foundation/utilities/window_ops.js`
- `image_comparator.py`: 图像对比功能，对应 ncore 的 `foundation/utilities/image_ops.js`
- `image_matcher.py`: 图像匹配功能，对应 ncore 的 `foundation/utilities/image_matcher.js`
- `process_manager.py`: 进程管理功能，对应 ncore 的 `foundation/utilities/process_on.js`
- `tray_clicker.py`: 系统托盘操作，对应 ncore 的 `foundation/utilities/tray_ops.js`
- `window_ops.py`: 窗口操作功能，对应 ncore 的 `foundation/utilities/window_ops.js`

## 任务调度方案
- 使用 `async_scheduler.py` 作为核心调度器
- 所有功能模块需实现 `async initialize()` 和 `async execute()` 方法
- 通过 `scripts/async_scheduler.py` 的任务队列进行异步调用

## 迁移建议
1. 优先迁移 `pyutils/common/` 和 `pyfoundations/` 模块
2. 保持 `pygvar/global_var_manager.py` 的变量计算逻辑
3. 建议增加 `pyutils/async_utils.py` 作为异步工具集
4. 所有模块需遵循 `#@global_vars` 和 `#@btools` 的引用规范