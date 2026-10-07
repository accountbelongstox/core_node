// PY-REF: pyapps/d3-check/d3utils/rosbot_operation.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// ROSBOT operation: get/activate window, after-start automation, resume, UI state (KEY dialog -> need key).
/// Process/window via <see cref="RosbotManager"/>; UI automation via <see cref="RosbotUiAutomation"/>.
/// The KEY dialog signature is the window title (docs/rosbot_ui_elements_1.json is not shipped, so the Python fallback "Error" applies).
/// 1:1 Python d3utils/rosbot_operation.py.
/// </summary>
public sealed class RosbotOperation : IRosbotOperation
{
    private readonly Func<string>? _needKeyMessageProvider;

    /// <summary>needKeyMessageProvider: localized "key required" text (Python i18n rosbot.need_key_message).</summary>
    public RosbotOperation(Func<string>? needKeyMessageProvider = null)
    {
        _needKeyMessageProvider = needKeyMessageProvider;
    }

    /// <inheritdoc />
    public RosbotWindowInfo? GetWindow() => RosbotManager.Instance.GetRosbotWindow();

    /// <inheritdoc />
    public bool ActivateWindow()
    {
        var win = GetWindow();
        if (win == null)
        {
            ColorPrinter.Yellow("[RosbotOperation] No ROSBOT window to activate");
            return false;
        }
        if (!NativeWindowHelper.ActivateWindow(win.Hwnd))
        {
            ColorPrinter.Red("[RosbotOperation] Activate error");
            return false;
        }
        ColorPrinter.Blue("[RosbotOperation] ROSBOT window activated");
        return true;
    }

    /// <inheritdoc />
    public bool RunAfterRosbotStart(int waitSec = 30, bool doDebug = true, bool doTab = true, bool doStartBotting = true, Func<bool>? shouldStop = null) =>
        RosbotUiAutomation.RunAfterRosbotStart(waitSec, doDebug, doTab, doStartBotting, shouldStop);

    /// <inheritdoc />
    public bool ResumeRosbot(bool doTab = true, bool doStartBotting = true) =>
        RosbotUiAutomation.ResumeRosbotUi(doTab, doStartBotting);

    /// <inheritdoc />
    public RosbotUiState GetUiState(IReadOnlyList<int>? pids = null)
    {
        var mgr = RosbotManager.Instance;
        IReadOnlyList<int> scan = pids is { Count: > 0 } ? pids.Distinct().ToList() : mgr.CollectRosbotPids();
        foreach (int pid in scan)
        {
            foreach (var w in mgr.FindWindowsByPid(pid, visibleOnly: false))
            {
                if (w.Title.Trim() != RosbotConstants.KeyDialogWindowTitleDefault) continue;
                return new RosbotUiState
                {
                    NeedKeyInput = true,
                    Message = _needKeyMessageProvider?.Invoke() ?? RosbotConstants.RosbotNeedKeyMessageFallback
                };
            }
        }
        return new RosbotUiState();
    }
}
