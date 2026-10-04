using System.Globalization;
using System.Windows;
using DotCore.VocAnnotator;
using static DotCore.VocAnnotatorUI.AnnotatorI18n;
using K = DotCore.VocAnnotatorUI.AnnotatorI18nKeys;

namespace DotCore.VocAnnotatorUI;

/// <summary>Edits AnnotatorSettings; Result is the normalized copy when the user confirms.</summary>
public partial class AnnotatorSettingsWindow : Window
{
    private readonly AnnotatorSettings _initial;

    public AnnotatorSettingsWindow(AnnotatorSettings settings)
    {
        _initial = settings.Clone();
        InitializeComponent();
        ApplyTexts();
        Load(_initial);
    }

    public AnnotatorSettings? Result { get; private set; }

    private void ApplyTexts()
    {
        Title = T(K.SettingsTitle);
        LblEditing.Text = T(K.SectionEditing);
        LblDisplay.Text = T(K.SectionDisplay);
        LblFiles.Text = T(K.SectionFiles);
        LblAi.Text = T(K.SectionAi);
        ChkAutoSave.Content = T(K.SettingAutoSave);
        ChkCopyPrevious.Content = T(K.SettingCopyPrevious);
        LblMinBox.Text = T(K.SettingMinBoxSize);
        ChkShowLabels.Content = T(K.SettingShowLabels);
        ChkCrosshair.Content = T(K.SettingShowCrosshair);
        ChkFitOnOpen.Content = T(K.SettingFitOnOpen);
        LblOpacity.Text = T(K.SettingFillOpacity);
        LblLineWidth.Text = T(K.SettingLineWidth);
        LblSort.Text = T(K.SettingImageSort);
        CboSort.ItemsSource = new[] { T(K.SortName), T(K.SortModified) };
        ChkWriteVoc.Content = T(K.SettingWriteVoc);
        ChkWriteYolo.Content = T(K.SettingWriteYolo);
        LblModel.Text = T(K.SettingModelPath);
        TxtModelHint.Text = T(K.SettingModelHint);
        BtnBrowse.Content = T(K.SettingBrowse);
        LblConfidence.Text = T(K.SettingConfidence);
        LblIou.Text = T(K.SettingIou);
        LblMode.Text = T(K.SettingMode);
        CboMode.ItemsSource = new[] { T(K.ModeMerge), T(K.ModeReplace), T(K.ModeEmptyOnly) };
        ChkAddClasses.Content = T(K.SettingAddClasses);
        ChkAutoLabelOnOpen.Content = T(K.SettingAutoLabelOnOpen);
        BtnOk.Content = T(K.Ok);
        BtnCancel.Content = T(K.Cancel);
    }

    private void Load(AnnotatorSettings s)
    {
        ChkAutoSave.IsChecked = s.AutoSave;
        ChkCopyPrevious.IsChecked = s.CopyPreviousWhenEmpty;
        TxtMinBox.Text = s.MinBoxSize.ToString(CultureInfo.InvariantCulture);
        ChkShowLabels.IsChecked = s.ShowLabels;
        ChkCrosshair.IsChecked = s.ShowCrosshair;
        ChkFitOnOpen.IsChecked = s.FitOnOpen;
        TxtOpacity.Text = s.FillOpacity.ToString(CultureInfo.InvariantCulture);
        TxtLineWidth.Text = s.LineWidth.ToString(CultureInfo.InvariantCulture);
        CboSort.SelectedIndex = Math.Max(0, AnnotatorSettings.SortModes.ToList().IndexOf(s.ImageSort));
        ChkWriteVoc.IsChecked = s.WriteVocXml;
        ChkWriteYolo.IsChecked = s.WriteYoloTxt;
        TxtModel.Text = s.AutoLabelModelPath;
        TxtConfidence.Text = s.AutoLabelConfidence.ToString(CultureInfo.InvariantCulture);
        TxtIou.Text = s.AutoLabelIou.ToString(CultureInfo.InvariantCulture);
        CboMode.SelectedIndex = Math.Max(0, AnnotatorSettings.AutoLabelModes.ToList().IndexOf(s.AutoLabelMode));
        ChkAddClasses.IsChecked = s.AutoLabelAddClasses;
        ChkAutoLabelOnOpen.IsChecked = s.AutoLabelOnOpen;
    }

    private void BtnBrowse_Click(object sender, RoutedEventArgs e)
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = T(K.OnnxFilter) + "|*.onnx" };
        if (dlg.ShowDialog(this) == true) TxtModel.Text = dlg.FileName;
    }

    private void BtnOk_Click(object sender, RoutedEventArgs e)
    {
        var s = _initial.Clone();
        s.AutoSave = ChkAutoSave.IsChecked == true;
        s.CopyPreviousWhenEmpty = ChkCopyPrevious.IsChecked == true;
        s.MinBoxSize = (int)Num(TxtMinBox.Text, _initial.MinBoxSize);
        s.ShowLabels = ChkShowLabels.IsChecked == true;
        s.ShowCrosshair = ChkCrosshair.IsChecked == true;
        s.FitOnOpen = ChkFitOnOpen.IsChecked == true;
        s.FillOpacity = Num(TxtOpacity.Text, _initial.FillOpacity);
        s.LineWidth = Num(TxtLineWidth.Text, _initial.LineWidth);
        s.ImageSort = AnnotatorSettings.SortModes[Math.Max(0, CboSort.SelectedIndex)];
        s.WriteVocXml = ChkWriteVoc.IsChecked == true;
        s.WriteYoloTxt = ChkWriteYolo.IsChecked == true;
        s.AutoLabelModelPath = TxtModel.Text.Trim();
        s.AutoLabelConfidence = Num(TxtConfidence.Text, _initial.AutoLabelConfidence);
        s.AutoLabelIou = Num(TxtIou.Text, _initial.AutoLabelIou);
        s.AutoLabelMode = AnnotatorSettings.AutoLabelModes[Math.Max(0, CboMode.SelectedIndex)];
        s.AutoLabelAddClasses = ChkAddClasses.IsChecked == true;
        s.AutoLabelOnOpen = ChkAutoLabelOnOpen.IsChecked == true;
        Result = s.Normalized();
        DialogResult = true;
    }

    private static double Num(string? text, double fallback) =>
        double.TryParse((text ?? "").Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var v) ? v : fallback;
}
