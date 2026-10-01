using System.IO;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// ROSBOT update dialog: confirm when a newer zip was found, or detection details (current path/version, Downloads dir,
/// per-region candidates, top 5) plus usage instructions when there is no update. All text i18n.
/// RunInteractiveUpdateAsync is the "Update ROSBOT" button entry (flow off the UI thread, dialogs on it).
/// 1:1 Python ui/components/rosbot_update_info_panel.py (show_update_available / show_no_update_info).
/// </summary>
public partial class RosbotUpdateInfoWindow : Window
{
    private const string GlyphUpdate = "";
    private const string GlyphInfo = "";
    private const string MutedTextStyleKey = "MutedTextStyle";
    private const string BodyTextStyleKey = "BodyTextStyle";
    private const double CandidateIndent = 12;
    private const double LineSpacing = 2;

    private bool _confirmMode;

    private RosbotUpdateInfoWindow()
    {
        InitializeComponent();
    }

    /// <summary>Run the update flow with dialogs owned by <paramref name="owner"/>. Returns true when an update was applied.</summary>
    public static Task<bool> RunInteractiveUpdateAsync(Window? owner)
    {
        var dispatcher = (owner ?? Application.Current.MainWindow)?.Dispatcher ?? Application.Current.Dispatcher;
        return Task.Run(() => RosbotUpdateManager.Instance.RunUpdateFlowAsync(
            silent: false,
            confirm: offer => dispatcher.Invoke(() => ShowUpdateAvailable(owner, offer)),
            showNoUpdate: detection => dispatcher.Invoke(() => ShowNoUpdateInfo(owner, detection))));
    }

    /// <summary>Confirm dialog. True = confirm update. 1:1 Python show_update_available.</summary>
    public static bool ShowUpdateAvailable(Window? owner, RosbotUpdateOffer offer)
    {
        var p = D3D4TesterI18n.Provider;
        var w = new RosbotUpdateInfoWindow { _confirmMode = true };
        w.SetOwner(owner);
        w.Title = p.GetUiText(I18nKeys.RosbotUpdateDialogTitle);
        w.TxtHeading.Text = p.GetUiText(I18nKeys.RosbotUpdateAvailableTitle);
        w.IconGlyph.Text = GlyphUpdate;
        w.TxtUpdateMessage.Text = p.GetUiText(I18nKeys.RosbotUpdateAvailableMessage)
            .Replace("{region}", offer.RegionDisplay)
            .Replace("{version}", string.IsNullOrEmpty(offer.VersionStr) ? "?" : offer.VersionStr)
            .Replace("{path}", offer.ZipPath);
        w.UpdateCard.Visibility = Visibility.Visible;
        w.BtnConfirm.Content = p.GetUiText(I18nKeys.RosbotUpdateConfirm);
        w.BtnCancel.Content = p.GetUiText(I18nKeys.RosbotUpdateCancel);
        return w.ShowDialog() == true;
    }

    /// <summary>No-update detection + usage dialog. 1:1 Python show_no_update_info.</summary>
    public static void ShowNoUpdateInfo(Window? owner, RosbotNoUpdateDetection? detection)
    {
        var p = D3D4TesterI18n.Provider;
        var w = new RosbotUpdateInfoWindow();
        w.SetOwner(owner);
        w.Title = p.GetUiText(I18nKeys.RosbotUpdateInfoTitle);
        w.TxtHeading.Text = p.GetUiText(I18nKeys.RosbotNoUpdateTitle);
        w.IconGlyph.Text = GlyphInfo;
        w.NoUpdatePanel.Visibility = Visibility.Visible;
        w.TxtUsageTitle.Text = p.GetUiText(I18nKeys.RosbotUpdateUsageTitle);
        w.TxtUsage.Text = p.GetUiText(I18nKeys.RosbotUpdateUsageInstructions);
        if (detection != null)
            w.FillDetection(detection);
        else
            w.DetectionCard.Visibility = Visibility.Collapsed;
        w.BtnConfirm.Visibility = Visibility.Collapsed;
        w.BtnCancel.Content = p.GetUiText(I18nKeys.RosbotUpdateClose);
        w.BtnCancel.IsDefault = true;
        w.ShowDialog();
    }

    private void FillDetection(RosbotNoUpdateDetection d)
    {
        var p = D3D4TesterI18n.Provider;
        TxtDetectionTitle.Text = p.GetUiText(I18nKeys.RosbotNoUpdateDetectionTitle);
        AddLine(p.GetUiText(I18nKeys.RosbotNoUpdateCurrentPath).Replace("{path}", string.IsNullOrEmpty(d.CurrentRosDir) ? "-" : d.CurrentRosDir), false, 0);
        AddLine(p.GetUiText(I18nKeys.RosbotNoUpdateCurrentVersion).Replace("{version}", d.CurrentVersion), false, 0);
        AddLine(p.GetUiText(I18nKeys.RosbotNoUpdateDownloadsDir).Replace("{path}", string.IsNullOrEmpty(d.DownloadsDir) ? "-" : d.DownloadsDir), false, 0);
        foreach (var region in d.Regions)
        {
            string display = string.IsNullOrEmpty(region.RegionDisplay) ? region.Region : region.RegionDisplay;
            if (region.Candidates.Count == 0)
            {
                AddLine(p.GetUiText(I18nKeys.RosbotNoUpdateRegionNoZips).Replace("{region}", display), true, 0);
                continue;
            }
            AddLine(p.GetUiText(I18nKeys.RosbotNoUpdateRegionZipsNotNewer)
                .Replace("{region}", display)
                .Replace("{current}", d.CurrentVersion)
                .Replace("{count}", region.Candidates.Count.ToString()), false, 0);
            foreach (var c in region.Candidates.Take(ShellConstants.RosbotUpdateZipPreviewCount))
            {
                AddLine(p.GetUiText(I18nKeys.RosbotNoUpdateZipItem)
                    .Replace("{name}", Path.GetFileName(c.Path))
                    .Replace("{version}", c.VersionStr)
                    .Replace("{size_mb}", c.SizeMb.ToString("0.0")).Trim(), true, CandidateIndent);
            }
            if (region.Candidates.Count > ShellConstants.RosbotUpdateZipPreviewCount)
                AddLine(p.GetUiText(I18nKeys.RosbotNoUpdateZipMore)
                    .Replace("{count}", (region.Candidates.Count - ShellConstants.RosbotUpdateZipPreviewCount).ToString()).Trim(), true, CandidateIndent);
        }
    }

    private void AddLine(string text, bool muted, double indent)
    {
        var tb = new TextBlock { Text = text, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(indent, LineSpacing, 0, LineSpacing) };
        if (TryFindResource(muted ? MutedTextStyleKey : BodyTextStyleKey) is Style style)
            tb.Style = style;
        DetectionLines.Children.Add(tb);
    }

    private void SetOwner(Window? owner)
    {
        if (owner != null && owner.IsVisible)
            Owner = owner;
        else
            WindowStartupLocation = WindowStartupLocation.CenterScreen;
    }

    private void BtnConfirm_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e)
    {
        if (_confirmMode)
            ColorPrinter.Gray("[DEBUG][RosbotUpdateInfo] Update cancelled in dialog");
        DialogResult = false;
    }
}
