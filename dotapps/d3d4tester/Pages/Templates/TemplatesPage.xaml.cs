// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Utils;

namespace DotApps.d3d4tester.Pages.Templates;

/// <summary>
/// Template images tab: every image under the template dir (TemplateCatalogService) with thumbnail, pixel size, status, purpose and
/// the code that uses it, filterable by text / folder / status, so later work knows every image and what is still unused.
/// </summary>
public partial class TemplatesPage : UserControl
{
    private const int ThumbnailDecodeHeight = 48;
    private IReadOnlyList<TemplateCatalogEntry> _entries = Array.Empty<TemplateCatalogEntry>();
    private bool _loading;

    public TemplatesPage()
    {
        InitializeComponent();
        Loaded += async (_, _) =>
        {
            RefreshI18n();
            if (_entries.Count == 0) await ReloadAsync();
        };
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    public void RefreshI18n()
    {
        ColPreview.Header = T(I18nKeys.TemplatesColPreview);
        ColName.Header = T(I18nKeys.TemplatesColName);
        ColSize.Header = T(I18nKeys.TemplatesColSize);
        ColStatus.Header = T(I18nKeys.TemplatesColStatus);
        ColPurpose.Header = T(I18nKeys.TemplatesColPurpose);
        ColUsedBy.Header = T(I18nKeys.TemplatesColUsedBy);
        BtnReload.Content = T(I18nKeys.TemplatesReload);
        BtnOpenDir.Content = T(I18nKeys.TemplatesOpenDir);
        DotCore.UITheme.ControlAssist.SetPlaceholder(TxtFilter, T(I18nKeys.TemplatesFilter));
        FillFilters();
        ApplyFilter();
    }

    private async Task ReloadAsync()
    {
        if (_loading) return;
        _loading = true;
        BtnReload.IsEnabled = false;
        TxtSummary.Text = T(I18nKeys.TemplatesLoading);
        try
        {
            _entries = await Task.Run(TemplateCatalogService.Load);
            FillFilters();
            ApplyFilter();
        }
        finally
        {
            _loading = false;
            BtnReload.IsEnabled = true;
        }
    }

    private void FillFilters()
    {
        string? group = CmbGroup.SelectedItem as string;
        var all = T(I18nKeys.TemplatesAll);
        CmbGroup.ItemsSource = new[] { all }.Concat(_entries.Select(e => e.Group).Distinct().OrderBy(g => g, StringComparer.OrdinalIgnoreCase)).ToList();
        CmbGroup.SelectedItem = group != null && ((IList<string>)CmbGroup.ItemsSource).Contains(group) ? group : all;
        int status = CmbStatus.SelectedIndex;
        CmbStatus.ItemsSource = new[] { all }.Concat(TemplateCatalogService.StatusKeys.Select(T)).ToList();
        CmbStatus.SelectedIndex = status > 0 ? status : 0;
    }

    private void Filter_Changed(object sender, EventArgs e) => ApplyFilter();

    private void ApplyFilter()
    {
        if (CmbGroup.ItemsSource == null) return;
        string text = TxtFilter.Text.Trim();
        string? group = CmbGroup.SelectedIndex > 0 ? CmbGroup.SelectedItem as string : null;
        string? statusKey = CmbStatus.SelectedIndex > 0 ? TemplateCatalogService.StatusKeys[CmbStatus.SelectedIndex - 1] : null;
        var rows = _entries
            .Where(e => group == null || e.Group == group)
            .Where(e => statusKey == null || e.StatusKey == statusKey)
            .Select(e => new TemplateRow(e))
            .Where(r => text.Length == 0 || r.RelativePath.Contains(text, StringComparison.OrdinalIgnoreCase)
                        || r.PurposeText.Contains(text, StringComparison.OrdinalIgnoreCase) || r.UsedBy.Contains(text, StringComparison.OrdinalIgnoreCase))
            .ToList();
        GridTemplates.ItemsSource = rows;
        var counts = TemplateCatalogService.StatusKeys.Select(k => $"{T(k)} {_entries.Count(e => e.StatusKey == k)}");
        TxtSummary.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.TemplatesSummary),
            rows.Count, _entries.Count, string.Join(" / ", counts), D3TemplatePaths.GetTemplateDir());
    }

    private void BtnReload_Click(object sender, RoutedEventArgs e) => _ = ReloadAsync();

    private void BtnOpenDir_Click(object sender, RoutedEventArgs e) => ShellOpen.OpenDir(D3TemplatePaths.GetTemplateDir());

    private void GridTemplates_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (GridTemplates.SelectedItem is TemplateRow row) ShellOpen.OpenFile(row.Entry.FullPath);
    }

    /// <summary>Grid row: localized texts and a small thumbnail decoded on first display (frozen, file not kept open).</summary>
    private sealed class TemplateRow
    {
        private BitmapImage? _thumbnail;

        public TemplateRow(TemplateCatalogEntry entry)
        {
            Entry = entry;
            StatusText = T(entry.StatusKey);
            PurposeText = entry.PurposeKey is { } k ? T(k) : "";
        }

        public TemplateCatalogEntry Entry { get; }
        public string RelativePath => Entry.RelativePath;
        public string SizeText => Entry.Width > 0 ? $"{Entry.Width}x{Entry.Height}" : "";
        public string StatusText { get; }
        public string PurposeText { get; }
        public string UsedBy => Entry.UsedBy;

        public BitmapImage? Thumbnail => _thumbnail ??= LoadThumbnail(Entry.FullPath);

        private static BitmapImage? LoadThumbnail(string path)
        {
            try
            {
                var image = new BitmapImage();
                image.BeginInit();
                image.CacheOption = BitmapCacheOption.OnLoad;
                image.DecodePixelHeight = ThumbnailDecodeHeight;
                image.UriSource = new Uri(path);
                image.EndInit();
                image.Freeze();
                return image;
            }
            catch (Exception ex) when (ex is IOException or NotSupportedException or UriFormatException or ArgumentException)
            {
                return null;
            }
        }
    }
}
