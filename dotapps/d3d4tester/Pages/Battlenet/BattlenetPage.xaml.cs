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
using DotApps.d3d4tester.Windows;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Pages.Battlenet;

/// <summary>
/// Battle.net management tab: guard switch (battlenet.ensure_normal, default on), global region (battlenet.region), per-region
/// login credentials (reuses CredentialsDialog / AsiaCredentialsService, encrypted), live client state from GameInterfaceData.
/// </summary>
public partial class BattlenetPage : UserControl
{
    private static readonly string[] RegionValues = { AppConstants.RegionCn, AppConstants.RegionAsia };
    private const string EmptyValue = "-";

    public BattlenetPage()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Unloaded += OnUnloaded;
    }

    private string SelectedRegion => CmbRegion.SelectedIndex >= 0 && CmbRegion.SelectedIndex < RegionValues.Length
        ? RegionValues[CmbRegion.SelectedIndex]
        : AppConstants.RegionAsia;

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        ConfigBinding.BindCheckBox(ChkEnsureNormal, ConfigKeys.BattlenetEnsureNormal, ConfigKeys.BattlenetEnsureNormalDefault);
        string currentRegion = GameInterfaceData.Instance.GetStateSnapshot().BattlenetRegion ?? AppConstants.RegionAsia;
        ConfigBinding.BindComboBox(CmbRegion, ConfigKeys.BattlenetRegion, RegionValues, currentRegion);
        CmbRegion.SelectionChanged += (_, _) => RefreshCredentialsState();
        GameInterfaceData.Instance.RegisterCallback(OnStateChanged);
        RefreshI18n();
        OnStateChanged(GameInterfaceData.Instance.GetStateSnapshot());
    }

    private void OnUnloaded(object sender, RoutedEventArgs e) => GameInterfaceData.Instance.UnregisterCallback(OnStateChanged);

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblGuardTitle.Text = p.GetUiText(I18nKeys.BnPanelGuardTitle);
        ChkEnsureNormal.Content = p.GetUiText(I18nKeys.BnPanelEnsureNormal);
        TxtGuardDesc.Text = p.GetUiText(I18nKeys.BnPanelGuardDesc);
        LblRegionTitle.Text = p.GetUiText(I18nKeys.BnPanelRegionTitle);
        LblRegion.Text = p.GetUiText(I18nKeys.BnPanelRegion);
        ItemRegionCn.Content = p.GetUiText(I18nKeys.StatusServerCn);
        ItemRegionAsia.Content = p.GetUiText(I18nKeys.StatusServerAsia);
        LblCredentials.Text = p.GetUiText(I18nKeys.BnPanelCredentials);
        BtnEditCredentials.Content = p.GetUiText(I18nKeys.BnPanelEditCredentials);
        TxtCredentialsDesc.Text = p.GetUiText(I18nKeys.BnPanelCredentialsDesc);
        LblStateTitle.Text = p.GetUiText(I18nKeys.BnPanelStateTitle);
        LblClientState.Text = p.GetUiText(I18nKeys.BnPanelClientState);
        LblUiRegion.Text = p.GetUiText(I18nKeys.BnPanelUiRegion);
        LblStateDetail.Text = p.GetUiText(I18nKeys.BnPanelStateDetail);
        BtnProbe.Content = p.GetUiText(I18nKeys.BnPanelProbe);
        BtnRestart.Content = p.GetUiText(I18nKeys.BnPanelRestart);
        RefreshCredentialsState();
        OnStateChanged(GameInterfaceData.Instance.GetStateSnapshot());
    }

    private void RefreshCredentialsState()
    {
        bool saved = AsiaCredentialsService.GetCredentials(SelectedRegion) != null;
        TxtCredentialsState.Text = D3D4TesterI18n.Provider.GetUiText(saved ? I18nKeys.BnPanelCredentialsSaved : I18nKeys.BnPanelCredentialsMissing);
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
            AppConstants.RegionCn => p.GetUiText(I18nKeys.StatusServerCn),
            AppConstants.RegionAsia => p.GetUiText(I18nKeys.StatusServerAsia),
            _ => EmptyValue,
        };
        TxtStateDetail.Text = string.IsNullOrEmpty(s.BattlenetStateDetail) ? EmptyValue : s.BattlenetStateDetail;
    }

    private void BtnEditCredentials_Click(object sender, RoutedEventArgs e)
    {
        new CredentialsDialog(SelectedRegion) { Owner = Window.GetWindow(this) }.ShowDialog();
        RefreshCredentialsState();
    }

    private void BtnProbe_Click(object sender, RoutedEventArgs e) => _ = Task.Run(() =>
    {
        if (BattlenetStatusProvider.Refresh().Changed)
            GameInterfaceData.Instance.NotifyCallbacks();
    });

    private void BtnRestart_Click(object sender, RoutedEventArgs e) => _ = Task.Run(() =>
    {
        ColorPrinter.Blue("[BattlenetPage] restart Battle.net requested");
        BattlenetManager.Instance.Restart();
    });
}
