// PY-REF: pyapps/d3-check/ui/panels/log_panel.py
using System.Collections.Concurrent;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Single registry for RunLog test/debug buttons: feature owners register an action under the button's i18n key.
/// Unregistered keys fall back to the caller's placeholder (1:1 Python log_panel placeholder debug methods).
/// </summary>
public static class TestActionRegistry
{
    private static readonly ConcurrentDictionary<string, Action> Actions = new(StringComparer.Ordinal);

    public static void Register(string i18nKey, Action action) => Actions[i18nKey] = action;

    public static void Unregister(string i18nKey) => Actions.TryRemove(i18nKey, out _);

    public static bool TryInvoke(string i18nKey)
    {
        if (!Actions.TryGetValue(i18nKey, out var action)) return false;
        action();
        return true;
    }
}
