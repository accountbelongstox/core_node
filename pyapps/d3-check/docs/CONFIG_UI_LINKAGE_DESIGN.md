# CONFIG 与 UI 联动机制设计方案

## 一、目标与约束

- **目标**：提供一套公共、单例的 CONFIG 联动机制，供所有 UI（及 controller）使用；既能接收 UI 的反馈（写 CONFIG 后通知），又能响应式更新 UI（CONFIG 变更后刷新绑定控件或通知订阅方）。
- **约束**：
  - 仅实例化一次（单例/模块级唯一入口）。
  - 符合 `PROJECT_STANDARDS.md`：配置与事件从 providor / share 等既有层次接入；不引入 run_*/do_* 在 share 中；线程与生命周期见 § 二。
  - 不引入额外重量级依赖（如 RxPY）；以简单观察者 + 主线程派发为主。

## 二、现状简要

| 组件 | 职责 | 局限 |
|------|------|------|
| **providor CONFIG / CONFIG_QUEUE** | 内存 CONFIG 的读写由 config worker 串行执行；`set_config_value_async` 仅投递写入，无“写完成/变更”回调。 | 无法统一响应“某 key 或某类配置变了”。 |
| **ConfigBinding** | 按 key_path 注册 tk.Variable，`set_config_value` 时同步更新已注册控件。 | 只覆盖通过 ConfigBinding 绑定的控件；无“配置变更”的通用订阅。 |
| **主 UI + 各 Panel** | 主窗给各 panel 设 `set_config_change_callback(_on_config_change)`，期望 panel 在改配置后调用。 | 各 panel 未实现该方法，且写 CONFIG 路径分散（ConfigBinding、queue_config_save、直接写 CONFIG），无法统一触发回调。 |
| **event_center / THREAD_BUS** | 应用级事件（宏启停、窗口显示等）。 | 面向跨线程与业务事件，不适合细粒度“某条配置变更”的 UI 联动。 |

结论：需要一层**单一的“配置变更通知”入口**，与现有 CONFIG 写入方式配合，实现“写 → 通知 → 响应式更新 UI”。

## 三、推荐方案：配置变更中枢（Config Change Hub）单例

### 3.1 思路

- **单例**：在 **share/values** 下新增一个“配置变更中枢”模块，全局唯一实例（或模块级函数），供所有 UI 与 controller 调用。
- **双向关系**：
  - **UI → 中枢**：任何修改 CONFIG 的代码（UI 或非 UI）在修改后调用中枢的“通知”接口（例如 `notify_config_changed(key_path=None)`），表示“配置已变更”。
  - **中枢 → UI/Controller**：中枢维护“订阅者”列表；在**主线程**上派发“配置已变更”事件（含可选 key_path/scope），订阅者（如主窗、controller）收到后做刷新、重载当前配置等。
- **与 ConfigBinding 的关系**：  
  - 写 CONFIG 仍可走现有方式：`ConfigBinding.set_config_value`、`set_config_value_async`、`queue_config_save` 等。  
  - 在“写 CONFIG”的**同一逻辑**里（或在其后）增加对中枢的 `notify_config_changed` 调用；必要时在 ConfigBinding 内部统一调一次，避免遗漏。  
  - 中枢**不**替代 ConfigBinding 的 key_path → tk.Variable 绑定，只负责“变更通知 + 主线程派发”；响应式更新控件仍由 ConfigBinding._update_bindings 完成（或由订阅者自行根据 key_path 刷新）。

### 3.2 职责划分

| 层级 | 职责 |
|------|------|
| **share/values/config_change_hub**（新） | 单例；维护订阅者；提供 `subscribe(callback)`、`unsubscribe(id)`、`notify_config_changed(key_path=None)`；保证在主线程执行回调（需 root.after(0, ...) 时由调用方传入 root 或从 ui_registry 取 root）。 |
| **providor** | 不变；CONFIG 的读写、队列、持久化仍由现有 config worker / SAVE_QUEUE 负责。 |
| **ui/utils/config_binding.py** | 在 `set_config_value`（及必要时其他写 CONFIG 的入口）末尾调用 config_change_hub.notify_config_changed(key_path)；保持现有 _register_binding / _update_bindings 逻辑。**仅当非 _update_bindings 重入时通知**（即 `if ConfigBinding._updating` 时只做 set + _update_bindings 并 return，不调用 notify），避免控件同步触发 trace 导致连锁 notify 与主线程卡顿。 |
| **主 UI** | 启动时向 config_change_hub 订阅一次，收到通知后调用现有 `_on_config_change`（再转给 controller 的 on_ui_config_change）；不再给各 panel 单独 `set_config_change_callback`。主 UI 需实现 `get_skill_config(config_name)`、`get_auxiliary_config()`（从 CONFIG 读，如 get_config_value_safe），供 controller 的 on_ui_config_change 同步当前配置。 |
| **各 Panel** | 凡修改 CONFIG 的地方（包括直接写 CONFIG + queue_config_save），在修改后调用 config_change_hub.notify_config_changed(key_path 或 scope)；不再需要各自实现 set_config_change_callback，由中枢统一通知。 |

