# 托盘图标调试指南

## 当前状态

已添加详细的debug日志到以下文件：
- `ui/tray.py` - 托盘菜单实现
- `ui/main.py` - 主入口

## 测试步骤

### 步骤1：测试pystray基础功能（无setup）

```bash
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
python test_tray_simple.py
```

**预期结果：**
```
====================================================
Simplified Tray Test (No Setup Callback)
====================================================
1. Creating icon image...
   ✓ Icon created: (64, 64) RGB
2. Creating menu...
   ✓ Menu created: <Menu object>
3. Creating pystray.Icon instance...
   ✓ Icon instance created: <Icon object>
4. Starting icon.run() WITHOUT setup parameter...
   >> Check system tray for icon!
   >> Right-click and select 'Quit' to exit
```

**然后：**
- 检查系统托盘（右下角）是否出现图标
- 右键点击图标选择"Quit"退出

**如果成功：** pystray基本功能正常，继续步骤2
**如果失败：** pystray库或系统有问题，见"解决方案A"

---

### 步骤2：测试pystray WITH setup回调

```bash
python test_tray_with_setup.py
```

**预期结果：**
```
====================================================
Tray Test WITH Setup Callback
====================================================
1. Creating icon image...
   ✓ Icon created: (64, 64) RGB
2. Creating menu...
   ✓ Menu created: <Menu object>
3. Creating pystray.Icon instance...
   ✓ Icon instance created: <Icon object>
4. Starting icon.run() WITH setup parameter...
   Setup callback: <function setup_callback>
   >> Check system tray for icon!
>>> setup_callback called!
    icon: <Icon object>
    icon.visible: True
    Creating background thread...
    Thread created: <Thread object>
    Starting thread...
    Thread started!
<<< setup_callback completed
>>> Background thread started
    Background tick 1
    Background tick 2
    ...
```

**如果成功：** setup回调工作正常，问题在device_sync代码中
**如果失败：** setup回调有问题，见"解决方案B"

---

### 步骤3：查看device_sync详细日志

重启device_sync，查看日志：

```bash
tail -f C:\Users\MPC\AppData\Local\Temp\device_sync\device_sync_launcher.log
```

**现在日志应该包含：**
```
INFO - Starting tray menu...
INFO - Creating tray icon image...
INFO - Icon image created: (64, 64) RGB
INFO - Creating tray menu...
INFO - Menu created: <Menu object>
INFO - Creating pystray.Icon instance...
INFO - pystray.Icon instance created: <Icon object>
INFO - Starting tray icon event loop (blocking)...
INFO -   setup callback: <function _setup_periodic_scan>
INFO - === _setup_periodic_scan called ===
INFO -   icon parameter: <Icon object>
INFO -   icon.visible: True
INFO - Creating periodic scan thread...
INFO - Scan thread created: <Thread object>
INFO - Starting scan thread...
INFO - Scan thread started successfully
INFO - === _setup_periodic_scan completed ===
INFO - >>> Periodic scan thread started
```

**关键问题：**
- 卡在哪一步？
- 有没有ERROR日志？
- icon.visible是True还是False？

---

## 可能的问题和解决方案

### 问题A：test_tray_simple.py失败

**症状：** 即使最简单的pystray也不工作

**可能原因：**
1. pystray版本太旧
2. Pillow版本不兼容
3. Windows系统托盘被禁用

**解决方案：**

1. 检查版本：
```bash
pip list | findstr "pystray pillow"
```

2. 更新依赖：
```bash
pip install --upgrade pystray pillow
```

3. 检查Windows托盘设置：
   - 任务栏右键 → 任务栏设置
   - 通知区域 → 选择哪些图标显示在任务栏上
   - 确保"总是显示所有图标"已开启

4. 尝试重装pystray：
```bash
pip uninstall pystray
pip install pystray==0.19.5
```

---

### 问题B：test_tray_with_setup.py失败但simple成功

