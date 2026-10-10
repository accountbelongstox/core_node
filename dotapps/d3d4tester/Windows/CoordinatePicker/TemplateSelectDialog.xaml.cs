// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/components/coordinate_picker_window.py
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;
using OpenCvSharp;

namespace DotApps.d3d4tester.Windows.CoordinatePicker;

/// <summary>
/// Template selection for the coordinate picker: templates of the client grouped by category, drawing modes, Apply &amp; Match, Reset Image.
/// Apply with templates but no drawing mode keeps the dialog open. 1:1 Python CoordinatePicker._on_select_templates.
/// </summary>
public partial class TemplateSelectDialog : System.Windows.Window
{
    private const string LogPrefix = "[COORD_PICKER]";
    private const double CategoryTopSpacing = 8;
    private const double CategoryBottomSpacing = 4;
    private const double TemplateIndent = 16;
    private const double TemplateSpacing = 2;

    private readonly TemplateMatcherHelper _helper;
    private readonly string _clientType;
    private readonly Func<Mat?> _getOriginal;
    private readonly Action _onImageChanged;
    private readonly Dictionary<string, CheckBox> _templateChecks = new(StringComparer.Ordinal);

    public TemplateSelectDialog(TemplateMatcherHelper helper, string clientType, Func<Mat?> getOriginal, Action onImageChanged)
    {
        InitializeComponent();
        _helper = helper;
        _clientType = clientType;
        _getOriginal = getOriginal;
        _onImageChanged = onImageChanged;
        ApplyTexts();
        BuildTemplateList();
        ChkModePoint.IsChecked = helper.MatchModes[CoordinatePickType.Point];
        ChkModeRect.IsChecked = helper.MatchModes[CoordinatePickType.Rect];
        ChkModeCircle.IsChecked = helper.MatchModes[CoordinatePickType.Circle];
    }

    private void ApplyTexts()
    {
        var p = D3D4TesterI18n.Provider;
        Title = p.GetUiText(I18nKeys.CoordPickerSelectTemplates);
        LblTemplates.Text = p.GetUiText(I18nKeys.CoordPickerSelectTemplates);
        LblDrawingModes.Text = p.GetUiText(I18nKeys.CoordPickerDrawingModes);
        ChkModePoint.Content = p.GetUiText(I18nKeys.CoordPickerPickTypePoint);
        ChkModeRect.Content = p.GetUiText(I18nKeys.CoordPickerPickTypeRect);
        ChkModeCircle.Content = p.GetUiText(I18nKeys.CoordPickerPickTypeCircle);
        BtnApply.Content = p.GetUiText(I18nKeys.CoordPickerApplyMatch);
        BtnReset.Content = p.GetUiText(I18nKeys.CoordPickerResetImage);
        BtnCancel.Content = p.GetUiText(I18nKeys.ButtonCancel);
    }

    private void BuildTemplateList()
    {
        var templates = _helper.GetAvailableTemplates(_clientType);
        if (templates.Count == 0)
        {
            TemplatesPanel.Children.Add(new TextBlock
            {
                Text = D3D4TesterI18n.Provider.GetUiText(I18nKeys.CoordPickerNoTemplates),
                Style = (Style)FindResource("MutedTextStyle"),
            });
            return;
        }
        foreach (var (category, names) in templates)
        {
            TemplatesPanel.Children.Add(new TextBlock
            {
                Text = category.ToUpperInvariant(),
                Style = (Style)FindResource("CaptionTextStyle"),
                Margin = new Thickness(0, CategoryTopSpacing, 0, CategoryBottomSpacing),
            });
            foreach (var name in names)
            {
                var check = new CheckBox
                {
                    Content = name,
                    IsChecked = _helper.SelectedTemplates.Contains(name),
                    Margin = new Thickness(TemplateIndent, TemplateSpacing, 0, TemplateSpacing),
                };
                _templateChecks[name] = check;
                TemplatesPanel.Children.Add(check);
            }
        }
    }

    /// <summary>1:1 Python on_apply.</summary>
    private void BtnApply_Click(object sender, RoutedEventArgs e)
    {
        foreach (var (name, check) in _templateChecks)
            _helper.SelectTemplate(name, check.IsChecked == true);
        _helper.SetMatchModes(ChkModePoint.IsChecked == true, ChkModeRect.IsChecked == true, ChkModeCircle.IsChecked == true);
        if (_helper.SelectedTemplates.Count > 0)
        {
            if (!_helper.MatchModes.Values.Any(v => v))
            {
                ColorPrinter.Yellow($"{LogPrefix} Please select at least one drawing mode (Point, Rectangle, or Circle)");
                return;
            }
            var original = _getOriginal();
            if (original != null)
            {
                _helper.SetImage(original);
                if (_helper.MatchTemplates(_clientType))
                {
                    _helper.DrawMatchesOnImage();
                    _onImageChanged();
                    ColorPrinter.Green($"{LogPrefix} Templates matched and drawn with modes: point={_helper.MatchModes[CoordinatePickType.Point]}, rect={_helper.MatchModes[CoordinatePickType.Rect]}, circle={_helper.MatchModes[CoordinatePickType.Circle]}");
                }
                else
                {
                    ColorPrinter.Yellow($"{LogPrefix} No matches found for selected templates");
                }
            }
        }
        Close();
    }

    /// <summary>1:1 Python on_reset (dialog stays open).</summary>
    private void BtnReset_Click(object sender, RoutedEventArgs e)
    {
        _helper.ResetImage();
        _onImageChanged();
        ColorPrinter.Blue($"{LogPrefix} Image reset");
    }
}
