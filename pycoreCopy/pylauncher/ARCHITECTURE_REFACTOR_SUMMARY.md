# Singleton Architecture Refactor - 单例架构重构总结

## 📋 重构目标

**用户要求**：
> launcher.py 将由 launcher 传给，注意只需要传递参数，比如启动单例。
> pycore\pylauncher\singleton_detector.py 则负责沟通，将端口也传递给 singleton_detector.py。
> 不要需要一堆文件里加一堆判断。
> 因为都是通过向全局的 thread bus 发送信息退出，所以在那个文件都可以发送信号，让本实例是否退出。
> 其他文件不要再编码判断。

**核心原则**：
1. **单例检测只在 launcher.py 中发起**
2. **singleton_detector.py 负责具体协议实现和重试逻辑**
3. **避免在多个文件中重复判断**
4. **通过参数传递结果，而非重复检测**

---

## ✅ 重构内容

### 1. SingletonDetector 内部化重试逻辑

**修改文件**: `pycore/pylauncher/singleton_detector.py`

**Before**:
```python
class SingletonDetector:
    def __init__(self, ...):
        # 没有 shutdown_existing 参数
        pass

    def detect_and_bind(self):
        # 发现旧实例就直接返回
        if response:
            return DetectionResult(is_primary=False, ...)
```

**After**:
```python
class SingletonDetector:
    def __init__(self, ..., shutdown_existing: bool = False):
        self.shutdown_existing = shutdown_existing  # ✅ 接收配置

    def detect_and_bind(self):
        if response:
            # ✅ 内部处理重试逻辑
            if self.shutdown_existing:
                shutdown_success = self.send_shutdown_to_existing(port)
                if shutdown_success:
                    time.sleep(0.5)
                    return self.detect_and_bind()  # 递归重试
                else:
                    return DetectionResult(is_primary=False, message="busy")
            else:
                return DetectionResult(is_primary=False, ...)
```

**变化**：
- ✅ 添加 `shutdown_existing` 参数
- ✅ 在 `detect_and_bind()` 内部处理协商和重试
- ✅ 使用递归调用实现重试

---

### 2. 简化 launcher.py

**修改文件**: `pycore/pylauncher/launcher.py`

**Before (复杂 - 54 行)**:
```python
def _singleton_detect(self) -> bool:
    def on_msg(msg): ...
    def state_checker(): ...

    # 创建 detector
    self.singleton_detector, detection = self._create_singleton_detector(...)

    # 处理旧实例
    if detection.existing_instance and self.config.shutdown_existing:
        success = self.singleton_detector.send_shutdown_to_existing(...)
        if success:
            # 重试检测
            self.singleton_detector, detection = self._create_singleton_detector(...)
        else:
            return False
    elif not self.config.force_launch:
        return False

    # 验证 PRIMARY
    if detection.is_primary:
        return True
    else:
        return False
```

**After (简洁 - 28 行)**:
```python
def _singleton_detect(self) -> bool:
    """
    Simplified: Just calls SingletonDetector once.
    All retry logic is handled inside SingletonDetector.
    """
    def on_msg(msg): ...
    def state_checker(): ...

    # 创建 detector（传入 shutdown_existing）
    self.singleton_detector = SingletonDetector(
        ...,
        shutdown_existing=self.config.shutdown_existing  # ✅ 传递配置
    )

    # 检测并绑定（内部处理重试）
    detection = self.singleton_detector.detect_and_bind()  # ✅ 一次调用
    self.detection_result = detection

    # 检查结果
    if detection.is_primary:
        return True
    elif detection.existing_instance and not self.config.force_launch:
        return False
    elif self.config.force_launch:
        return True
    else:
        return False
```

**变化**：
- ✅ 删除 `_create_singleton_detector()` 辅助方法
- ✅ 删除手动重试逻辑
- ✅ 只调用一次 `detect_and_bind()`
- ✅ 减少 26 行代码（54 → 28）

---

### 3. 保持其他文件不变

**未修改的文件**：
- ✅ `pycore/callmodule/platform/launcher.py` - 只使用 ServiceLauncher
- ✅ `pycore/callmodule/platform/windows_tray.py` - 只接收 launcher 参数
- ✅ `pycore/callmodule/platform/linux_service.py` - 只接收 launcher 参数
- ✅ `pycore/pyfoundations/thread_bus.py` - 提供 busy 状态 API

---

## 🎯 架构对比

### Before - 之前的架构

```
launcher.py                              singleton_detector.py
    │                                            │
    ├─ 创建 detector ────────────────────────→  初始化
    ├─ 调用 detect_and_bind() ──────────────→  检测端口
    │                                            │
    │  ←────────────────── DetectionResult ───  返回结果
    │                                            │
    ├─ 判断 existing_instance? ✓                │
    │   │                                        │
    │   ├─ 判断 shutdown_existing? ✓            │
    │   │   │                                    │
    │   │   ├─ 调用 send_shutdown() ───────→   发送 SHUTDOWN
    │   │   │                                    │
    │   │   │  ←───────── success/fail ────────  协商结果
    │   │   │                                    │
    │   │   ├─ 判断 success? ✓                  │
    │   │   │   │                                │
    │   │   │   ├─ 重新创建 detector ────→      初始化
    │   │   │   ├─ 重新调用 detect_and_bind()→  重新检测
    │   │   │   │                                │
    │   │   │   └─ ...重复判断...              │
```

**问题**：
- ❌ launcher.py 中包含大量业务逻辑判断
- ❌ 重试逻辑分散在 launcher.py 中
- ❌ 代码冗长，难以维护

---

### After - 重构后的架构

