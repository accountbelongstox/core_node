// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Windows;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// ROSBOT control buttons hosted on the Monitor tab: Update ROSBOT. 1:1 Python ui/panels/rosbot_extension_panel.py control_frame
/// (Start / Stop = the Monitor tab toggle, same ToggleFlow). The Battle.net guard switch and the accounts per region exist only on
/// the Battle.net tab.
/// </summary>
public partial class RosbotControlBlock : UserControl
{
    /// <summary>Raised after an applied ROSBOT update rewrote the path config.</summary>
    public event Action? PathsChanged;

    public RosbotControlBlock()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            D3D4TesterI18n.EnsureInitialized();
            RefreshI18n();
        };
    }

    public void RefreshI18n() => BtnUpdateRosbot.Content = D3D4TesterI18n.Provider.GetUiText(I18nKeys.RosbotUpdateRosbot);

    /// <summary>E1 kill, E2 wait, region zips, confirm / no-update detail dialogs (RosbotUpdateInfoWindow). 1:1 Python _update_rosbot (do_rosbot_update).</summary>
    private async void BtnUpdateRosbot_Click(object sender, RoutedEventArgs e)
    {
        BtnUpdateRosbot.IsEnabled = false;
        try
        {
            bool applied = await RosbotUpdateInfoWindow.RunInteractiveUpdateAsync(Window.GetWindow(this));
            if (!applied) return;
            PathsChanged?.Invoke();
            GameInterfaceData.Instance.NotifyCallbacks();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red("[ROSBOT] Update failed: " + ex.Message);
        }
        finally
        {
            BtnUpdateRosbot.IsEnabled = true;
        }
    }
}
