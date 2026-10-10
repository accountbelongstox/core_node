// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.Utils;
using DotCore.Utils.Ocr;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// Global CPU OCR model (OcrModelCatalog, shared by every dot app on this machine): pick a model, download it from the official
/// PaddlePaddle source (progress), load it (selection written, OCR engines reloaded), open the models folder. Bundled PP-OCRv5 mobile
/// is always available; PP-OCRv5 server reads small game text more reliably but is slower on CPU.
/// </summary>
public partial class OcrModelBlock : UserControl
{
    private const double BytesPerMb = 1024 * 1024;
    private bool _busy;

    public OcrModelBlock()
    {
        InitializeComponent();
        Loaded += (_, _) => RefreshI18n();
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private OcrModelInfo? Selected =>
        CmbModel.SelectedIndex >= 0 && CmbModel.SelectedIndex < OcrModelCatalog.Models.Count ? OcrModelCatalog.Models[CmbModel.SelectedIndex] : null;

    public void RefreshI18n()
    {
        LblModel.Text = T(I18nKeys.OcrModelLabel);
        BtnDownload.Content = T(I18nKeys.OcrModelDownload);
        BtnLoad.Content = T(I18nKeys.OcrModelLoad);
        BtnOpenDir.ToolTip = T(I18nKeys.OcrModelOpenDir);
        TxtHint.Text = T(I18nKeys.OcrModelHint);
        TxtDir.Text = OcrModelCatalog.ModelsDir;
        TxtDir.ToolTip = OcrModelCatalog.ModelsDir;
        int index = CmbModel.SelectedIndex;
        CmbModel.ItemsSource = OcrModelCatalog.Models.Select(m => m.Bundled ? m.Name + T(I18nKeys.OcrModelBundledSuffix) : m.Name).ToList();
        CmbModel.SelectedIndex = index >= 0 ? index : OcrModelCatalog.Models.ToList().FindIndex(m => m.Id == OcrModelCatalog.SelectedId);
        UpdateState();
    }

    private void UpdateState()
    {
        if (Selected is not { } m) return;
        bool installed = OcrModelCatalog.IsInstalled(m.Id);
        bool active = OcrModelCatalog.SelectedId == m.Id;
        TxtState.Text = active ? T(I18nKeys.OcrModelActive)
            : installed ? T(I18nKeys.OcrModelInstalled)
            : string.Format(CultureInfo.InvariantCulture, T(I18nKeys.OcrModelNotInstalled), m.ApproxBytes / BytesPerMb);
        BtnDownload.IsEnabled = !_busy && !installed;
        BtnLoad.IsEnabled = !_busy && installed && !active;
        CmbModel.IsEnabled = !_busy;
    }

    private void CmbModel_SelectionChanged(object sender, SelectionChangedEventArgs e) => UpdateState();

    private async void BtnDownload_Click(object sender, RoutedEventArgs e)
    {
        if (Selected is not { } m) return;
        _busy = true;
        PrgDownload.Value = 0;
        PrgDownload.Visibility = Visibility.Visible;
        UpdateState();
        try
        {
            await OcrModelCatalog.DownloadAsync(m.Id, new Progress<double>(p => PrgDownload.Value = p));
        }
        catch (Exception ex) when (ex is IOException or System.Net.Http.HttpRequestException or InvalidDataException or UnauthorizedAccessException or TaskCanceledException)
        {
            MessageBox.Show(Window.GetWindow(this), string.Format(CultureInfo.InvariantCulture, T(I18nKeys.OcrModelDownloadFailed), ex.Message),
                T(I18nKeys.OcrModelLabel), MessageBoxButton.OK, MessageBoxImage.Warning);
        }
        finally
        {
            _busy = false;
            PrgDownload.Visibility = Visibility.Collapsed;
            UpdateState();
        }
    }

    private void BtnLoad_Click(object sender, RoutedEventArgs e)
    {
        if (Selected is { } m) OcrModelCatalog.Select(m.Id);
        UpdateState();
    }

    private void BtnOpenDir_Click(object sender, RoutedEventArgs e)
    {
        Directory.CreateDirectory(OcrModelCatalog.ModelsDir);
        ShellOpen.OpenDir(OcrModelCatalog.ModelsDir);
    }
}
