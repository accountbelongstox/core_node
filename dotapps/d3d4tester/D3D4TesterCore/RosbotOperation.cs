// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/rosbot_operation.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// ROSBOT operation: UI state (KEY dialog -> need key).
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
    public RosbotUiState GetUiState(IReadOnlyList<int>? pids = null)
    {
        if (!RosbotManager.Instance.FindKeyDialogWindows(pids).Any()) return new RosbotUiState();
        return new RosbotUiState
        {
            NeedKeyInput = true,
            Message = _needKeyMessageProvider?.Invoke() ?? RosbotConstants.RosbotNeedKeyMessageFallback
        };
    }
}