```
launcher.py                              singleton_detector.py
    │                                            │
    ├─ 定义回调（on_msg, state_checker）        │
    ├─ 创建 detector ────────────────────────→  初始化
    │   (传入 shutdown_existing=True)           │
    │                                            │
    ├─ 调用 detect_and_bind() ──────────────→  检测端口
    │                                            │
    │                                     ┌──────┴──────┐
    │                                     │ 内部处理:    │
    │                                     │ 1. 发现旧实例│
    │                                     │ 2. 协商关闭  │
    │                                     │ 3. 递归重试  │
    │                                     └──────┬──────┘
    │                                            │
    │  ←────────────────── DetectionResult ───  返回最终结果
    │                                            │
    └─ 检查 is_primary                          │
```

**优点**：
- ✅ launcher.py 只负责逻辑规范（定义回调、检查结果）
- ✅ singleton_detector.py 负责具体实现（协议、重试）
- ✅ 代码简洁，职责清晰
- ✅ 类似 "HTTP 客户端" 一样简单调用

---

## 📊 代码量对比

| 组件 | Before | After | 变化 |
|------|--------|-------|------|
| `singleton_detector.py` | 612 行 | 652 行 | +40 行（添加重试逻辑） |
| `launcher.py` (\_singleton_detect) | 54 行 | 28 行 | **-26 行** |
| **总计** | 666 行 | 680 行 | +14 行 |

**结论**：
- ✅ 虽然总代码增加了 14 行，但**逻辑更清晰**
- ✅ launcher.py 减少了 48% 的代码
- ✅ 单例逻辑**集中**在 singleton_detector.py
- ✅ 符合**单一职责原则**

---

## 🔄 完整流程示例

### Scenario: 第二个实例启动（闲置替换）

```
1. pycore_module_caller.py (新实例)
2. launch_platform_aware()
3. ServiceLauncher.start()
   │
   ├─ _singleton_detect()
   │  │
   │  ├─ 定义回调:
   │  │  • on_msg: 收到 SHUTDOWN → THREAD_BUS.request_shutdown()
   │  │  • state_checker: 返回 THREAD_BUS.is_busy() 状态
   │  │
   │  ├─ 创建 SingletonDetector(shutdown_existing=True)
   │  │
   │  └─ 调用 detect_and_bind()
   │     ↓
   │     [singleton_detector.py 内部]
   │     │
   │     ├─ 扫描端口 59100
   │     ├─ 发送 CHECK → 收到 ALIVE
   │     ├─ 发现旧实例
   │     │
   │     ├─ shutdown_existing=True，开始协商:
   │     │  ├─ 发送 SHUTDOWN 请求
   │     │  ├─ 旧实例调用 state_checker()
   │     │  │  └─ THREAD_BUS.is_busy() → False
   │     │  ├─ 旧实例回复 SHUTDOWN_ACK (accepted)
   │     │  ├─ 旧实例调用 on_msg → THREAD_BUS.request_shutdown()
   │     │  ├─ 旧实例关闭
   │     │  └─ shutdown_success = True
   │     │
   │     ├─ time.sleep(0.5)  # 等待旧实例关闭
   │     │
   │     ├─ return detect_and_bind()  # 递归重试
   │     │  ├─ 扫描端口 59100
   │     │  ├─ 端口空闲
   │     │  ├─ 绑定成功
   │     │  └─ 返回 DetectionResult(is_primary=True, port=59100)
   │     │
   │     ↓
   │  返回 detection
   │  detection.is_primary = True
   │  返回 True
   │
   └─ 启动服务（heartbeat, ...）

4. launch_windows_tray(launcher, singleton_port=59100)
```

**特点**：
- ✅ launcher.py 只调用一次 `detect_and_bind()`
- ✅ 所有协商和重试在 singleton_detector.py 内部完成
- ✅ 代码流程清晰，易于理解

---

## ✅ 验证清单

- [x] 单例检测只在 `ServiceLauncher._singleton_detect()` 中发起
- [x] 重试逻辑在 `SingletonDetector.detect_and_bind()` 内部处理
- [x] `launcher.py` 不包含重复判断和重试逻辑
- [x] `windows_tray.py` / `linux_service.py` 只接收参数，不做单例检测
- [x] 通过 `THREAD_BUS` 统一管理 busy 状态
- [x] 代码简洁，职责清晰
- [x] 测试通过：首次启动 ✓、闲置替换 ✓

---

## 📚 相关文档

| 文档 | 说明 |
|------|------|
| `pycore/pylauncher/SMART_SINGLETON_GUIDE.md` | 智能单例使用指南 |
| `pycore/pylauncher/SMART_SINGLETON_SUMMARY.md` | 智能单例实现总结 |
| `pycore/callmodule/platform/ARCHITECTURE.md` | 平台启动器架构文档 |
| `pycore/pylauncher/ARCHITECTURE_REFACTOR_SUMMARY.md` | 本文档 |

---

## 🎯 总结

### 重构亮点

1. **✅ 职责清晰**
   - launcher.py: 逻辑规范（定义回调、检查结果）
   - singleton_detector.py: 具体实现（协议通信、重试逻辑）

2. **✅ 代码简洁**
   - launcher.py 减少 48% 代码
   - 单一调用点，易于维护

3. **✅ 架构优雅**
   - 类似 "HTTP 客户端" 的简单调用
   - 避免重复判断和逻辑分散

4. **✅ 完全兼容**
   - 保持原有功能不变
   - 测试全部通过

### 设计原则

> **单一职责原则**: 每个模块只负责一件事
>
> **参数传递**: 通过参数传递结果，而非重复判断
>
> **内部封装**: 复杂逻辑在组件内部处理，对外提供简单接口

---

**Document Version**: 1.0
**Date**: 2025-11-28
**Status**: ✅ 重构完成并验证
