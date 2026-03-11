using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using Microsoft.Win32;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;

namespace GifTextOverlay;

public partial class MainWindow
{
    private string _sourceDir = "";
    private string _outputDir = "";
    private string _bgFolder = "";
    private string? _bgFile;
    private string? _rightClickedGifPath;

    private readonly ObservableCollection<TextAreaViewModel> _textAreas = [];
    private TextAreaViewModel? _selectedTextArea;
    private DispatcherTimer? _previewDebounce;
    private List<KeyValuePair<string, string>> _fontList = [];

    private static readonly string[] GiphyKeywords =
        ["cat", "dog", "funny", "meme", "ok", "laugh", "cool", "fire", "happy", "sad",
         "love", "angry", "wow", "yeah", "dance", "party", "food", "sleep", "work", "game"];

    public MainWindow()
    {
        InitializeComponent();
        if (LbGifs == null) return;

        var src = (TbSourceDir?.Text ?? "").Trim();
        var outDir = (TbOutputDir?.Text ?? "").Trim();
        _sourceDir = string.IsNullOrEmpty(src) ? Environment.CurrentDirectory : Path.GetFullPath(src);
        _outputDir = string.IsNullOrEmpty(outDir) ? _sourceDir : Path.GetFullPath(outDir);
        _bgFolder = Path.Combine(_sourceDir, "背景图");
        TbBgPath.Text = _bgFolder;

        RbGifFrame.Checked += (_, _) => { BtnBrowseBg.IsEnabled = false; TbBgPath.IsEnabled = false; _previewDebounce?.Start(); };
        RbRandomFolder.Checked += (_, _) => { BtnBrowseBg.IsEnabled = true; TbBgPath.IsEnabled = true; TbBgPath.Text = _bgFolder; _previewDebounce?.Start(); };
        RbSpecified.Checked += (_, _) => { BtnBrowseBg.IsEnabled = true; TbBgPath.IsEnabled = true; TbBgPath.Text = _bgFile ?? ""; _previewDebounce?.Start(); };
        BtnBrowseBg.IsEnabled = false;
        TbBgPath.IsEnabled = false;
        TbBgPath.TextChanged += (_, _) => _previewDebounce?.Start();

        LbTextAreas.ItemsSource = _textAreas;
        _textAreas.Add(new TextAreaViewModel());

        var presetNames = new[] { "经典", "投影", "霓虹", "漫画", "金色", "火焰", "冰霜", "贴纸", "浮雕", "赛博" };
        CbEffect.Items.Clear();
        foreach (var name in presetNames) CbEffect.Items.Add(name);
        CbEffect.Items.Add("自定义");
        CbEffect.SelectedIndex = 0;

        for (int i = 0; i < presetNames.Length; i++)
        {
            var cb = new System.Windows.Controls.CheckBox { Content = $"{i + 1}.{presetNames[i]}", Margin = new Thickness(4, 2, 12, 2), Tag = i };
            WrapEffectCheckboxes.Children.Add(cb);
        }
        CbHAlign.SelectedIndex = 1;
        CbVAlign.SelectedIndex = 1;

        _fontList = LoadFontList();
        CbFont.Items.Clear();
        CbFont.Items.Add(new ComboBoxItem { Content = "(默认)", Tag = (string?)null });
        foreach (var (path, name) in _fontList)
            CbFont.Items.Add(new ComboBoxItem { Content = name, Tag = path });
        CbFont.SelectedIndex = 0;

        foreach (var kw in GiphyKeywords)
        {
            var cb = new System.Windows.Controls.CheckBox { Content = kw, Margin = new Thickness(4, 2, 4, 2), Tag = kw };
            WrapGiphyKeywords.Children.Add(cb);
        }

        _previewDebounce = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(150) };
        _previewDebounce.Tick += (_, _) => { _previewDebounce.Stop(); UpdatePreview(); };

        CbScanRecursive.Checked += (_, _) => RefreshGifList();
        CbScanRecursive.Unchecked += (_, _) => RefreshGifList();

