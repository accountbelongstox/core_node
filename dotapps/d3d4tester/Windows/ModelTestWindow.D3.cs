// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.Globalization;
using System.Windows;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Navigation;
using DotApps.d3d4tester.ViewModels;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.YoloDetect;
using OpenCvSharp;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// D3 client source of the model test window: captures the game window through the D3 library (D3TownNavigator.Capture), detects
/// with the loaded model, reads panel and enchant text (D3TownNavigator.Read), shows the result as JSON and keeps the last
/// MaxD3History recognitions (with the screenshot when "show screenshot" is on).
/// </summary>
public partial class ModelTestWindow
{
    private const int MaxD3History = 100;
    private const int D3ShotJpegQuality = 85;
    private const string D3HistoryTimeFormat = "HH:mm:ss";
    private const string JpegExtension = ".jpg";

    private readonly ObservableCollection<D3HistoryEntry> _d3History = new();

    /// <summary>One recognition; Shot is the JPEG screenshot (null when it was not shown).</summary>
    private sealed class D3HistoryEntry : BaseViewModel
    {
        private string _title = "";

        public required D3Recognition Recognition { get; init; }
        public required string Json { get; init; }
        public required IReadOnlyList<YoloDetection> Detections { get; init; }
        public byte[]? Shot { get; init; }

        public string Title { get => _title; set => SetProperty(ref _title, value); }
    }

    private sealed record D3Capture(Mat Image, D3Recognition Recognition, IReadOnlyList<YoloDetection> Detections, Rendered? Shown, byte[]? Shot);

    private void ApplyD3Texts()
    {
        RadioD3.Content = T(I18nKeys.ModelTestSourceD3);
        TxtD3Hint.Text = T(I18nKeys.ModelTestD3Hint);
        ChkD3ShowShot.Content = T(I18nKeys.ModelTestD3ShowShot);
        BtnD3Detect.Content = T(I18nKeys.ModelTestD3Detect);
        LblD3Json.Text = T(I18nKeys.ModelTestD3Json);
        BtnD3CopyJson.Content = T(I18nKeys.ModelTestD3CopyJson);
        LblD3History.Text = T(I18nKeys.ModelTestD3History).Replace("{max}", I(MaxD3History));
        foreach (var entry in _d3History) entry.Title = D3Title(entry.Recognition);
    }

    private void BindD3Events()
    {
        LstD3History.ItemsSource = _d3History;
        ChkD3ShowShot.IsChecked = ConfigBinding.GetValue(ConfigKeys.YoloModelTestD3ShowShot, true);
        ChkD3ShowShot.Click += (_, _) => ConfigBinding.SaveCheckbox(ConfigKeys.YoloModelTestD3ShowShot, ChkD3ShowShot.IsChecked == true);
        BtnD3Detect.Click += async (_, _) => await DetectD3Async();
        BtnD3CopyJson.Click += (_, _) =>
        {
            if (!string.IsNullOrEmpty(TxtD3Json.Text)) Clipboard.SetText(TxtD3Json.Text);
        };
        LstD3History.SelectionChanged += async (_, _) =>
        {
            if (LstD3History.SelectedItem is D3HistoryEntry entry) await ShowD3EntryAsync(entry);
        };
    }

    private static string D3Title(D3Recognition r) => T(I18nKeys.ModelTestD3HistoryItem)
        .Replace("{time}", r.Time.ToString(D3HistoryTimeFormat, CultureInfo.InvariantCulture))
        .Replace("{panel}", r.Panel ?? T(I18nKeys.ModelTestD3NoPanel))
        .Replace("{count}", I(r.Objects.Count))
        .Replace("{lines}", I(r.EnchantLines.Count));

