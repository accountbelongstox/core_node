using DotCore.Utils;

namespace DotApps.d3check.Config;

/// <summary>
/// Config change notification hub. Logic 1:1 with Python config_change_hub.
/// When config is updated (e.g. hotkey in UI), call Notify so subscribers (e.g. hotkey binder) can rebind.
/// </summary>
public static class D3CheckConfigChangeHub
{
    public static ConfigChangeNotifier Notifier { get; } = new();

    /// <summary>
    /// Notify subscribers that config at the given path (or under it) changed. Call after saving hotkeys, etc.
    /// </summary>
    public static void Notify(string? keyPath)
    {
        Notifier.NotifyConfigChanged(keyPath);
    }
}
