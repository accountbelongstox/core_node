using System.Windows;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;
using DotCore.UITheme;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Modal dialog: region (Asia/CN), account, password; OK saves to the selected region (both values trimmed, both required).
/// 1:1 Python share/asia_credentials._show_credentials_dialog.
/// </summary>
public partial class CredentialsDialog : Window
{
    private const int RegionIndexAsia = 0;
    private const int RegionIndexCn = 1;

    public CredentialsDialog(string defaultRegion = AsiaCredentialsService.RegionAsia)
    {
        InitializeComponent();
        ColorPrinter.Gray($"[DEBUG][CredentialsDialog] Open defaultRegion={defaultRegion} configPath={ConfigPaths.ConfigUserPath}");
        var p = D3D4TesterI18n.Provider;
        Title = p.GetUiText(I18nKeys.CredentialsTitle, "Battle.net Account & Password");
        TxtHeader.Text = Title;
        TxtHint.Text = p.GetUiText(I18nKeys.CredentialsHint, "Saved per region; the password is encrypted for this machine.");
        LblRegionType.Text = p.GetUiText(I18nKeys.CredentialsRegionType, "Type (namespace):");
        LblAccount.Text = p.GetUiText(I18nKeys.CredentialsAccount, "Account (email/phone):");
        LblPassword.Text = p.GetUiText(I18nKeys.CredentialsPassword, "Password:");
        ControlAssist.SetPlaceholder(TxtEmail, p.GetUiText(I18nKeys.CredentialsAccountPlaceholder, "name@example.com"));
        BtnOk.Content = p.GetUiText(I18nKeys.ButtonOk, "OK");
        BtnCancel.Content = p.GetUiText(I18nKeys.ButtonCancel, "Cancel");

        ComboRegion.Items.Add(p.GetUiText(I18nKeys.CredentialsRegionAsia, "Asia"));
        ComboRegion.Items.Add(p.GetUiText(I18nKeys.CredentialsRegionCn, "CN"));
        ComboRegion.SelectedIndex = defaultRegion == AsiaCredentialsService.RegionCn ? RegionIndexCn : RegionIndexAsia;
        ComboRegion.SelectionChanged += (_, _) => LoadRegionIntoFields(CurrentRegion);
        LoadRegionIntoFields(CurrentRegion);
    }

    private string CurrentRegion => ComboRegion.SelectedIndex == RegionIndexCn ? AsiaCredentialsService.RegionCn : AsiaCredentialsService.RegionAsia;

    private void LoadRegionIntoFields(string region)
    {
        ColorPrinter.Gray($"[DEBUG][CredentialsDialog] LoadRegionIntoFields(region={region})");
        var (email, password) = AsiaCredentialsService.LoadCredentialsForUi(region);
        TxtEmail.Text = email ?? "";
        TxtPassword.Password = password ?? "";
    }

    private void BtnOk_Click(object sender, RoutedEventArgs e)
    {
        string email = (TxtEmail.Text ?? "").Trim();
        string password = (TxtPassword.Password ?? "").Trim();
        string region = CurrentRegion;
        ColorPrinter.Gray($"[CredentialsDialog] OK: region={region}, emailLen={email.Length}, passwordLen={password.Length}");
        if (email.Length > 0 && password.Length > 0)
            AsiaCredentialsService.SaveCredentials(region, email, password);
        else
            ColorPrinter.Yellow("[CredentialsDialog] OK: skip save (empty email or password).");
        DialogResult = true;
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e)
    {
        ColorPrinter.Gray("[DEBUG][CredentialsDialog] User clicked Cancel -> closing without save");
        DialogResult = false;
    }
}
