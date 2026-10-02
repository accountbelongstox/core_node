using System.Windows;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.YoloRecord;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Edit record_cfg.json (Debug, FrameFPS, OutputAsVideo, LogTimestamp, FrameWidth, FrameHeight, RecordHttpPort); save on button.
/// 1:1 Python pyapps/d3-check/ui/components/record_config_dialog.py.
/// </summary>
public partial class RecordConfigDialog : Window
{
    private readonly string _configPath;

    public RecordConfigDialog(string configPath)
    {
        _configPath = configPath;
        InitializeComponent();
        ApplyI18n();
        LoadConfig();
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private void ApplyI18n()
    {
        Title = T(I18nKeys.CoordCalYoloRecordConfigDialogTitle);
        ChkDebug.Content = T(I18nKeys.CoordCalYoloRecordConfigDialogDebug);
        LblFrameFps.Text = T(I18nKeys.CoordCalYoloRecordConfigDialogFrameFps);
        ChkOutputAsVideo.Content = T(I18nKeys.CoordCalYoloRecordConfigDialogOutputAsVideo);
        ChkLogTimestamp.Content = T(I18nKeys.CoordCalYoloRecordConfigDialogLogTimestamp);
        LblFrameWidth.Text = T(I18nKeys.CoordCalYoloRecordConfigDialogFrameWidth);
        LblFrameHeight.Text = T(I18nKeys.CoordCalYoloRecordConfigDialogFrameHeight);
        LblHttpPort.Text = T(I18nKeys.CoordCalYoloRecordConfigDialogHttpPort);
        BtnSave.Content = T(I18nKeys.CoordCalYoloRecordConfigDialogSave);
        BtnCancel.Content = T(I18nKeys.CoordCalYoloRecordConfigDialogCancel);
    }

    private void LoadConfig()
    {
        var cfg = YoloRecordConfig.Load(_configPath);
        ChkDebug.IsChecked = cfg.Debug;
        TxtFrameFps.Text = cfg.FrameFps.ToString();
        ChkOutputAsVideo.IsChecked = cfg.OutputAsVideo;
        ChkLogTimestamp.IsChecked = cfg.LogTimestamp;
        TxtFrameWidth.Text = cfg.FrameWidth.ToString();
        TxtFrameHeight.Text = cfg.FrameHeight.ToString();
        TxtHttpPort.Text = cfg.RecordHttpPort.ToString();
    }

    private YoloRecordConfig Gather() => new()
    {
        Debug = ChkDebug.IsChecked == true,
        FrameFps = IntVal(TxtFrameFps.Text, YoloRecordConfig.DefaultFrameFps),
        OutputAsVideo = ChkOutputAsVideo.IsChecked == true,
        LogTimestamp = ChkLogTimestamp.IsChecked == true,
        FrameWidth = IntVal(TxtFrameWidth.Text, YoloRecordConfig.DefaultFrameWidth),
        FrameHeight = IntVal(TxtFrameHeight.Text, YoloRecordConfig.DefaultFrameHeight),
        RecordHttpPort = IntVal(TxtHttpPort.Text, YoloRecordConfig.DefaultHttpPort),
    };

    private static int IntVal(string? text, int fallback) => int.TryParse(text?.Trim(), out var v) ? v : fallback;

    private void BtnSave_Click(object sender, RoutedEventArgs e)
    {
        var data = Gather();
        if (data.FrameFps < YoloRecordConfig.MinFrameFps || data.FrameFps > YoloRecordConfig.MaxFrameFps)
        {
            Warn(I18nKeys.CoordCalYoloRecordConfigDialogInvalidFps);
            return;
        }
        if (data.FrameWidth < 1 || data.FrameHeight < 1)
        {
            Warn(I18nKeys.CoordCalYoloRecordConfigDialogInvalidResolution);
            return;
        }
        if (data.RecordHttpPort < YoloRecordConfig.MinHttpPort || data.RecordHttpPort > YoloRecordConfig.MaxHttpPort)
        {
            Warn(I18nKeys.CoordCalYoloRecordConfigDialogInvalidPort);
            return;
        }
        var (ok, err) = data.Save(_configPath);
        if (ok)
        {
            MessageBox.Show(this, T(I18nKeys.CoordCalYoloRecordConfigDialogSaveSuccess), T(I18nKeys.CoordCalSuccessTitle), MessageBoxButton.OK, MessageBoxImage.Information);
            DialogResult = true;
            Close();
        }
        else
        {
            MessageBox.Show(this, T(I18nKeys.CoordCalYoloRecordConfigDialogSaveFailed) + " " + err, T(I18nKeys.CoordCalErrorTitle), MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e) => Close();

    private void Warn(string messageKey) =>
        MessageBox.Show(this, T(messageKey), T(I18nKeys.CoordCalWarningTitle), MessageBoxButton.OK, MessageBoxImage.Warning);
}
