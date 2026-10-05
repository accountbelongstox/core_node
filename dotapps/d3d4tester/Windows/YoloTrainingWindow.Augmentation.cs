// PY-REF: none (DOT-only)
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Services;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.Windows;

/// <summary>Ultralytics augmentation hyper-parameters (specific mode: derived from the task set by default) and extra-argument checks.</summary>
public partial class YoloTrainingWindow
{
    private sealed record AugField(TextBox Box, TextBlock Label, string LabelKey, Func<YoloAugmentation, double?> Get,
        Func<YoloAugmentation, double?, YoloAugmentation> Set);

    private IReadOnlyList<AugField>? _augFields;

    private IReadOnlyList<AugField> AugFields => _augFields ??= new AugField[]
    {
        new(TxtAugFliplr, LblAugFliplr, I18nKeys.YoloTrainingAugFliplr, a => a.Fliplr, (a, v) => a with { Fliplr = v }),
        new(TxtAugFlipud, LblAugFlipud, I18nKeys.YoloTrainingAugFlipud, a => a.Flipud, (a, v) => a with { Flipud = v }),
        new(TxtAugScale, LblAugScale, I18nKeys.YoloTrainingAugScale, a => a.Scale, (a, v) => a with { Scale = v }),
        new(TxtAugTranslate, LblAugTranslate, I18nKeys.YoloTrainingAugTranslate, a => a.Translate, (a, v) => a with { Translate = v }),
        new(TxtAugDegrees, LblAugDegrees, I18nKeys.YoloTrainingAugDegrees, a => a.Degrees, (a, v) => a with { Degrees = v }),
        new(TxtAugMosaic, LblAugMosaic, I18nKeys.YoloTrainingAugMosaic, a => a.Mosaic, (a, v) => a with { Mosaic = v }),
        new(TxtAugHsvH, LblAugHsvH, I18nKeys.YoloTrainingAugHsvH, a => a.HsvH, (a, v) => a with { HsvH = v }),
        new(TxtAugHsvS, LblAugHsvS, I18nKeys.YoloTrainingAugHsvS, a => a.HsvS, (a, v) => a with { HsvS = v }),
        new(TxtAugHsvV, LblAugHsvV, I18nKeys.YoloTrainingAugHsvV, a => a.HsvV, (a, v) => a with { HsvV = v }),
        new(TxtAugErasing, LblAugErasing, I18nKeys.YoloTrainingAugErasing, a => a.Erasing, (a, v) => a with { Erasing = v }),
        new(TxtAugShear, LblAugShear, I18nKeys.YoloTrainingAugShear, a => a.Shear, (a, v) => a with { Shear = v }),
        new(TxtAugPerspective, LblAugPerspective, I18nKeys.YoloTrainingAugPerspective, a => a.Perspective, (a, v) => a with { Perspective = v }),
        new(TxtAugMixup, LblAugMixup, I18nKeys.YoloTrainingAugMixup, a => a.Mixup, (a, v) => a with { Mixup = v }),
    };

    /// <summary>Specific mode with "derived from task set" checked: the window shows (read-only) and trains with the derived values.</summary>
    private bool UseDerivedAugmentation => IsSpecific && ChkAugFromTaskSet.IsChecked == true;

    private void BindAugmentation()
    {
        ConfigBinding.BindCheckBox(ChkAugFromTaskSet, ConfigKeys.YoloTrainingAugmentationFromTaskSet, true);
        ChkAugFromTaskSet.Checked += (_, _) => RenderAugmentation();
        ChkAugFromTaskSet.Unchecked += (_, _) =>
        {
            if (IsSpecific && LoadCustomAugmentation().IsDefault && SelectedTaskSet() is { } set)
                SaveCustomAugmentation(YoloTrainingService.AugmentationForTaskSet(set));
            RenderAugmentation();
        };
        foreach (var field in AugFields)
            field.Box.LostFocus += (_, _) =>
            {
                if (UseDerivedAugmentation) return;
                SaveCustomAugmentation(AugmentationFromBoxes());
                RenderAugmentation();
            };
        RenderAugmentation();
    }

