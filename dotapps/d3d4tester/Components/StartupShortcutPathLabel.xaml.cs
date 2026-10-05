using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;

namespace DotApps.d3d4tester.Components;

public partial class StartupShortcutPathLabel : UserControl
{
    public StartupShortcutPathLabel()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            StartupShortcutService.Changed += OnChanged;
            Refresh();
        };
        Unloaded += (_, _) => StartupShortcutService.Changed -= OnChanged;
    }

    private void OnChanged() => Dispatcher.BeginInvoke(Refresh);

    private void Refresh()
    {
        var p = D3D4TesterI18n.Provider;
        string? path = StartupShortcutService.GetShortcutPath();
        string key = StartupShortcutService.ShortcutExists() ? I18nKeys.StartupShortcutPath : I18nKeys.StartupShortcutPathMissing;
        TxtPath.Text = string.Format(p.GetUiText(key), path ?? "-");
    }
}