**症状：** setup回调导致失败

**可能原因：**
- setup回调中创建线程有问题
- icon.visible属性访问失败

**解决方案：**

修改`ui/tray.py`的`_setup_periodic_scan`，简化实现：

```python
def _setup_periodic_scan(self, icon):
    """Setup periodic network scanning"""
    logger.info("Setup called - icon is ready")
    # 不创建后台线程，使用icon.run_detached()
```

---

### 问题C：测试脚本成功但device_sync失败

**症状：** 测试脚本能显示托盘图标，但device_sync不行

**可能原因：**
- device_sync代码中的某些逻辑有问题
- 菜单太复杂
- _get_title()方法有问题

**解决方案：**

1. 查看详细日志找到失败点

2. 简化菜单 - 临时使用最简单的菜单：
```python
menu = pystray.Menu(
    pystray.MenuItem("Quit", self._on_exit)
)
```

3. 简化title：
```python
title="Device Sync"  # 不调用_get_title()
```

---

### 问题D：icon.run()静默卡住

**症状：** 日志显示"Starting tray icon event loop"后卡住，没有错误

**可能原因：**
- pystray内部死锁
- Windows GUI事件循环问题

**解决方案：**

1. 尝试不使用setup参数：
```python
# 修改tray.py
self.icon.run()  # 移除setup参数
```

2. 使用run_detached()：
```python
# 修改tray.py
import threading
def run_icon():
    self.icon.run_detached()
    self._setup_periodic_scan(self.icon)

thread = threading.Thread(target=run_icon, daemon=True)
thread.start()

# 保持主线程运行
import signal
signal.pause()  # Unix
# 或
while True:
    time.sleep(1)  # Windows
```

---

## 日志解读

### 正常日志流程：

```
1. Starting tray menu...
2. Creating tray icon image...
3. Icon image created: (64, 64) RGB
4. Creating tray menu...
5. Menu created: <pystray.Menu object>
6. Creating pystray.Icon instance...
7. pystray.Icon instance created: <pystray.Icon object>
8. Starting tray icon event loop (blocking)...
9. === _setup_periodic_scan called ===
10. icon.visible: True
11. Creating periodic scan thread...
12. Scan thread created: <Thread>
13. Starting scan thread...
14. Scan thread started successfully
15. === _setup_periodic_scan completed ===
16. >>> Periodic scan thread started
[托盘图标应该已显示，程序在此阻塞运行]
```

### 异常情况：

**卡在步骤2-3：** 图标创建失败，检查PIL/Pillow
**卡在步骤4-5：** 菜单创建失败，简化菜单
**卡在步骤6-7：** pystray.Icon初始化失败
**卡在步骤8：** icon.run()调用后卡住，这是最常见的问题
**卡在步骤9-10：** setup回调未被调用或icon.visible为False

---

## 快速诊断命令

```bash
# 查看最新日志
tail -n 100 C:\Users\MPC\AppData\Local\Temp\device_sync\device_sync_launcher.log

# 检查pystray版本
python -c "import pystray; print(pystray.__version__)"

# 检查Pillow版本
python -c "from PIL import Image; print(Image.__version__)"

# 测试简单托盘
cd D:\programing\core_node\pycore\pyutils\launcher\device_sync
python test_tray_simple.py

# 测试带setup的托盘
python test_tray_with_setup.py
```

---

## 报告问题

如果以上方法都无法解决，请提供：

1. 测试脚本结果：
   - test_tray_simple.py 是否成功？
   - test_tray_with_setup.py 是否成功？

2. 版本信息：
   ```bash
   pip list | findstr "pystray pillow"
   ```

3. 完整日志（最后100行）：
   ```bash
   tail -n 100 C:\Users\MPC\AppData\Local\Temp\device_sync\device_sync_launcher.log
   ```

4. Windows版本和托盘设置

5. 是否有其他托盘应用正常工作？
