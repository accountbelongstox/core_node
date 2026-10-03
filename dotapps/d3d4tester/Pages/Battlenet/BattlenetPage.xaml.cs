// PY-REF: none (DOT-only)
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.StatusBar;
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
    private string? _boundRegion;
    private bool _loaded;

    public BattlenetPage()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += (_, _) => GameInterfaceData.Instance.UnregisterCallback(OnStateChanged);
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
        }
        GameInterfaceData.Instance.RegisterCallback(OnStateChanged);
        RefreshI18n();
    }

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblGuardTitle.Text = p.GetUiText(I18nKeys.BnPanelGuardTitle);
        ChkEnsureNormal.Content = p.GetUiText(I18nKeys.BnPanelEnsureNormal);
        ChkAbnormalRestart.Content = p.GetUiText(I18nKeys.BnPanelAbnormalRestart);
        ChkLoginRestart.Content = p.GetUiText(I18nKeys.BnPanelLoginRestart);
        LblAbnormalSec.Text = LblLoginSec.Text = p.GetUiText(I18nKeys.BnPanelSeconds);
        TxtGuardDesc.Text = p.GetUiText(I18nKeys.BnPanelGuardDesc);
        LblRegionTitle.Text = p.GetUiText(I18nKeys.BnPanelRegionTitle);
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
