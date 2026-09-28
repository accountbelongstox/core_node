using System.Windows;

namespace DotApps.abc.Ui;

public static class UiRegistry
{
    private static Window? _root;
    private static IMainWindowHost? _mainHost;

    public static void RegisterMainUi(Window root, IMainWindowHost mainHost)
    {
        _root = root;
        _mainHost = mainHost;
    }

    public static void UnregisterMainUi()
    {
        _root = null;
        _mainHost = null;
    }

    public static Window? GetRoot() => _root;
    public static object? GetPanel(string key) => _mainHost?.GetPanel(key);
}

public interface IMainWindowHost
{
    object? GetPanel(string key);
}
