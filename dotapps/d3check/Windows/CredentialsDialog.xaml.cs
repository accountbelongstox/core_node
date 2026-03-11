using System.Windows;
using System.Windows.Controls;
using DotApps.d3check.Config;
using DotApps.d3check.Constants;
using DotApps.d3check.I18n;
using DotCore.Foundations;

namespace DotApps.d3check.Windows;

/// <summary>
/// Modal dialog: region (Asia/CN), account, password. Save to selected region on OK. 1:1 Python _show_credentials_dialog.
/// </summary>
public partial class CredentialsDialog : Window
{
    private readonly string _defaultRegion;
    private string _currentRegion;

    public CredentialsDialog(string defaultRegion = AsiaCredentialsService.RegionAsia)
    {
        InitializeComponent();
        _defaultRegion = defaultRegion;
        _currentRegion = defaultRegion;
        ColorPrinter.Gray($"[DEBUG][CredentialsDialog] Open defaultRegion={defaultRegion} configPath={ConfigPaths.ConfigUserPath}");
        var p = D3CheckI18n.Provider;
        Title = p.GetUiText(I18nKeys.CredentialsTitle, "Battle.net Account & Password");
        LblRegionType.Text = p.GetUiText(I18nKeys.CredentialsRegionType, "Type (namespace):");
        LblAccount.Text = p.GetUiText(I18nKeys.CredentialsAccount, "Account (email/phone):");
        LblPassword.Text = p.GetUiText(I18nKeys.CredentialsPassword, "Password:");

        ComboRegion.Items.Add(p.GetUiText(I18nKeys.CredentialsRegionAsia, "Asia"));
        ComboRegion.Items.Add(p.GetUiText(I18nKeys.CredentialsRegionCn, "CN"));
        ComboRegion.SelectedIndex = _defaultRegion == AsiaCredentialsService.RegionCn ? 1 : 0;
        ComboRegion.SelectionChanged += (_, _) =>
        {
            _currentRegion = ComboRegion.SelectedIndex == 1 ? AsiaCredentialsService.RegionCn : AsiaCredentialsService.RegionAsia;
            LoadRegionIntoFields(_currentRegion);
        };
        LoadRegionIntoFields(_currentRegion);
    }

    private void LoadRegionIntoFields(string region)
    {
        ColorPrinter.Gray($"[DEBUG][CredentialsDialog] LoadRegionIntoFields(region={region})");
        var (email, password) = AsiaCredentialsService.LoadCredentialsForUi(region);
        TxtEmail.Text = email ?? "";
        TxtPassword.Password = password ?? "";
    }

    private string CurrentRegion => ComboRegion.SelectedIndex == 1 ? AsiaCredentialsService.RegionCn : AsiaCredentialsService.RegionAsia;

    private void BtnOk_Click(object sender, RoutedEventArgs e)
    {
        string email = (TxtEmail.Text ?? "").Trim();
        string password = TxtPassword.Password ?? "";
        string region = CurrentRegion;
        ColorPrinter.Gray($"[CredentialsDialog] OK: region={region}, emailLen={email.Length}, passwordLen={password.Length}");
        ColorPrinter.Gray($"[DEBUG][CredentialsDialog] User clicked OK -> saving and closing");
        if (!string.IsNullOrEmpty(email) && !string.IsNullOrEmpty(password))
        {
            AsiaCredentialsService.SaveCredentials(region, email, password);
            ColorPrinter.Gray($"[DEBUG][CredentialsDialog] SaveCredentials done; config file updated.");
        }
        else
            ColorPrinter.Yellow("[CredentialsDialog] OK: skip save (empty email or password).");
        DialogResult = true;
        Close();
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e)
    {
        ColorPrinter.Gray($"[DEBUG][CredentialsDialog] User clicked Cancel -> closing without save");
        DialogResult = false;
        Close();
    }
}
