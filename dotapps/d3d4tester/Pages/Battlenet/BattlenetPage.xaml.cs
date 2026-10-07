// PY-REF: none (DOT-only)
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.StatusBar;
using DotCore.Common;
using DotCore.Foundations;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;

namespace DotApps.d3d4tester.Pages.Battlenet;

/// <summary>
/// Battle.net management tab. Every control writes the user config immediately (ConfigBinding / BattlenetAccountService):
/// guard switch and restart rules (battlenet.*), global region with an optional restart prompt (official --setregion restart),
/// accounts per region (encrypted; switching logs out the current account so the guard logs in with the new one), live state.
/// </summary>
public partial class BattlenetPage : UserControl
{
    private static readonly string[] RegionValues = { C.RegionCn, C.RegionAsia };
    private const string EmptyValue = "-";
    private const int TimeoutMinSec = 30;
    private const int TimeoutMaxSec = 3600;
    private const int NetHoldIntervalMinSec = 15;
    private const string StatusSeparator = " · ";
    private const int NetHoldHistoryRows = 50;
    private const string HistoryTimeFormat = "MM-dd HH:mm";
    private const string FinishTimeFormat = "MM-dd HH:mm";
    private const string RateSuffix = "/s";
    private string? _boundRegion;
    private bool _loaded;

