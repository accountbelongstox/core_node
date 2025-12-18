# pycore and ncore Function Mapping

## Module Correspondence

### pyfoundations
- `__init__.py`: Foundation class library integration, corresponds to ncore's `foundation/common` directory
- `color_print.py`: Logging output functionality, corresponds to ncore's `foundation/common/logger.js`
- `encyclopedia.py`: Global constant management, corresponds to ncore's `global_vars/index.js`

### pygvar
- `__init__.py`: Global variable management, corresponds to ncore's `global_vars/global_dir/globaldir.js`
- `global_var_manager.py`: Variable calculation and storage, corresponds to ncore's `global_vars/tool/gconfig.js`

### pyutils
- `common/`:
  - `__init__.py`: Utility class foundation functionality, corresponds to ncore's `foundation/utilities/index.js`
  - `window_finder.py`: Window finding functionality, corresponds to ncore's `foundation/utilities/window_ops.js`
- `image_comparator.py`: Image comparison functionality, corresponds to ncore's `foundation/utilities/image_ops.js`
- `image_matcher.py`: Image matching functionality, corresponds to ncore's `foundation/utilities/image_matcher.js`
- `process_manager.py`: Process management functionality, corresponds to ncore's `foundation/utilities/process_on.js`
- `tray_clicker.py`: System tray operations, corresponds to ncore's `foundation/utilities/tray_ops.js`
- `window_ops.py`: Window operations functionality, corresponds to ncore's `foundation/utilities/window_ops.js`

## Task Scheduling Solution
- Use `async_scheduler.py` as core scheduler
- All functional modules need to implement `async initialize()` and `async execute()` methods
- Asynchronous calls through task queue in `scripts/async_scheduler.py`

## Migration Recommendations
1. Prioritize migration of `pyutils/common/` and `pyfoundations/` modules
2. Maintain variable calculation logic in `pygvar/global_var_manager.py`
3. Recommend adding `pyutils/async_utils.py` as async utility set
4. All modules must follow `#@global_vars` and `#@btools` reference conventions