        Loaded += (_, _) => { RefreshGifList(); LbTextAreas.SelectedIndex = 0; };
    }

    private static List<KeyValuePair<string, string>> LoadFontList()
    {
        var list = GifProcessor.ScanFonts();
        return list.Select(p => new KeyValuePair<string, string>(p, Path.GetFileNameWithoutExtension(p))).ToList();
    }

    private void Log(string msg)
    {
        TbLog.AppendText(msg + "\n");
        TbLog.ScrollToEnd();
    }

    private void RefreshGifList()
    {
        if (LbGifs == null) return;
        var dir = TbSourceDir.Text.Trim();
        if (!Directory.Exists(dir)) { LbGifs.ItemsSource = null; return; }
        _sourceDir = Path.GetFullPath(dir);
        _bgFolder = Path.Combine(_sourceDir, "背景图");
        if (RbRandomFolder?.IsChecked == true) TbBgPath.Text = _bgFolder;
        var recursive = CbScanRecursive?.IsChecked == true;
        LbGifs.ItemsSource = GifProcessor.ScanGifs(_sourceDir, recursive);
    }

    private void TbSourceDir_TextChanged(object sender, TextChangedEventArgs e) => RefreshGifList();

    private void LbGifs_SelectionChanged(object sender, SelectionChangedEventArgs e) => _previewDebounce?.Start();

    private void LbTextAreas_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (LbTextAreas.SelectedItem is not TextAreaViewModel vm) return;
        _selectedTextArea = vm;
        BtnRemoveTextArea.IsEnabled = _textAreas.Count > 1;
        PanelTextAreaDetail.IsEnabled = true;

        TbText.Text = vm.Text;
        CbEffect.SelectedIndex = vm.PresetIndex == Presets.CustomPresetIndex ? Presets.All.Length : vm.PresetIndex;
        PanelCustomEffect.Visibility = vm.PresetIndex == Presets.CustomPresetIndex ? Visibility.Visible : Visibility.Collapsed;
        TbCustomFill.Text = vm.CustomFill;
        TbCustomShadowColor.Text = vm.CustomShadowColor ?? "black";
        TbCustomShadowDx.Text = vm.CustomShadowDx.ToString();
        TbCustomShadowDy.Text = vm.CustomShadowDy.ToString();
        TbCustomShadowRadius.Text = vm.CustomShadowRadius.ToString();
        TbCustomOutlineColor.Text = vm.CustomOutlineColor ?? "black";
        TbCustomOutlineWidth.Text = vm.CustomOutlineWidth.ToString();

        TbPosLeft.Text = vm.PosLeft.ToString("F0");
        TbPosTop.Text = vm.PosTop.ToString("F0");
        TbPosRight.Text = vm.PosRight.ToString("F0");
        TbPosBottom.Text = vm.PosBottom.ToString("F0");
        CbHAlign.SelectedIndex = Math.Clamp(vm.HAlign, 0, 2);
        CbVAlign.SelectedIndex = Math.Clamp(vm.VAlign, 0, 2);
        if (TbLetterSpacing != null) TbLetterSpacing.Text = vm.LetterSpacing.ToString("F1");
        if (TbFontStretch != null) TbFontStretch.Text = vm.FontStretch.ToString("F2");

        var fontIdx = 0;
        for (int i = 0; i < CbFont.Items.Count; i++)
        {
            if (CbFont.Items[i] is ComboBoxItem item && (item.Tag as string) == vm.FontPath)
                fontIdx = i;
        }
        CbFont.SelectedIndex = fontIdx;

        CbAutoFont.IsChecked = vm.AutoFontSize;
        TbFontSize.IsEnabled = !vm.AutoFontSize;
        TbFontSize.Text = vm.ManualFontSize.ToString();
    }

    private void AddTextArea_OnClick(object sender, RoutedEventArgs e)
    {
        _textAreas.Add(new TextAreaViewModel());
        LbTextAreas.SelectedIndex = _textAreas.Count - 1;
        _previewDebounce?.Start();
    }

    private void RemoveTextArea_OnClick(object sender, RoutedEventArgs e)
    {
        if (_selectedTextArea == null || _textAreas.Count <= 1) return;
        var idx = _textAreas.IndexOf(_selectedTextArea);
        _textAreas.RemoveAt(idx);
        LbTextAreas.SelectedIndex = Math.Min(idx, _textAreas.Count - 1);
        _previewDebounce?.Start();
    }

    private void SyncSelectedFromUi()
    {
        if (_selectedTextArea == null) return;
        _selectedTextArea.Text = TbText.Text;
        _selectedTextArea.PresetIndex = CbEffect.SelectedIndex == Presets.All.Length ? Presets.CustomPresetIndex : CbEffect.SelectedIndex;
        if (float.TryParse(TbPosLeft.Text, out var l)) _selectedTextArea.PosLeft = l;
        if (float.TryParse(TbPosTop.Text, out var t)) _selectedTextArea.PosTop = t;
        if (float.TryParse(TbPosRight.Text, out var r)) _selectedTextArea.PosRight = r;
        if (float.TryParse(TbPosBottom.Text, out var b)) _selectedTextArea.PosBottom = b;
        if (CbHAlign.SelectedItem is ComboBoxItem hi && hi.Tag is string hs && int.TryParse(hs, out var ha)) _selectedTextArea.HAlign = ha;
        if (CbVAlign.SelectedItem is ComboBoxItem vi && vi.Tag is string vs && int.TryParse(vs, out var va)) _selectedTextArea.VAlign = va;
        if (float.TryParse(TbLetterSpacing?.Text, out var ls)) _selectedTextArea.LetterSpacing = ls;
        if (float.TryParse(TbFontStretch?.Text, out var fst) && fst > 0) _selectedTextArea.FontStretch = fst;
        _selectedTextArea.FontPath = (CbFont.SelectedItem as ComboBoxItem)?.Tag as string;
        _selectedTextArea.AutoFontSize = CbAutoFont.IsChecked == true;
        if (int.TryParse(TbFontSize.Text, out var fs)) _selectedTextArea.ManualFontSize = fs;
        if (_selectedTextArea.PresetIndex == Presets.CustomPresetIndex)
        {
            _selectedTextArea.CustomFill = TbCustomFill.Text;
            _selectedTextArea.CustomShadowColor = TbCustomShadowColor.Text;
            if (int.TryParse(TbCustomShadowDx.Text, out var dx)) _selectedTextArea.CustomShadowDx = dx;
            if (int.TryParse(TbCustomShadowDy.Text, out var dy)) _selectedTextArea.CustomShadowDy = dy;
            if (int.TryParse(TbCustomShadowRadius.Text, out var rad)) _selectedTextArea.CustomShadowRadius = rad;
            _selectedTextArea.CustomOutlineColor = TbCustomOutlineColor.Text;
            if (int.TryParse(TbCustomOutlineWidth.Text, out var ow)) _selectedTextArea.CustomOutlineWidth = ow;
        }
    }

    private void TbText_TextChanged(object sender, TextChangedEventArgs e) => _previewDebounce?.Start();
    private void CbEffect_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (PanelCustomEffect == null) return;
        PanelCustomEffect.Visibility = CbEffect.SelectedIndex == Presets.All.Length ? Visibility.Visible : Visibility.Collapsed;
        _previewDebounce?.Start();
    }
    private void CustomEffect_Changed(object sender, TextChangedEventArgs e) => _previewDebounce?.Start();
    private void Position_Changed(object sender, TextChangedEventArgs e) => _previewDebounce?.Start();
    private void CbFont_SelectionChanged(object sender, SelectionChangedEventArgs e) => _previewDebounce?.Start();
    private void CbAutoFont_Changed(object sender, RoutedEventArgs e)
    {
        if (TbFontSize != null) TbFontSize.IsEnabled = CbAutoFont.IsChecked != true;
        _previewDebounce?.Start();
    }
    private void TbFontSize_TextChanged(object sender, TextChangedEventArgs e) => _previewDebounce?.Start();
    private void Alignment_Changed(object sender, SelectionChangedEventArgs e) => _previewDebounce?.Start();
    private void Typography_Changed(object sender, TextChangedEventArgs e) => _previewDebounce?.Start();

    private void UpdatePreview()
    {
        SyncSelectedFromUi();
        if (ImgPreview == null) return;
        try
        {
            var items = _textAreas.Select(x => x.ToItem()).Where(x => !string.IsNullOrWhiteSpace(x.Text)).ToList();
            if (items.Count == 0) { ImgPreview.Source = null; return; }

            SixLabors.ImageSharp.Image<Rgba32>? bg = GetPreviewBackground();
            using (bg)
            using (var frame = GifProcessor.CreateTextFrame(bg, items))
                ImgPreview.Source = ImageSharpToWpf.ToBitmapSource(frame);
        }
        catch { ImgPreview.Source = null; }
    }

    private SixLabors.ImageSharp.Image<Rgba32> GetPreviewBackground()
    {
        int w = 400, h = 300;
        var selectedPaths = LbGifs?.SelectedItems?.Cast<string>().Where(File.Exists).ToList() ?? [];
        if (selectedPaths.Count > 0)
        {
            var (frames, _) = GifProcessor.LoadGifFrames(selectedPaths[0]);
            if (frames.Count > 0)
            {
                w = frames[0].Width;
                h = frames[0].Height;
                if (RbGifFrame?.IsChecked == true)
                {
                    var bg = GifProcessor.CloneFrameToImage(frames[Random.Shared.Next(frames.Count)].Frames.RootFrame);
                    foreach (var f in frames) f.Dispose();
                    return bg;
                }
                foreach (var f in frames) f.Dispose();
            }
        }
        if (RbSpecified?.IsChecked == true && !string.IsNullOrEmpty(TbBgPath?.Text) && File.Exists(TbBgPath.Text))
        {
            var bg = GifProcessor.LoadBackgroundImage(TbBgPath.Text);
            return GifProcessor.ResizeToFit(bg, w, h);
        }
        if (RbRandomFolder?.IsChecked == true)
        {
            var folder = TbBgPath?.Text?.Trim() ?? "";
            var imgs = GifProcessor.ScanBackgroundImages(folder);
            if (imgs.Count > 0)
            {
                var pick = imgs[Random.Shared.Next(imgs.Count)];
                var bg = GifProcessor.LoadBackgroundImage(pick);
                return GifProcessor.ResizeToFit(bg, w, h);
            }
        }
        if (selectedPaths.Count > 0)
        {
            var (frames2, _) = GifProcessor.LoadGifFrames(selectedPaths[0]);
            if (frames2.Count > 0)
            {
                var bg = GifProcessor.CloneFrameToImage(frames2[Random.Shared.Next(frames2.Count)].Frames.RootFrame);
                foreach (var f in frames2) f.Dispose();
                return bg;
            }
        }
        return GifProcessor.CreatePreviewBackground(w, h);
    }

    private void GifItem_RightClick(object sender, MouseButtonEventArgs e) =>
        _rightClickedGifPath = (sender as FrameworkElement)?.DataContext as string;

    private void DeleteGif_OnClick(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_rightClickedGifPath) || !File.Exists(_rightClickedGifPath)) return;
        try { File.Delete(_rightClickedGifPath); RefreshGifList(); Log($"已删除: {Path.GetFileName(_rightClickedGifPath)}"); }
        catch (Exception ex) { System.Windows.MessageBox.Show($"删除失败: {ex.Message}", "错误"); }
    }

    private void RenameGif_OnClick(object sender, RoutedEventArgs e)
    {
        if (string.IsNullOrEmpty(_rightClickedGifPath) || !File.Exists(_rightClickedGifPath)) return;
        var dir = Path.GetDirectoryName(_rightClickedGifPath);
        var ext = Path.GetExtension(_rightClickedGifPath);
        var current = Path.GetFileNameWithoutExtension(_rightClickedGifPath);
        var input = new InputDialog { Title = "重命名", Prompt = "新文件名（不含扩展名）", DefaultValue = current };
        if (input.ShowDialog() != true || string.IsNullOrWhiteSpace(input.Value)) return;
        var newPath = Path.Combine(dir!, input.Value!.Trim() + ext);
        if (File.Exists(newPath)) { System.Windows.MessageBox.Show("目标文件已存在。", "错误"); return; }
        try { File.Move(_rightClickedGifPath, newPath); RefreshGifList(); Log($"已重命名"); }
        catch (Exception ex) { System.Windows.MessageBox.Show($"重命名失败: {ex.Message}", "错误"); }
    }

    private async void GiphyDownload_OnClick(object sender, RoutedEventArgs e)
    {
        var apiKey = TbGiphyApiKey.Text.Trim();
        if (string.IsNullOrEmpty(apiKey)) { System.Windows.MessageBox.Show("请填写 Giphy API Key。", "提示"); return; }
        _sourceDir = Path.GetFullPath(TbSourceDir.Text.Trim());
        if (!Directory.Exists(_sourceDir)) { System.Windows.MessageBox.Show("源目录不存在。", "错误"); return; }
        var keywords = WrapGiphyKeywords.Children.OfType<System.Windows.Controls.CheckBox>().Where(cb => cb.IsChecked == true && cb.Tag is string).Select(cb => (string)cb.Tag!).ToList();
        keywords.AddRange(TbGiphyCustom.Text.Trim().Split(' ', StringSplitOptions.RemoveEmptyEntries));
        if (keywords.Count == 0) { System.Windows.MessageBox.Show("请勾选或输入关键词。", "提示"); return; }

        BtnGiphyDownload.IsEnabled = false;
        try
        {
            using var client = new HttpClient();
            var ids = new HashSet<string>();
            foreach (var q in keywords.Take(5))
            {
                try
                {
                    var url = $"https://api.giphy.com/v1/gifs/search?api_key={Uri.EscapeDataString(apiKey)}&q={Uri.EscapeDataString(q)}&limit=10";
                    var json = await client.GetStringAsync(url);
                    using var doc = JsonDocument.Parse(json);
                    foreach (var item in doc.RootElement.GetProperty("data").EnumerateArray())
                        if (item.TryGetProperty("id", out var idEl)) ids.Add(idEl.GetString() ?? "");
                }
                catch (Exception ex) { Log($"搜索 {q} 失败: {ex.Message}"); }
            }
            foreach (var id in ids.Take(15))
            {
                if (string.IsNullOrEmpty(id)) continue;
                try
                {
                    var bytes = await client.GetByteArrayAsync($"https://media.giphy.com/media/{id}/giphy.gif");
                    await File.WriteAllBytesAsync(Path.Combine(_sourceDir, $"{id}.gif"), bytes);
                    Log($"下载: {id}.gif");
                }
                catch { }
            }
            RefreshGifList();
            System.Windows.MessageBox.Show("下载完成", "完成");
        }
        finally { BtnGiphyDownload.IsEnabled = true; }
    }

    private void BrowseSource_OnClick(object sender, RoutedEventArgs e)
    {
        var dlg = new System.Windows.Forms.FolderBrowserDialog { SelectedPath = _sourceDir, Description = "选择包含 GIF 的源目录" };
        if (dlg.ShowDialog() == System.Windows.Forms.DialogResult.OK) { TbSourceDir.Text = dlg.SelectedPath; RefreshGifList(); }
    }

    private void BrowseOutput_OnClick(object sender, RoutedEventArgs e)
    {
        var dlg = new System.Windows.Forms.FolderBrowserDialog { SelectedPath = _outputDir, Description = "选择输出目录" };
        if (dlg.ShowDialog() == System.Windows.Forms.DialogResult.OK) TbOutputDir.Text = dlg.SelectedPath;
    }

    private void BrowseBg_OnClick(object sender, RoutedEventArgs e)
    {
        if (RbSpecified?.IsChecked == true)
        {
            var dlg = new Microsoft.Win32.OpenFileDialog { Filter = "图片|*.jpg;*.jpeg;*.png;*.bmp;*.gif", InitialDirectory = _sourceDir };
            if (dlg.ShowDialog() == true) { _bgFile = dlg.FileName; TbBgPath.Text = _bgFile; }
        }
        else
        {
            var dlg = new System.Windows.Forms.FolderBrowserDialog { SelectedPath = _bgFolder, Description = "选择背景图文件夹" };
            if (dlg.ShowDialog() == System.Windows.Forms.DialogResult.OK) { _bgFolder = dlg.SelectedPath; TbBgPath.Text = _bgFolder; }
        }
    }

    private void Generate_OnClick(object sender, RoutedEventArgs e)
    {
        _sourceDir = Path.GetFullPath(TbSourceDir.Text.Trim());
        _outputDir = Path.GetFullPath(TbOutputDir.Text.Trim());
        if (!Directory.Exists(_sourceDir)) { System.Windows.MessageBox.Show("源目录不存在。", "错误"); return; }

        var recursive = CbScanRecursive?.IsChecked == true;
        var selected = LbGifs?.SelectedItems?.Cast<string>().Where(File.Exists).ToList() ?? [];
        var gifPaths = selected.Count > 0 ? selected : GifProcessor.ScanGifs(_sourceDir, recursive);
        if (gifPaths.Count == 0) { System.Windows.MessageBox.Show("没有 GIF 文件。", "错误"); return; }

        SyncSelectedFromUi();
        var baseItems = _textAreas.Select(x => x.ToItem()).Where(x => !string.IsNullOrWhiteSpace(x.Text)).ToList();
        if (baseItems.Count == 0) { System.Windows.MessageBox.Show("请至少添加一个有文字的区域。", "错误"); return; }

        int textFrameDelay = 200;
        if (double.TryParse(TbTextFrameSec.Text.Replace(',', '.'), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var sec) && sec > 0)
            textFrameDelay = (int)Math.Max(1, Math.Min(655.35, sec * 100));

        var effectIndices = WrapEffectCheckboxes.Children.OfType<System.Windows.Controls.CheckBox>()
            .Where(cb => cb.IsChecked == true && cb.Tag is int).Select(cb => (int)cb.Tag!).ToList();
        var presetNames = new[] { "经典", "投影", "霓虹", "漫画", "金色", "火焰", "冰霜", "贴纸", "浮雕", "赛博" };

        var ts = DateTime.Now.ToString("yyyyMMdd_HHmmss");
        var outBase = Path.Combine(_outputDir, ts);
        Directory.CreateDirectory(outBase);
        BtnGenerate.IsEnabled = false;
        TbLog.Clear();

        try
        {
            foreach (var gifPath in gifPaths)
            {
                try
                {
                    var (frames, delays) = GifProcessor.LoadGifFrames(gifPath);
                    if (frames.Count == 0) continue;

                    var w = frames[0].Width;
                    var h = frames[0].Height;
                    var stem = Path.GetFileNameWithoutExtension(gifPath);
                    var ext = Path.GetExtension(gifPath);

                    SixLabors.ImageSharp.Image<Rgba32>? bgImage = null;
                    if (RbGifFrame?.IsChecked == true)
                        bgImage = GifProcessor.CloneFrameToImage(frames[Random.Shared.Next(frames.Count)].Frames.RootFrame);
                    else if (RbSpecified?.IsChecked == true && !string.IsNullOrEmpty(TbBgPath.Text) && File.Exists(TbBgPath.Text))
                    {
                        bgImage = GifProcessor.LoadBackgroundImage(TbBgPath.Text);
                        bgImage = GifProcessor.ResizeToFit(bgImage, w, h);
                    }
                    else if (RbRandomFolder?.IsChecked == true)
                    {
                        var imgs = GifProcessor.ScanBackgroundImages(TbBgPath.Text.Trim());
                        if (imgs.Count > 0)
                        {
                            var pick = imgs[Random.Shared.Next(imgs.Count)];
                            bgImage = GifProcessor.LoadBackgroundImage(pick);
                            bgImage = GifProcessor.ResizeToFit(bgImage, w, h);
                        }
                    }
                    bgImage ??= GifProcessor.CloneFrameToImage(frames[Random.Shared.Next(frames.Count)].Frames.RootFrame);

                    var effectList = effectIndices.Count > 0 ? effectIndices : [baseItems[0].PresetIndex >= 0 && baseItems[0].PresetIndex < Presets.All.Length ? baseItems[0].PresetIndex : 0];
                    foreach (var effIdx in effectList)
                    {
                        var items = effectIndices.Count > 0
                            ? baseItems.Select(it => it with { PresetIndex = effIdx, CustomEffect = null }).ToList()
                            : baseItems;
                        using var textFrame = GifProcessor.CreateTextFrame(bgImage, items);
                        var insertIdx = Random.Shared.Next(frames.Count + 1);
                        var newFrameRefs = new List<ImageFrame<Rgba32>>();
                        var newDelays = new List<int>();
                        for (int i = 0; i <= frames.Count; i++)
                        {
                            if (i == insertIdx) { newFrameRefs.Add(textFrame.Frames.RootFrame); newDelays.Add(textFrameDelay); }
                            if (i < frames.Count) { newFrameRefs.Add(frames[i].Frames.RootFrame); newDelays.Add(delays[i]); }
                        }
                        var outName = effectIndices.Count > 0 && effIdx < presetNames.Length
                            ? $"{stem}_{presetNames[effIdx]}{ext}"
                            : $"{stem}{ext}";
                        var outPath = Path.Combine(outBase, outName);
                        GifProcessor.SaveAnimatedGif(newFrameRefs, newDelays, outPath);
                        Log($"已保存: {Path.GetFileName(outPath)}");
                    }

                    foreach (var f in frames) f.Dispose();
                    bgImage?.Dispose();
                }
                catch (Exception ex) { Log($"错误 {Path.GetFileName(gifPath)}: {ex.Message}"); }
            }
            Log($"完成。输出: {outBase}");
            System.Windows.MessageBox.Show($"生成完成\n{outBase}", "完成");
        }
        finally { BtnGenerate.IsEnabled = true; }
    }
}