    private void ApplyAugmentationTexts()
    {
        LblAugmentation.Text = T(I18nKeys.YoloTrainingSectionAugmentation);
        ChkAugFromTaskSet.Content = T(I18nKeys.YoloTrainingAugFromTaskSet);
        BtnAugReset.Content = T(I18nKeys.YoloTrainingAugReset);
        foreach (var field in AugFields) field.Label.Text = T(field.LabelKey);
    }

    private void RenderAugmentation()
    {
        bool derived = UseDerivedAugmentation;
        ChkAugFromTaskSet.Visibility = IsSpecific ? Visibility.Visible : Visibility.Collapsed;
        BtnAugReset.IsEnabled = !derived;
        YoloAugmentation shown;
        if (derived)
        {
            shown = SelectedTaskSet() is { } set ? YoloTrainingService.AugmentationForTaskSet(set) : YoloAugmentation.UltralyticsDefaults;
            TxtAugDerived.Text = T(I18nKeys.YoloTrainingAugDerivedHint);
        }
        else
        {
            shown = LoadCustomAugmentation();
            TxtAugDerived.Text = T(I18nKeys.YoloTrainingAugCustomHint);
        }
        foreach (var field in AugFields)
        {
            field.Box.Text = field.Get(shown) is { } v ? v.ToString(CultureInfo.InvariantCulture) : "";
            field.Box.IsEnabled = !derived;
        }
    }

    /// <summary>Values the user entered (empty field = Ultralytics default).</summary>
    private YoloAugmentation CustomAugmentation() => UseDerivedAugmentation ? LoadCustomAugmentation() : AugmentationFromBoxes();

    private YoloAugmentation AugmentationFromBoxes() =>
        AugFields.Aggregate(YoloAugmentation.UltralyticsDefaults, (a, f) => f.Set(a, ParseAugValue(f.Box.Text)));

    private static double? ParseAugValue(string? text) =>
        double.TryParse(text?.Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var v) && double.IsFinite(v) && v >= 0 ? v : null;

    private static YoloAugmentation LoadCustomAugmentation() =>
        YoloAugmentation.Parse(ConfigBinding.GetValue(ConfigKeys.YoloTrainingAugmentation, ""));

    private static void SaveCustomAugmentation(YoloAugmentation augmentation) =>
        ConfigBinding.SaveString(ConfigKeys.YoloTrainingAugmentation, augmentation.ToTokens());

    /// <summary>Clears the custom values (Ultralytics defaults).</summary>
    private void ResetAugmentation()
    {
        SaveCustomAugmentation(YoloAugmentation.UltralyticsDefaults);
        RenderAugmentation();
    }

    /// <summary>Extra arguments that will be ignored: managed keys (set by fields) and malformed tokens.</summary>
    private void RenderExtraArgsIssue()
    {
        var rejected = new YoloTrainParameters { ExtraArguments = TxtExtraArgs.Text ?? "" }.ParseExtraArguments().Rejected;
        var managed = rejected.Where(t => t.IndexOf('=') is var eq && eq > 0 && YoloTrainParameters.ManagedKeys.Contains(t[..eq])).ToList();
        var invalid = rejected.Except(managed).ToList();
        var lines = new List<string>();
        if (managed.Count > 0) lines.Add(T(I18nKeys.YoloTrainingExtraArgsManaged).Replace("{args}", string.Join(" ", managed)));
        if (invalid.Count > 0) lines.Add(T(I18nKeys.YoloTrainingExtraArgsInvalid).Replace("{args}", string.Join(" ", invalid)));
        TxtExtraArgsIssue.Text = string.Join("\n", lines);
        TxtExtraArgsIssue.Visibility = lines.Count > 0 ? Visibility.Visible : Visibility.Collapsed;
    }
}
