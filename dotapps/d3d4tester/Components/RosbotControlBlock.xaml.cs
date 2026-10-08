// PY-REF: pyapps/d3-check/ui/panels/rosbot_extension_panel.py
// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Windows;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// ROSBOT control buttons hosted on the Monitor tab: Ensure Battle.net only, Update ROSBOT, Tampermonkey script, account password.
/// 1:1 Python ui/panels/rosbot_extension_panel.py control_frame (Start / Stop = the Monitor tab toggle, same ToggleFlow).
/// </summary>
public partial class RosbotControlBlock : UserControl
{
    private const string StyleWarningButton = "WarningButtonStyle";
    private const string StyleSecondaryButton = "SecondaryButtonStyle";
    private const string TampermonkeyScriptFileName = "d3check_oauth_login_tampermonkey.user.js";
    private const string ScriptsDirName = "scripts";
    private const int ScriptSearchParentLevels = 6;

    /// <summary>Raised after an applied ROSBOT update rewrote the path config.</summary>
    public event Action? PathsChanged;

    public RosbotControlBlock()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += (_, _) => GameInterfaceData.Instance.UnregisterCallback(OnGameStateSnapshot);
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        D3D4TesterI18n.EnsureInitialized();
        RefreshI18n();
        GameInterfaceData.Instance.UnregisterCallback(OnGameStateSnapshot);
        GameInterfaceData.Instance.RegisterCallback(OnGameStateSnapshot);
    }

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        BtnUpdateRosbot.Content = p.GetUiText(I18nKeys.RosbotUpdateRosbot);
        BtnOpenTampermonkey.Content = p.GetUiText(I18nKeys.RosbotOpenTampermonkeyScript);
        BtnSetAccountPassword.Content = p.GetUiText(I18nKeys.RosbotSetAccountPassword);
        UpdateFromState();
    }

    private void OnGameStateSnapshot(GameInterfaceStateSnapshot s)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(DispatcherPriority.Normal, () => OnGameStateSnapshot(s));
            return;
        }
        UpdateFromState();
    }

    /// <summary>Ensure Battle.net button text / style from GameInterfaceData. 1:1 Python _update_control_button.</summary>
    private void UpdateFromState()
    {
        bool on = GameInterfaceData.Instance.GetStateSnapshot().EnsureBattlenetOnlyEnabled;
        var p = D3D4TesterI18n.Provider;
        BtnEnsureBattlenet.Content = on ? p.GetUiText(I18nKeys.RosbotEnsureBattlenetOnlyOn) : p.GetUiText(I18nKeys.RosbotEnsureBattlenetOnly);
        BtnEnsureBattlenet.SetResourceReference(StyleProperty, on ? StyleWarningButton : StyleSecondaryButton);
    }

    /// <summary>"Ensure Battle.net only" toggle (the tick runs the BN segment: start, login, poll). 1:1 Python _ensure_battlenet_only.</summary>
    private void BtnEnsureBattlenet_Click(object sender, RoutedEventArgs e)
    {
        RosbotTaskProcessor.Instance.ToggleEnsureBattlenetOnly();
        UpdateFromState();
    }

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

    /// <summary>Open Tampermonkey script in Notepad. 1:1 Python _open_tampermonkey_script.</summary>
    private void BtnOpenTampermonkey_Click(object sender, RoutedEventArgs e) => OpenWithNotepadOrWarn(this, GetTampermonkeyScriptPath());

    /// <summary>Open a file in the text editor; warn with rosbot.log_file_not_found + path when missing or not openable.</summary>
    public static void OpenWithNotepadOrWarn(DependencyObject owner, string? path)
    {
        if (!string.IsNullOrWhiteSpace(path) && ShellOpen.OpenFileWithNotepad(path)) return;
        var p = D3D4TesterI18n.Provider;
        MessageBox.Show(Window.GetWindow(owner), p.GetUiText(I18nKeys.RosbotLogFileNotFound) + "\n" + (path ?? ""),
            p.GetUiText(I18nKeys.RosbotWarning), MessageBoxButton.OK, MessageBoxImage.Warning);
    }

    /// <summary>Resolve Tampermonkey script path: config PathsTampermonkeyScript, else default under repo scripts/ (1:1 Python TAMPERMONKEY_SCRIPT_PATH).</summary>
    private static string? GetTampermonkeyScriptPath()
    {
        var cfg = ConfigOptionsProvider.GetOptions<PathsOptions>().TampermonkeyScript;
        if (!string.IsNullOrWhiteSpace(cfg))
        {
            var p = Path.GetFullPath(cfg);
            if (File.Exists(p)) return p;
        }
        var baseDir = AppDomain.CurrentDomain.BaseDirectory;
        var scriptsHere = Path.Combine(baseDir, ScriptsDirName, TampermonkeyScriptFileName);
        if (File.Exists(scriptsHere)) return Path.GetFullPath(scriptsHere);
        var dir = new DirectoryInfo(baseDir);
        for (int i = 0; i < ScriptSearchParentLevels && dir?.Parent != null; i++, dir = dir.Parent)
        {
            var candidate = Path.Combine(dir.FullName, ScriptsDirName, TampermonkeyScriptFileName);
            if (File.Exists(candidate)) return Path.GetFullPath(candidate);
        }
        return Path.GetFullPath(scriptsHere);
    }

    private void BtnSetAccountPassword_Click(object sender, RoutedEventArgs e)
    {
        ColorPrinter.Gray("[DEBUG][ROSBOT UI] BtnSetAccountPassword clicked. Opening CredentialsDialog for Asia.");
        var dialog = new CredentialsDialog(BattlenetConstants.RegionAsia) { Owner = Window.GetWindow(this) };
        dialog.ShowDialog();
    }
}
