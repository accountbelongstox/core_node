// PY-REF: none (DOT-only)
using System.IO;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.ViewModels;
using DotApps.d3d4tester.Windows;
using DotCore.YoloRecord;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Pages.Calibration;

/// <summary>
/// Segment context menu bridge into the specific (task set) mode: recorded segments are shared in place (frames and annotations as
/// backgrounds / real images), copied as common resources or scenes, and boxes annotated in the VOC annotator become variants.
/// The task-set manager is flushed before and reloaded after each write.
/// </summary>
public partial class CalibrationPage
{
    private static readonly IReadOnlyList<VariantCutout> AnnotationCutouts = new[] { VariantCutout.Rectangle, VariantCutout.ColorKey, VariantCutout.GrabCut };
    private static readonly IReadOnlyList<string> AnnotationCutoutKeys = new[]
    {
        I18nKeys.YoloTaskSetExtractModeRectangle, I18nKeys.VariantExtractModeColorKey, I18nKeys.YoloTaskSetExtractModeGrabCut,
    };

    private static TaskSetStore TaskSets => new(TaskSetStore.DefaultRoot);
    private readonly MenuItem _miSegmentLink = new();
    private readonly MenuItem _miSegmentToCommon = new();
    private readonly MenuItem _miSegmentToScenes = new();
    private readonly MenuItem _miSegmentToVariants = new();
    private bool _taskSetBusy;

    private void BindTaskSetMenu()
    {
        int index = SegmentContextMenu.Items.IndexOf(MiSegmentOpenLabel) + 1;
        SegmentContextMenu.Items.Insert(index, new Separator());
        SegmentContextMenu.Items.Insert(index + 1, _miSegmentLink);
        SegmentContextMenu.Items.Insert(index + 2, _miSegmentToCommon);
        SegmentContextMenu.Items.Insert(index + 3, _miSegmentToScenes);
        SegmentContextMenu.Items.Insert(index + 4, _miSegmentToVariants);
        _miSegmentLink.Click += async (_, _) => await LinkSegmentToTaskSetAsync();
        _miSegmentToCommon.Click += async (_, _) => await AddSegmentToTaskSetAsync(TaskResourcePool.Common);
        _miSegmentToScenes.Click += async (_, _) => await AddSegmentToTaskSetAsync(TaskResourcePool.Scenes);
        _miSegmentToVariants.Click += async (_, _) => await AddSegmentBoxesAsVariantsAsync();
        SegmentContextMenu.Opened += (_, _) =>
        {
            foreach (var item in new[] { _miSegmentLink, _miSegmentToCommon, _miSegmentToScenes, _miSegmentToVariants }) item.IsEnabled = !_taskSetBusy;
            _miSegmentToVariants.IsEnabled &= _contextRow != null && YoloSegmentLayout.SegmentHasLabeled(_contextRow.SegmentPath);
        };
    }

    private void ApplyTaskSetMenuTexts()
    {
        _miSegmentLink.Header = T(I18nKeys.YoloTaskSetSegmentLink);
        _miSegmentToCommon.Header = T(I18nKeys.YoloTaskSetSegmentToCommon);
        _miSegmentToScenes.Header = T(I18nKeys.YoloTaskSetSegmentToScenes);
        _miSegmentToVariants.Header = T(I18nKeys.YoloTaskSetSegmentToVariants);
    }

    private async Task<IReadOnlyList<TaskSet>?> ListTaskSetsAsync()
    {
        var sets = await Task.Run(() => TaskSets.List());
        if (sets.Count > 0) return sets;
        AppendLog(T(I18nKeys.YoloTaskSetSegmentNoSets));
        return null;
    }

    /// <summary>Frames dir of a segment, composed from the recording when missing.</summary>
    private static async Task<string?> SegmentFramesDirAsync(string segmentPath)
    {
        var framesDir = Path.Combine(segmentPath, YoloSegmentLayout.FramesSubdir);
        if (Directory.Exists(framesDir)) return framesDir;
        var (ok, _, composed) = await Task.Run(() => YoloSegmentLayout.ComposeSegmentToFrames(segmentPath));
        return ok && composed != null && Directory.Exists(composed) ? composed : null;
    }

    /// <summary>Flush the manager, reload the set from disk, run the write in the background, then reload the manager.</summary>
    private async Task<TResult?> WriteTaskSetAsync<TResult>(string setId, Func<TaskSet, TResult> write) where TResult : class
    {
        _taskSetBusy = true;
        try
        {
            await TaskSetWindow.FlushPendingAsync(setId);
            var result = await Task.Run(() => TaskSets.Load(setId) is { } fresh ? write(fresh) : null);
            TaskSetWindow.NotifyExternalChange(setId);
            return result;
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            AppendLog(TaskSetUiErrors.Describe(ex));
            return null;
        }
        finally
        {
            _taskSetBusy = false;
        }
    }

