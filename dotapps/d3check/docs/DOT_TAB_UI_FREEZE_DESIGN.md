# DOT d3check: Tab UI Freeze — Issue Summary and Design Fix

## Problem (DOT version only)

- **Symptom**: Switching to tab[1] (Rosbot) then back to tab[0] causes the **entire UI to freeze** (dotapps/d3check WPF app).
- **Scope**: Framework/threading design in the DOT (C#/WPF) app, not Python.

## Root Causes

### 1. NotifyCallbacks thread contract violated

- **Contract** (IGameInterfaceData): `NotifyCallbacks()` must be called on the **main (UI) thread** only; callbacks (e.g. `UpdateStatusFromState`) touch WPF controls.
- **Violation**: `RosbotFlowController.RunAsync()` runs on the **thread pool** (after `await Task.Yield().ConfigureAwait(false)`) but calls `game.NotifyCallbacks()` directly at lines 70 and 80 → cross-thread UI access when flow runs.
- **Effect**: Undefined behaviour, possible deadlock or freeze when state updates hit controls from a non-UI thread.

### 2. Tab switch re-entrancy

- `OnTabSelectionChanged` ran `SwitchColorPrintToSelectedTab()` **synchronously** inside the selection-change event.
- That touches `TabMain.SelectedIndex`, `GetPage(...)` (TabItem.Content), and ColorPrinter register/unregister while the TabControl is still processing the selection/layout.
- Risk of re-entrancy or ordering issues with WPF layout/events.

### 3. Synchronous Dispatcher.Invoke for cross-thread UI updates

- LogPage and RosbotPage used `Dispatcher.Invoke` when marshaling from a non-UI thread to UI.
- MSDN recommends **BeginInvoke** for cross-thread UI work (asynchronous; control returns immediately). Using **Invoke** can contribute to blocking or deadlock patterns if the UI thread is ever waiting on something that depends on the calling thread.

### 4. LogPage ColorPrint callback

- Initially used unconditional `Dispatcher.Invoke(...)` (no `CheckAccess`). When the callback was invoked from the UI thread, same-thread Invoke could introduce unnecessary blocking/re-entrancy; when from background thread, Invoke blocks that thread and can interact badly with UI timing.

## Design Fixes Applied (DOT)

### A. GameInterfaceData: marshal NotifyCallbacks to UI

- Added `SetMarshalToUi(Action<Action>? marshal)`.
- `NotifyCallbacks()`: if `_marshalToUi` is set, call `_marshalToUi(DoNotifyCallbacks)`; else call `DoNotifyCallbacks()` on the current thread.
- MainWindow in `OnLoaded`: `GameInterfaceData.Instance.SetMarshalToUi(a => { if (Dispatcher.CheckAccess()) a(); else Dispatcher.InvokeAsync(a); });`
- MainWindow in `OnClosed`: `GameInterfaceData.Instance.SetMarshalToUi(null);`
- **Effect**: All callers (including RosbotFlowController and RosbotUpdateManager) can keep calling `NotifyCallbacks()`; when called from a background thread, the marshal posts `DoNotifyCallbacks` to the UI thread so callbacks always run on the UI thread.

### B. Defer tab switch logic (no work inside SelectionChanged)

- `OnTabSelectionChanged`: do **not** call `SwitchColorPrintToSelectedTab()` directly. Use `Dispatcher.BeginInvoke(DispatcherPriority.ApplicationIdle, (Action)SwitchColorPrintToSelectedTab)` so the callback runs **after** selection and layout are complete.
- **Effect**: Avoids re-entrancy and running GetPage/register/unregister in the same call stack as TabControl selection/layout.

### C. Cross-thread UI updates: use BeginInvoke

- **RosbotPage.OnGameStateSnapshot**: when `!Dispatcher.CheckAccess()`, use `Dispatcher.BeginInvoke(DispatcherPriority.Normal, () => OnGameStateSnapshot(s))` instead of `Invoke`.
- **RosbotPage.OnLogMessage**: same, use `BeginInvoke` instead of `Invoke`.
- **LogPage.OnColorPrintMessage**: when `!Dispatcher.CheckAccess()`, use `Dispatcher.BeginInvoke(DispatcherPriority.Normal, () => OnColorPrintMessage(...))`; when on UI thread, run the update directly.
- **Effect**: Aligns with MSDN; no synchronous wait from background to UI that could contribute to deadlock.

### D. LogPage ColorPrint: CheckAccess + marshal only when needed

- Before updating `TxtLog`, check `Dispatcher.CheckAccess()`; only when false, marshal with `BeginInvoke`; when true, append and scroll directly.
- **Effect**: Safe from any thread; avoids same-thread Invoke and keeps behaviour consistent with RosbotPage.

## Call sites of NotifyCallbacks (DOT)

- **MainWindow**: `StatePollTimer_Tick` → `Task.Run` then `dispatcher.InvokeAsync(() => NotifyCallbacks())` (already UI-thread).
- **MainWindow**: `ApplyScanResults` (runs on UI via InvokeAsync) → `NotifyCallbacks()` (UI).
- **RosbotPage**: multiple button/timer handlers (UI thread) → `NotifyCallbacks()`; marshal ensures no cross-thread when called from elsewhere.
- **RosbotFlowController**: `RunAsync()` (thread pool) → `NotifyCallbacks()`; **must** go through marshal → UI (SetMarshalToUi).
- **RosbotUpdateManager**: can be called from background → `NotifyCallbacks()`; marshal handles.
- **Ctl/RosbotRunFlow**: any call to `NotifyCallbacks()` from async/thread pool is covered by marshal.

## References

- MSDN: Dispatcher.CheckAccess, BeginInvoke (asynchronous), Invoke (synchronous).
- MSDN: DispatcherPriority (Loaded = after layout/render; ApplicationIdle = when app is idle).
- IGameInterfaceData: NotifyCallbacks must be on main thread unless marshal is used.
