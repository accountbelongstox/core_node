// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.I18n;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Progress of one skill switch run (a new window per click, closable at any time): every reported step as a list row (time, result
/// mark, localized stage, recognition detail); the selected step shows its capture (click point circled) and the full detail. While
/// the run goes on the newest step is selected; <see cref="Finish"/> shows the outcome on top.
/// </summary>
public partial class SkillSwitchProgressWindow : Window
{
    private const string TimeFormat = "HH:mm:ss";
    private const string MarkOk = "✓";
    private const string MarkFailed = "✗";
    private const string MarkInfo = "•";

    private readonly ObservableCollection<StepRow> _rows = new();
    private bool _following = true;

    public SkillSwitchProgressWindow(string target)
    {
        InitializeComponent();
        Title = T(I18nKeys.RosbotBridgeBuildSkillSwitchProgressTitle);
        TxtStatus.Text = string.Format(CultureInfo.InvariantCulture, T(I18nKeys.RosbotBridgeBuildSkillSwitchProgressRunning), target);
        ColTime.Header = T(I18nKeys.RosbotBridgeBuildSkillSwitchProgressTime);
        ColResult.Header = "";
        ColStage.Header = T(I18nKeys.RosbotBridgeBuildSkillSwitchProgressStage);
        ColDetail.Header = T(I18nKeys.RosbotBridgeBuildSkillSwitchProgressDetail);
        BtnClose.Content = T(I18nKeys.RosbotBridgeBuildSkillSwitchProgressClose);
        LstSteps.ItemsSource = _rows;
    }

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    /// <summary>Add a step (any thread); the newest step is selected while the user has not picked an older one.</summary>
    public void Add(SkillSwitchStep step)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(() => Add(step));
            return;
        }
        var row = new StepRow(step.Time.ToString(TimeFormat, CultureInfo.InvariantCulture),
            step.Ok switch { true => MarkOk, false => MarkFailed, _ => MarkInfo },
            T(I18nKeys.RosbotBridgeBuildSkillSwitchStagePrefix + step.Stage.ToString().ToLowerInvariant()), step.Detail, ToImage(step.Png));
        _rows.Add(row);
        if (_following)
        {
            LstSteps.SelectedItem = row;
            LstSteps.ScrollIntoView(row);
        }
    }

    /// <summary>Show the outcome text on top (any thread).</summary>
    public void Finish(string outcome)
    {
        if (!Dispatcher.CheckAccess())
        {
            Dispatcher.BeginInvoke(() => Finish(outcome));
            return;
        }
        TxtStatus.Text = outcome;
    }

    private void LstSteps_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (LstSteps.SelectedItem is not StepRow row) return;
        _following = ReferenceEquals(row, _rows.LastOrDefault());
        ImgCapture.Source = row.Image ?? ImgCapture.Source;
        TxtDetail.Text = $"{row.Time}  {row.Stage}  {row.Result}{Environment.NewLine}{row.Detail}";
    }

    private static ImageSource? ToImage(byte[]? png)
    {
        if (png == null || png.Length == 0) return null;
        var image = new BitmapImage();
        image.BeginInit();
        image.CacheOption = BitmapCacheOption.OnLoad;
        image.StreamSource = new MemoryStream(png);
        image.EndInit();
        image.Freeze();
        return image;
    }

    private void BtnClose_Click(object sender, RoutedEventArgs e) => Close();

    private sealed record StepRow(string Time, string Result, string Stage, string Detail, ImageSource? Image);
}