    public BattlenetPage()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += (_, _) =>
        {
            GameInterfaceData.Instance.UnregisterCallback(OnStateChanged);
            BattlenetNetHoldService.StatusChanged -= OnNetHoldStatus;
        };
    }

    private string SelectedRegion => CmbRegion.SelectedIndex >= 0 && CmbRegion.SelectedIndex < RegionValues.Length
        ? RegionValues[CmbRegion.SelectedIndex]
        : C.RegionAsia;

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        if (!_loaded)
        {
            _loaded = true;
            ConfigBinding.BindCheckBox(ChkEnsureNormal, ConfigKeys.BattlenetEnsureNormal, ConfigKeys.BattlenetEnsureNormalDefault);
            ConfigBinding.BindCheckBox(ChkAbnormalRestart, ConfigKeys.BattlenetAbnormalRestartEnabled, true);
            ConfigBinding.BindIntTextBox(TxtAbnormalTimeout, ConfigKeys.BattlenetAbnormalTimeoutSec, TimeoutMinSec, TimeoutMaxSec, C.AbnormalTimeoutSecDefault);
            ConfigBinding.BindCheckBox(ChkLoginRestart, ConfigKeys.BattlenetLoginRestartEnabled, true);
            ConfigBinding.BindIntTextBox(TxtLoginTimeout, ConfigKeys.BattlenetLoginTimeoutSec, TimeoutMinSec, TimeoutMaxSec, C.LoginTimeoutSecDefault);
            ConfigBinding.BindCheckBox(ChkRegionPrompt, ConfigKeys.BattlenetRegionSwitchPrompt, true);
            string current = GameInterfaceData.Instance.GetStateSnapshot().BattlenetUiRegion
                             ?? GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion ?? C.RegionAsia;
            ConfigBinding.BindComboBox(CmbRegion, ConfigKeys.BattlenetRegion, RegionValues, current);
            _boundRegion = SelectedRegion;
            CmbRegion.SelectionChanged += OnRegionChanged;
            ConfigBinding.BindCheckBox(ChkNetHold, ConfigKeys.BattlenetNetHoldEnabled, false);
            ConfigBinding.BindCheckBox(ChkNetHoldOnBoot, ConfigKeys.BattlenetNetHoldOnBoot, false);
            ConfigBinding.BindIntTextBox(TxtNetHoldInterval, ConfigKeys.BattlenetNetHoldIntervalSec, NetHoldIntervalMinSec, TimeoutMaxSec, ConfigKeys.BattlenetNetHoldIntervalSecDefault);
            ChkNetHoldOnBoot.Checked += (_, _) => ChkNetHold.IsChecked = true;
            ConfigBinding.BindTextBox(TxtD4InstallPath, ConfigKeys.BattlenetD4InstallPath, "");
        }
        GameInterfaceData.Instance.RegisterCallback(OnStateChanged);
        BattlenetNetHoldService.StatusChanged += OnNetHoldStatus;
        RefreshI18n();
    }

    private static readonly Dictionary<NetHoldPhase, string> NetHoldPhaseKeys = new()
    {
        [NetHoldPhase.Idle] = I18nKeys.BnPanelNetHoldIdle,
        [NetHoldPhase.WaitingNetwork] = I18nKeys.BnPanelNetHoldWaitingNetwork,
        [NetHoldPhase.WaitingClient] = I18nKeys.BnPanelNetHoldWaitingClient,
        [NetHoldPhase.WaitingLogin] = I18nKeys.BnPanelNetHoldWaitingLogin,
        [NetHoldPhase.WaitingWindow] = I18nKeys.BnPanelNetHoldWaitingWindow,
        [NetHoldPhase.D4TabMissing] = I18nKeys.BnPanelNetHoldD4TabMissing,
        [NetHoldPhase.InstallStarted] = I18nKeys.BnPanelNetHoldInstallStarted,
        [NetHoldPhase.InstallPathFailed] = I18nKeys.BnPanelNetHoldInstallPathFailed,
        [NetHoldPhase.UserPaused] = I18nKeys.BnPanelNetHoldUserPaused,
        [NetHoldPhase.Downloading] = I18nKeys.BnPanelNetHoldDownloading,
        [NetHoldPhase.Resumed] = I18nKeys.BnPanelNetHoldResumed,
        [NetHoldPhase.Completed] = I18nKeys.BnPanelNetHoldCompleted,
        [NetHoldPhase.NotOwned] = I18nKeys.BnPanelNetHoldNotOwned,
        [NetHoldPhase.Unknown] = I18nKeys.BnPanelNetHoldUnknown,
    };

    /// <summary>Status line, the newest known progress (percent, amounts, speed, remaining time, finish time) and the history list.</summary>
    private void OnNetHoldStatus(NetHoldRecord r)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.InvokeAsync(() => OnNetHoldStatus(r));
            return;
        }
        var p = D3D4TesterI18n.Provider;
        var recent = NetHoldHistory.Recent();
        TxtNetHoldStatus.Text = string.IsNullOrEmpty(r.Detail)
            ? p.GetUiText(NetHoldPhaseKeys[r.Phase])
            : p.GetUiText(NetHoldPhaseKeys[r.Phase]) + StatusSeparator + r.Detail;

        var known = r.Percent != null ? r : recent.FirstOrDefault(x => x.Percent != null);
        PrgNetHold.Value = known?.Percent ?? 0;
        TxtNetHoldProgress.Text = known == null ? p.GetUiText(I18nKeys.BnPanelNetHoldNoProgress) : FormatProgress(known, p);

        LstNetHoldHistory.Items.Clear();
        foreach (var x in recent.Take(NetHoldHistoryRows))
            LstNetHoldHistory.Items.Add(FormatHistoryRow(x, p));
    }

    private static string FormatProgress(NetHoldRecord r, II18nProvider p)
    {
        var parts = new List<string> { $"{r.Percent:0.0}%" };
        if (r.DoneBytes is { } done && r.TotalBytes is { } total)
            parts.Add($"{BattlenetDownloadProgress.FormatBytes(done)} / {BattlenetDownloadProgress.FormatBytes(total)}");
        if (r.RateBytesPerSec is { } rate)
            parts.Add(string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldSpeed), BattlenetDownloadProgress.FormatBytes(rate)));
        if (r.AvgRateBytesPerSec is { } avg)
            parts.Add(string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldAvgSpeed), BattlenetDownloadProgress.FormatBytes(avg)));
        if (r.EtaSec is { } eta)
        {
            parts.Add(string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldRemaining), FormatDuration(eta, p)));
            parts.Add(string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldFinishAt), r.Time.AddSeconds(eta).ToString(FinishTimeFormat)));
        }
        else parts.Add(p.GetUiText(I18nKeys.BnPanelNetHoldEtaUnknown));
        parts.Add(string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldUpdatedAt), r.Time.ToString(HistoryTimeFormat)));
        return string.Join(StatusSeparator, parts);
    }

    private static string FormatHistoryRow(NetHoldRecord r, II18nProvider p)
    {
        var parts = new List<string> { r.Time.ToString(HistoryTimeFormat), p.GetUiText(NetHoldPhaseKeys[r.Phase]) };
        if (r.Percent is { } pct) parts.Add($"{pct:0.0}%");
        if ((r.AvgRateBytesPerSec ?? r.RateBytesPerSec) is { } rate) parts.Add(BattlenetDownloadProgress.FormatBytes(rate) + RateSuffix);
        if (r.EtaSec is { } eta) parts.Add(string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldRemaining), FormatDuration(eta, p)));
        return string.Join(StatusSeparator, parts);
    }

    private static string FormatDuration(double seconds, II18nProvider p)
    {
        var t = TimeSpan.FromSeconds(Math.Max(0, seconds));
        if (t.TotalDays >= 1) return string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldEtaDays), (int)t.TotalDays, t.Hours);
        if (t.TotalHours >= 1) return string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldEtaHours), (int)t.TotalHours, t.Minutes);
        return string.Format(p.GetUiText(I18nKeys.BnPanelNetHoldEtaMinutes), Math.Max(1, (int)Math.Ceiling(t.TotalMinutes)));
    }

    private void BtnEnsureClient_Click(object sender, RoutedEventArgs e) => _ = Task.Run(BattlenetNetHoldService.EnsureClient);

    private void BtnD4InstallPathBrowse_Click(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.OpenFolderDialog { Title = D3D4TesterI18n.Provider.GetUiText(I18nKeys.BnPanelD4InstallPath) };
        if (System.IO.Directory.Exists(TxtD4InstallPath.Text)) dialog.InitialDirectory = TxtD4InstallPath.Text;
        if (dialog.ShowDialog(Window.GetWindow(this)) != true) return;
        TxtD4InstallPath.Text = dialog.FolderName;
        ConfigBinding.SetValue(ConfigKeys.BattlenetD4InstallPath, dialog.FolderName);
    }

    private void BtnOpenD4Page_Click(object sender, RoutedEventArgs e) => _ = Task.Run(BattlenetNetHoldService.OpenD4Page);

    private void BtnPauseDownload_Click(object sender, RoutedEventArgs e) => RunControl(BattlenetNetHoldService.Pause);

    private void BtnResumeDownload_Click(object sender, RoutedEventArgs e) => RunControl(BattlenetNetHoldService.Resume);

    /// <summary>Run a Battle.net control action off the UI thread and show its result in the status line.</summary>
    private void RunControl(Func<bool> action) => _ = Task.Run(() =>
    {
        bool ok = action();
        Dispatcher.InvokeAsync(() =>
        {
            var p = D3D4TesterI18n.Provider;
            TxtNetHoldStatus.Text = p.GetUiText(ok ? I18nKeys.BnPanelNetHoldControlDone : I18nKeys.BnPanelNetHoldControlFailed)
                                    + (BattlenetNetHoldService.UserPaused ? StatusSeparator + p.GetUiText(I18nKeys.BnPanelNetHoldUserPaused) : "");
        });
    });

    private void BtnNetHoldNow_Click(object sender, RoutedEventArgs e) => BattlenetNetHoldService.RunNow();

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        TabGuard.Header = p.GetUiText(I18nKeys.BnPanelGuardTitle);
        ChkEnsureNormal.Content = p.GetUiText(I18nKeys.BnPanelEnsureNormal);
        ChkAbnormalRestart.Content = p.GetUiText(I18nKeys.BnPanelAbnormalRestart);
        ChkLoginRestart.Content = p.GetUiText(I18nKeys.BnPanelLoginRestart);
        LblAbnormalSec.Text = LblLoginSec.Text = p.GetUiText(I18nKeys.BnPanelSeconds);
        TxtGuardDesc.Text = p.GetUiText(I18nKeys.BnPanelGuardDesc);
        TabRegion.Header = p.GetUiText(I18nKeys.BnPanelRegionTitle);
        LblRegion.Text = p.GetUiText(I18nKeys.BnPanelRegion);
        ItemRegionCn.Content = p.GetUiText(I18nKeys.StatusServerCn);
        ItemRegionAsia.Content = p.GetUiText(I18nKeys.StatusServerAsia);
        ChkRegionPrompt.Content = p.GetUiText(I18nKeys.BnPanelRegionPrompt);
        LblAccounts.Text = p.GetUiText(I18nKeys.BnPanelAccounts);
        LblAccountLabel.Text = p.GetUiText(I18nKeys.BnPanelAccountLabel);
        LblAccountEmail.Text = p.GetUiText(I18nKeys.CredentialsAccount);
        LblAccountPassword.Text = p.GetUiText(I18nKeys.CredentialsPassword);
        BtnSaveAccount.Content = p.GetUiText(I18nKeys.BnPanelSaveAccount);
        BtnRemoveAccount.Content = p.GetUiText(I18nKeys.BnPanelRemoveAccount);
        BtnUseAccount.Content = p.GetUiText(I18nKeys.BnPanelUseAccount);
        TxtAccountsDesc.Text = p.GetUiText(I18nKeys.BnPanelCredentialsDesc);
        LblStateTitle.Text = p.GetUiText(I18nKeys.BnPanelStateTitle);
        LblClientState.Text = p.GetUiText(I18nKeys.BnPanelClientState);
        LblUiRegion.Text = p.GetUiText(I18nKeys.BnPanelUiRegion);
        LblStateDetail.Text = p.GetUiText(I18nKeys.BnPanelStateDetail);
        BtnProbe.Content = p.GetUiText(I18nKeys.BnPanelProbe);
        BtnRestart.Content = p.GetUiText(I18nKeys.BnPanelRestart);
        TabNetHold.Header = p.GetUiText(I18nKeys.BnPanelNetHoldTitle);
        ChkNetHold.Content = p.GetUiText(I18nKeys.BnPanelNetHoldEnabled);
        ChkNetHoldOnBoot.Content = p.GetUiText(I18nKeys.BnPanelNetHoldOnBoot);
        LblNetHoldInterval.Text = p.GetUiText(I18nKeys.BnPanelNetHoldInterval);
        LblNetHoldSec.Text = p.GetUiText(I18nKeys.BnPanelSeconds);
        LblNetHoldStatus.Text = p.GetUiText(I18nKeys.BnPanelNetHoldStatus);
        BtnEnsureClient.Content = p.GetUiText(I18nKeys.BnPanelEnsureClient);
        BtnNetHoldNow.Content = p.GetUiText(I18nKeys.BnPanelNetHoldNow);
        TxtNetHoldDesc.Text = p.GetUiText(I18nKeys.BnPanelNetHoldDesc);
        LblNetHoldHistory.Text = p.GetUiText(I18nKeys.BnPanelNetHoldHistory);
        LblD4InstallPath.Text = p.GetUiText(I18nKeys.BnPanelD4InstallPath);
        BtnD4InstallPathBrowse.Content = p.GetUiText(I18nKeys.BnPanelBrowse);
        BtnOpenD4Page.Content = p.GetUiText(I18nKeys.BnPanelOpenD4Page);
        BtnPauseDownload.Content = p.GetUiText(I18nKeys.BnPanelPauseDownload);
        BtnResumeDownload.Content = p.GetUiText(I18nKeys.BnPanelResumeDownload);
        OnNetHoldStatus(BattlenetNetHoldService.LastRecord);
        RefreshAccounts();
        OnStateChanged(GameInterfaceData.Instance.GetStateSnapshot());
    }

    /// <summary>User changed the global region: reload its accounts and, when enabled, offer the official region restart.</summary>
    private void OnRegionChanged(object sender, SelectionChangedEventArgs e)
    {
        string region = SelectedRegion;
        RefreshAccounts();
        if (region == _boundRegion) return;
        _boundRegion = region;
        if (!ConfigBinding.GetValue(ConfigKeys.BattlenetRegionSwitchPrompt, true)) return;
        var p = D3D4TesterI18n.Provider;
        string regionName = p.GetUiText(region == C.RegionCn ? I18nKeys.StatusServerCn : I18nKeys.StatusServerAsia);
        var answer = MessageBox.Show(Window.GetWindow(this), string.Format(p.GetUiText(I18nKeys.BnPanelRegionRestartAsk), regionName),
            p.GetUiText(I18nKeys.BnPanelRegionTitle), MessageBoxButton.YesNo, MessageBoxImage.Question);
        if (answer == MessageBoxResult.Yes)
            _ = Task.Run(() => BattlenetManager.Instance.RestartWithRegion(region, force: true));
    }

    private void RefreshAccounts()
    {
        var p = D3D4TesterI18n.Provider;
        string activeMark = p.GetUiText(I18nKeys.BnPanelActiveMark);
        LstAccounts.Items.Clear();
        foreach (var a in BattlenetAccountService.List(SelectedRegion))
            LstAccounts.Items.Add(new ListBoxItem { Content = a.IsActive ? $"{a.Label}  ({a.Email})  {activeMark}" : $"{a.Label}  ({a.Email})", Tag = a });
    }

    private BattlenetAccount? SelectedAccount => (LstAccounts.SelectedItem as ListBoxItem)?.Tag as BattlenetAccount;

    private void LstAccounts_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (SelectedAccount is not { } a) return;
        TxtAccountLabel.Text = a.Label;
        TxtAccountEmail.Text = a.Email;
        PwdAccountPassword.Clear();
    }

    private void BtnSaveAccount_Click(object sender, RoutedEventArgs e)
    {
        BattlenetAccountService.Upsert(SelectedRegion, TxtAccountLabel.Text, TxtAccountEmail.Text, PwdAccountPassword.Password);
        PwdAccountPassword.Clear();
        RefreshAccounts();
    }

    private void BtnRemoveAccount_Click(object sender, RoutedEventArgs e)
    {
        if (SelectedAccount is not { } a) return;
        BattlenetAccountService.Remove(SelectedRegion, a.Email);
        RefreshAccounts();
    }

    /// <summary>Switch account: make it active, then log out (same region) or restart into the region (other region); the guard logs in.</summary>
    private void BtnUseAccount_Click(object sender, RoutedEventArgs e)
    {
        if (SelectedAccount is not { } a) return;
        string region = SelectedRegion;
        if (!BattlenetAccountService.Activate(region, a.Email)) return;
        RefreshAccounts();
        _ = Task.Run(() =>
        {
            var s = GameInterfaceData.Instance.GetStateSnapshot();
            if (s.BattlenetUiRegion != null && s.BattlenetUiRegion != region)
            {
                BattlenetManager.Instance.RestartWithRegion(region);
                return;
            }
            if (!BattlenetOperationFactory.GetOperation(region).LogOut())
                ColorPrinter.Yellow("[BattlenetPage] switch account: log out not possible now; the new account is used on the next login");
        });
    }

    private void OnStateChanged(GameInterfaceStateSnapshot s)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.InvokeAsync(() => OnStateChanged(s));
            return;
        }
        var p = D3D4TesterI18n.Provider;
        TxtClientState.Text = D3StatusBarDisplayBuilder.BattlenetStateText(s.BattlenetClientState, p) ?? p.GetUiText(I18nKeys.StatusFoundUnknownState);
        TxtClientState.SetResourceReference(TextBlock.ForegroundProperty, D3StatusBarDisplayBuilder.BattlenetStateBrushKey(s.BattlenetClientState));
        TxtUiRegion.Text = s.BattlenetUiRegion switch
        {
            C.RegionCn => p.GetUiText(I18nKeys.StatusServerCn),
            C.RegionAsia => p.GetUiText(I18nKeys.StatusServerAsia),
            _ => EmptyValue,
        };
        TxtStateDetail.Text = string.IsNullOrEmpty(s.BattlenetStateDetail) ? EmptyValue : s.BattlenetStateDetail;
    }

    private void BtnProbe_Click(object sender, RoutedEventArgs e) => _ = Task.Run(() =>
    {
        if (BattlenetStatusProvider.Refresh().Changed)
            GameInterfaceData.Instance.NotifyCallbacks();
    });

    private void BtnRestart_Click(object sender, RoutedEventArgs e) => _ = Task.Run(() =>
    {
        ColorPrinter.Blue("[BattlenetPage] restart Battle.net requested");
        if (BattlenetManager.Instance.GetConfiguredRegion() is { } region) BattlenetManager.Instance.RestartWithRegion(region, force: true);
        else BattlenetManager.Instance.Restart(force: true);
    });
}