    /// <summary>Capture the D3 client, detect, read panel / OCR, show the JSON (and the screenshot when enabled) and record it.</summary>
    private async Task DetectD3Async()
    {
        if (_session.Detector == null)
        {
            SetStatus(ChipDanger, () => T(I18nKeys.ModelTestNoModel));
            return;
        }
        await PauseAsync();
        StopLive();
        CloseVideo();
        int version = ++_stillVersion;
        _busy = true;
        UpdateEnabled();
        SetStatus(ChipInfo, () => T(I18nKeys.ModelTestStatusBusy));
        bool showShot = ChkD3ShowShot.IsChecked == true;
        var settings = CurrentSettings();
        var model = _model?.OnnxPath ?? "";
        try
        {
            var capture = await RunSessionWork(() =>
            {
                var watch = Stopwatch.StartNew();
                var image = D3TownNavigator.Capture(out var offset);
                double captureMs = watch.Elapsed.TotalMilliseconds;
                if (image == null) return null;
                var frame = _session.DetectStill(image.Clone(), settings, captureMs);
                var reading = D3TownNavigator.Read(image, frame.Detections);
                var recognition = D3Recognition.From(model, image.Width, image.Height, offset, reading, captureMs, frame.Timing.TotalMs);
                byte[]? shot = showShot ? image.ImEncode(JpegExtension, new ImageEncodingParam(ImwriteFlags.JpegQuality, D3ShotJpegQuality)) : null;
                Rendered? shown = null;
                if (showShot) shown = Render(frame);
                else frame.Dispose();
                return new D3Capture(image, recognition, frame.Detections, shown, shot);
            });
            if (capture == null)
            {
                SetStatus(ChipDanger, () => T(I18nKeys.ModelTestD3NoWindow));
                return;
            }
            if (version != _stillVersion || _closed)
            {
                capture.Image.Dispose();
                capture.Shown?.Frame.Dispose();
                return;
            }
            var entry = new D3HistoryEntry
            {
                Recognition = capture.Recognition, Json = capture.Recognition.ToJson(), Detections = capture.Detections, Shot = capture.Shot,
                Title = D3Title(capture.Recognition),
            };
            TxtD3Json.Text = entry.Json;
            _d3History.Insert(0, entry);
            while (_d3History.Count > MaxD3History) _d3History.RemoveAt(_d3History.Count - 1);
            if (capture.Shown is { } shown)
            {
                _still?.Dispose();
                _still = capture.Image;
                _stillPath = null;
                ResetStats();
                Show(shown);
            }
            else
            {
                capture.Image.Dispose();
                ClearCanvas();
            }
            SetStatus(ChipSuccess, () => T(I18nKeys.ModelTestStatusIdle));
        }
        catch (Exception ex) when (IsHandled(ex))
        {
            ShowError(ex);
        }
        finally
        {
            _busy = false;
            UpdateEnabled();
        }
    }

    /// <summary>History entry: its JSON, and its screenshot with the recorded detections when one was kept.</summary>
    private async Task ShowD3EntryAsync(D3HistoryEntry entry)
    {
        TxtD3Json.Text = entry.Json;
        if (entry.Shot is not { } shot)
        {
            SetStatus(ChipInfo, () => T(I18nKeys.ModelTestD3NoShot));
            ClearCanvas();
            return;
        }
        int version = ++_stillVersion;
        var (image, rendered) = await RunSessionWork(() =>
        {
            var mat = Cv2.ImDecode(shot, ImreadModes.Color);
            return (mat.Clone(), Render(new ModelTestFrame(mat, entry.Detections, Array.Empty<YoloTrack>(), entry.Recognition.CaptureMs, default)));
        });
        if (version != _stillVersion || _closed)
        {
            image.Dispose();
            rendered.Frame.Dispose();
            return;
        }
        _still?.Dispose();
        _still = image;
        _stillPath = null;
        Show(rendered);
    }

    private void ClearCanvas()
    {
        var old = _frame;
        _frame = null;
        old?.Dispose();
        _still?.Dispose();
        _still = null;
        Canvas.ImageSource = null;
        _boxes.Clear();
        Canvas.Refresh();
        UpdateEnabled();
    }
}