    /// <summary>Shares the segment in place: the task set reads its frames and annotations at generation time (nothing copied).</summary>
    private async Task LinkSegmentToTaskSetAsync()
    {
        if (_contextRow == null || _taskSetBusy || await ListTaskSetsAsync() is not { } sets) return;
        var segment = _contextRow.SegmentPath;
        var pick = TaskSetPickerDialog.Show(Window.GetWindow(this), T(I18nKeys.YoloTaskSetSegmentPickTitle), T(I18nKeys.YoloTaskSetSegmentLinkPrompt), sets,
            TaskSetPickTargets.None, ConfigBinding.GetValue(ConfigKeys.YoloTaskSetLastTaskSet, ""));
        if (pick is not { } p) return;
        var added = await WriteTaskSetAsync(p.Set.Id, set => TaskSets.AddSegmentSources(set, new[] { segment }));
        if (added == null) return;
        AppendLog(T(I18nKeys.YoloTaskSetSegmentLinked).Replace("{set}", p.Set.Name).Replace("{added}", added.Count.ToString()));
    }

    private async Task AddSegmentToTaskSetAsync(TaskResourcePool pool)
    {
        if (_contextRow == null || _taskSetBusy || await ListTaskSetsAsync() is not { } sets) return;
        var segment = _contextRow.SegmentPath;
        var mode = TaskSetStore.PoolNeedsTarget(pool) ? TaskSetPickTargets.Single : TaskSetPickTargets.None;
        var prompt = T(pool == TaskResourcePool.Scenes ? I18nKeys.YoloTaskSetSegmentScenesPrompt : I18nKeys.YoloTaskSetSegmentCommonPrompt);
        var pick = TaskSetPickerDialog.Show(Window.GetWindow(this), T(I18nKeys.YoloTaskSetSegmentPickTitle), prompt, sets, mode,
            ConfigBinding.GetValue(ConfigKeys.YoloTaskSetLastTaskSet, ""));
        if (pick is not { } p) return;
        var video = pool == TaskResourcePool.Common ? YoloSegmentLayout.RecordVideoPath(segment) : null;
        var source = video ?? await SegmentFramesDirAsync(segment);
        if (source == null)
        {
            AppendLog(T(I18nKeys.YoloTaskSetSegmentNoFrames));
            return;
        }
        var targetId = p.Targets.FirstOrDefault()?.Id;
        var results = await WriteTaskSetAsync(p.Set.Id, set =>
            TaskSets.AddMany(set, set.Targets.FirstOrDefault(t => t.Id == targetId), pool, new[] { source }));
        if (results == null) return;
        var summary = TaskSetImportSummary.From(results);
        AppendLog(T(I18nKeys.YoloTaskSetSegmentAdded)
            .Replace("{added}", summary.Added.ToString())
            .Replace("{failed}", (summary.Failed.Count + summary.Unsupported.Count).ToString())
            .Replace("{set}", p.Set.Name));
    }

    private async Task AddSegmentBoxesAsVariantsAsync()
    {
        if (_contextRow == null || _taskSetBusy || await ListTaskSetsAsync() is not { } sets) return;
        var framesDir = Path.Combine(_contextRow.SegmentPath, YoloSegmentLayout.FramesSubdir);
        if (!YoloSegmentLayout.SegmentHasLabeled(_contextRow.SegmentPath))
        {
            AppendLog(T(I18nKeys.YoloTaskSetSegmentNotLabeled));
            return;
        }
        var pick = TaskSetPickerDialog.Show(Window.GetWindow(this), T(I18nKeys.YoloTaskSetSegmentPickTitle), T(I18nKeys.YoloTaskSetSegmentVariantsPrompt),
            sets, TaskSetPickTargets.None, ConfigBinding.GetValue(ConfigKeys.YoloTaskSetLastTaskSet, ""),
            I18nKeys.YoloTaskSetSegmentCutout, AnnotationCutoutKeys);
        if (pick is not { } p) return;
        var cutout = AnnotationCutouts[Math.Clamp(p.Option, 0, AnnotationCutouts.Count - 1)];
        AppendLog(T(I18nKeys.YoloTaskSetSegmentExtracting));
        var result = await WriteTaskSetAsync(p.Set.Id, set => TaskSets.AddVariantsFromAnnotations(set, framesDir, framesDir, null, cutout));
        if (result == null) return;
        AppendLog(T(I18nKeys.YoloTaskSetSegmentVariantsAdded)
            .Replace("{added}", result.Added.ToString())
            .Replace("{boxes}", result.Boxes.ToString())
            .Replace("{images}", result.Images.ToString())
            .Replace("{targets}", result.CreatedTargets.Count == 0 ? EmptyCell : string.Join(", ", result.CreatedTargets))
            .Replace("{failed}", result.Failures.Count.ToString())
            .Replace("{set}", p.Set.Name));
    }
}