### 3.3 单例与主线程派发

- **单例**：模块级 `_hub = None`，`get_config_change_hub(root=None)`：首次调用时创建并可选传入 `root`（Tk）用于 `root.after(0, ...)`；若未传则从 `share.ui_registry.get_root()` 取；若仍无则同步执行回调（仅当 UI 未创建时）。
- **主线程**：`notify_config_changed` 内将“执行所有订阅者回调”通过 `root.after(0, lambda: _dispatch(key_path))` 投递到主线程，避免其他线程改 CONFIG 后直接回调导致 Tk 跨线程访问。

### 3.4 可选：按 key_path/scope 过滤

- `notify_config_changed(key_path=None)`：`key_path` 为 None 表示“任意配置变更”；可为 `"macro_configs.current_skill_config"` 等。
- `subscribe(callback, key_prefix=None)`：仅当 `key_path` 以 `key_prefix` 开头时才调用该 callback；key_prefix 为 None 表示接收所有变更。
- 这样 controller 可只订阅 `macro_configs.` 或 `ui_settings.`，减少无效刷新。

### 3.5 与官方/社区做法的对应

- **Observer / 发布订阅**：中枢本质是单例的 Observer：发布方 `notify_config_changed`，订阅方 `subscribe`；符合常见“配置变更通知”模式。
- **响应式更新 UI**：不引入 RxPY/Reaktiv 等库；通过“写 CONFIG → 通知中枢 → 主线程派发 → 订阅者更新 UI / ConfigBinding 更新控件”实现，与 Tk 主线程模型一致。
- **单例**：配置变更总线全局唯一，与项目内 ui_registry、event_center 等单例风格一致。

## 四、接口草案（供实现参考）

```text
# share/values/config_change_hub.py（或 share/config_change_hub.py，以项目约定为准）

get_config_change_hub(root: Optional[tk.Tk] = None) -> ConfigChangeHub

class ConfigChangeHub:
    def subscribe(self, callback: Callable[[Optional[str]], None], key_prefix: Optional[str] = None) -> str
        # 返回 subscription_id，用于 unregister。
    def unsubscribe(self, subscription_id: str) -> None
    def notify_config_changed(self, key_path: Optional[str] = None) -> None
        # 主线程派发：对 key_prefix 匹配的订阅者调用 callback(key_path)。
```

- 回调签名：`callback(key_path: Optional[str])`，便于订阅者按 key_path 做增量刷新或忽略无关 key。

## 五、迁移与兼容

1. **Phase 1**：实现 config_change_hub 单例及上述接口；在 ConfigBinding.set_config_value 末尾调用 `get_config_change_hub().notify_config_changed(key_path)`。
2. **Phase 2**：主 UI 在创建完成后 `subscribe` 一次，在回调中调用现有 `_on_config_change`；controller 仍通过主 UI 的 `set_config_change_callback(on_ui_config_change)` 挂接，无需各 panel 再实现 set_config_change_callback。
3. **Phase 3**：所有直接写 CONFIG 或 queue_config_save 的 UI 代码路径（含各 panel），在写后增加 `get_config_change_hub().notify_config_changed(...)`；可逐步移除各 panel 的 set_config_change_callback 依赖（若不再需要 panel 级回调则删除对应调用）。

## 六、实现注意（防卡顿与无响应）

- **ConfigBinding 重入**：`_update_bindings` 里 `var.set()` 会触发控件的 trace，再次进入 `set_config_value`。若此时仍调用 notify，会形成大量 after(0) 派发和 on_ui_config_change，导致主线程在 tab 切换或初始化时卡顿、无响应。因此在 `set_config_value` 开头判断 `ConfigBinding._updating`，为 True 时仅执行 set + _update_bindings 并 return，不调用 notify_config_changed。
- **主 UI 提供 get_skill_config / get_auxiliary_config**：controller 的 on_ui_config_change 会调用 `self.ui.get_skill_config`、`self.ui.get_auxiliary_config` 再写回 CONFIG。若主 UI 未实现这两方法会 AttributeError，回调异常会导致后续事件处理异常、表现为卡死或无法操作。主 UI 应从 CONFIG（如 get_config_value_safe）读取并返回对应 dict。

## 七、小结

- **单例**：config_change_hub 在 share/values 中唯一实例，通过 get_config_change_hub() 获取。
- **收 UI 反馈**：任何 UI（或非 UI）在修改 CONFIG 后调用 `notify_config_changed(key_path)` 即可。
- **响应式更新 UI**：订阅者在主线程收到通知后刷新界面或依赖 ConfigBinding 的既有 _update_bindings；可选 key_prefix 减少无效刷新。
- **不新增重型依赖**，与现有 CONFIG、ConfigBinding、event_center、ui_registry 兼容，符合 PROJECT_STANDARDS 的层次与 share 分区要求。
