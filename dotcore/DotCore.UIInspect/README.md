# DotCore.UIInspect

UI 检测与操作类库，基于 **FlaUI.UIA3**（Windows UI Automation）。用于枚举窗口控件、导出 UI 树、点击按钮、读写编辑框等。

## 官方文档与用法

- **FlaUI 仓库与说明**: https://github.com/FlaUI/FlaUI  
- **FlaUI 基本用法**: 通过 `Application.Launch/Attach` 获取进程，`GetMainWindow(automation)` 得到主窗口，再在树上查找子元素并调用 Pattern（Invoke、Value 等）。  
- **入口示例**（来自 FlaUI README）:
  ```csharp
  var app = Application.Attach(processId);
  using var automation = new UIA3Automation();
  var window = app.GetMainWindow(automation);
  var button1 = window.FindFirstDescendant(cf => cf.ByText("1"))?.AsButton();
  button1?.Invoke();
  ```
  本库在无依赖 FlaUI 条件查询的前提下，用树遍历实现按 Name/AutomationId 查找，并用同一套 Pattern 做 Invoke/Value 操作。

## 本库提供的功能

### 检测 / 枚举

| 类 / 方法 | 说明 |
|-----------|------|
| **UIButtonEnumerator.GetClickableButtons(Process)** | 递归收集所有支持 Invoke 或 ControlType=Button 的控件，返回 `ClickableItem(Name, ControlType, AutomationId)`。 |
| **UIInspectPrinter.PrintClickableButtons(Process)** | 将上述列表打印到 Console。 |
| **UIElementDumper.DumpAllElements(Process, maxDepth)** | 导出完整 UI 树为文本（ControlType \| Name \| AutomationId \| Value/ClassName/HelpText），用于 DEBUG 战网 UI 等。 |
| **ElectronDetector.IsElectron(Process)** | 判断进程主窗口是否为 Electron/Chrome 系。 |

### UI 操作（基于 FlaUI Patterns）

| 类 / 方法 | 说明 |
|-----------|------|
| **UIOperations.GetMainWindow(Process)** | 获取进程主窗口 `AutomationElement`。 |
| **UIOperations.FindFirstByName(root, text, exactMatch)** | 按 Name 包含或等于查找第一个后代。 |
| **UIOperations.FindFirstByAutomationId(root, automationId)** | 按 AutomationId 查找第一个后代。 |
| **UIOperations.FindFirst(root, predicate, maxDepth)** | 按自定义条件深度优先查找。 |
| **UIOperations.Invoke(element)** | 对支持 Invoke 的控件执行点击（InvokePattern.Invoke）。 |
| **UIOperations.GetValue(element)** | 读取支持 Value 的控件的值（如编辑框）。 |
| **UIOperations.SetValue(element, value)** | 设置支持 Value 的控件的值。 |
| **UIOperations.InvokeByName(process, name, exactMatch)** | 按名称查找并 Invoke。 |
| **UIOperations.InvokeByAutomationId(process, automationId)** | 按 AutomationId 查找并 Invoke。 |
| **UIOperations.SetValueByAutomationId(process, automationId, value)** | 按 AutomationId 查找并 SetValue。 |
| **UIOperations.GetValueByAutomationId(process, automationId)** | 按 AutomationId 查找并 GetValue。 |

### 进程

| 类 / 方法 | 说明 |
|-----------|------|
| **ProcessLauncher.Launch(exePath)** | 启动指定 exe，返回 `Process`（失败返回 null）。 |

## 依赖

- **FlaUI.UIA3**（NuGet）：Windows UI Automation UIA3 封装，提供 `Application`、`UIA3Automation`、`AutomationElement`、`Patterns.Invoke`、`Patterns.Value` 等。

## 使用场景

- d3check：Log 页「Debug Battle.net UI」调用 `UIElementDumper.DumpAllElements`，写临时文件并用记事本打开、在日志区输出。  
- 战网/其他客户端自动化：通过 `UIOperations` 按名称或 AutomationId 查找按钮/编辑框，执行 Invoke 或 Get/Set Value。
