// PY-REF: none (DOT-only)
using System.IO;
using System.Text;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media.Imaging;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.ViewModels;
using DotCore.VocAnnotator;
using DotCore.VocAnnotatorUI;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

/// <summary>Task-set manager view: resource pools, imports, soft delete / undo, resource properties and the extractor.</summary>
public partial class TaskSetWindow
{
    // ---------- resources ----------

    private async Task AddFilesAsync(TaskResourcePool pool)
    {
        var filter = pool == TaskResourcePool.Common
            ? $"{T(I18nKeys.YoloTaskSetMediaFilter)}|{ImagePatterns};{VideoPatterns}|{T(I18nKeys.YoloTaskSetImageFilter)}|{ImagePatterns}|{AllFilesPattern}|{AllFilesPattern}"
            : $"{T(I18nKeys.YoloTaskSetImageFilter)}|{ImagePatterns}|{AllFilesPattern}|{AllFilesPattern}";
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = filter, Multiselect = true };
        if (dlg.ShowDialog(this) != true || dlg.FileNames.Length == 0) return;
        await ImportAsync(pool, dlg.FileNames);
    }

    private async Task AddFolderAsync(TaskResourcePool pool)
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.YoloTaskSetFolderTitle) };
        if (dlg.ShowDialog(this) != true) return;
        await ImportAsync(pool, new[] { dlg.FolderName });
    }

    private static void AcceptFileDrag(DragEventArgs e)
    {
        e.Effects = e.Data.GetDataPresent(DataFormats.FileDrop) ? DragDropEffects.Copy : DragDropEffects.None;
        e.Handled = true;
    }

    private static string[]? DroppedPaths(DragEventArgs e) =>
        e.Data.GetData(DataFormats.FileDrop) is string[] { Length: > 0 } paths ? paths : null;

    private async Task DropFilesAsync(TaskResourcePool pool, DragEventArgs e)
    {
        if (DroppedPaths(e) is not { } paths || !_vm.IsIdle) return;
        e.Handled = true;
        await ImportAsync(pool, paths);
    }

    /// <summary>Folders dropped on the target list are imported as a folder tree (one subfolder = one target).</summary>
    private async Task DropOnTargetsAsync(DragEventArgs e)
    {
        if (DroppedPaths(e) is not { } paths || !_vm.IsIdle) return;
        e.Handled = true;
        foreach (var dir in paths.Where(Directory.Exists)) await ImportTreeAsync(dir);
    }

    private async Task ImportAsync(TaskResourcePool pool, IReadOnlyList<string> paths)
    {
        if (paths.Count == 0) return;
        var summary = await _vm.AddPathsAsync(pool, paths);
        if (summary is { IsClean: false }) ShowImportSummary(summary);
    }

    private void ShowImportSummary(TaskSetImportSummary summary)
    {
        var sb = new StringBuilder();
        sb.AppendLine(T(I18nKeys.YoloTaskSetImportSummary)
            .Replace("{added}", N(summary.Added))
            .Replace("{skipped}", N(summary.Unsupported.Count))
            .Replace("{failed}", N(summary.Failed.Count)));
        if (summary.TargetsCreated > 0) sb.AppendLine(T(I18nKeys.YoloTaskSetImportTargetsCreated).Replace("{count}", N(summary.TargetsCreated)));
        if (summary.Cancelled > 0) sb.AppendLine(T(I18nKeys.YoloTaskSetImportCancelled).Replace("{count}", N(summary.Cancelled)));
        foreach (var f in summary.Failed.Take(ImportSummaryMaxLines))
            sb.AppendLine(LinePrefix + System.IO.Path.GetFileName(f.SourcePath) + T(I18nKeys.YoloTaskSetInfoSeparator)
                + T(I18nKeys.YoloTaskSetImportFailureReason(f.Failure)));
        foreach (var f in summary.Unsupported.Take(ImportSummaryMaxLines))
            sb.AppendLine(LinePrefix + System.IO.Path.GetFileName(f.SourcePath) + T(I18nKeys.YoloTaskSetInfoSeparator) + T(I18nKeys.YoloTaskSetImportUnsupported));
        Warn(sb.ToString().TrimEnd());
    }

    private async Task ImportTreeAsync(string? rootDir = null)
    {
        if (_vm.Set == null) return;
        if (rootDir == null)
        {
            var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.YoloTaskSetTreeTitle) };
            if (dlg.ShowDialog(this) != true) return;
            rootDir = dlg.FolderName;
        }
        if (await _vm.PlanFolderTreeAsync(rootDir) is not { } plan) return;
        if (plan.FileCount == 0)
        {
            Warn(T(I18nKeys.YoloTaskSetTreePlanEmpty).Replace("{path}", plan.RootDir));
            return;
        }
        var sb = new StringBuilder();
        sb.AppendLine(T(I18nKeys.YoloTaskSetTreePlan)
            .Replace("{path}", plan.RootDir)
            .Replace("{targets}", N(plan.Targets.Count))
            .Replace("{new}", N(plan.NewTargets))
            .Replace("{common}", N(plan.Common.Count))
            .Replace("{distractors}", N(plan.Distractors.Count))
            .Replace("{ignored}", N(plan.Ignored.Count)));
        foreach (var t in plan.Targets.Take(ImportSummaryMaxLines))
            sb.AppendLine(LinePrefix + T(t.Exists ? I18nKeys.YoloTaskSetTreePlanTargetExists : I18nKeys.YoloTaskSetTreePlanTarget)
                .Replace("{name}", t.Name)
                .Replace("{variants}", N(t.Variants.Count))
                .Replace("{scenes}", N(t.Scenes.Count)));
        if (!Confirm(sb.ToString().TrimEnd())) return;
        var summary = await _vm.ImportFolderTreeAsync(rootDir);
        if (summary is { IsClean: false }) ShowImportSummary(summary);
    }

    private async Task ImportFromSetAsync()
    {
        var others = _vm.OtherSets;
        if (others.Count == 0)
        {
            Warn(T(I18nKeys.YoloTaskSetFromSetNone));
            return;
        }
        var pick = TaskSetPickerDialog.Show(this, T(I18nKeys.YoloTaskSetImportFromSet), T(I18nKeys.YoloTaskSetFromSetPrompt), others, TaskSetPickTargets.Multiple);
        if (pick is not { } p || p.Targets.Count == 0) return;
        var summary = await _vm.CopyTargetsAsync(p.Set, p.Targets);
        if (summary is { IsClean: false }) ShowImportSummary(summary);
    }

    private async Task UndoAsync()
    {
        if (!_vm.CanUndo || !_vm.IsIdle) return;
        if (!await _vm.UndoAsync()) Warn(T(I18nKeys.YoloTaskSetUndoFailed));
    }

    private static List<TaskResource> SelectedResources(ListBox list) => list.SelectedItems.OfType<TaskResourceRow>().Select(r => r.Resource).ToList();

    private void SetPixelScale(ListBox list)
    {
        var selected = SelectedResources(list);
        if (selected.Count == 0) return;
        var initial = TaskSetFields.Format(selected[0].EffectivePixelScale);
        if (AskName(I18nKeys.YoloTaskSetMenuPixelScale, I18nKeys.YoloTaskSetPixelScalePrompt, initial) is not { } text) return;
        if (TaskSetFields.Parse(TaskSetFieldKind.Double, text) is not double scale || scale <= 0)
        {
            Warn(T(I18nKeys.YoloTaskSetPixelScaleInvalid));
            return;
        }
        _vm.SetPixelScale(selected, scale);
    }

    private async Task<BitmapSource?> LoadFullImageAsync(TaskResource resource)
    {
        var path = _vm.ResourcePath(resource);
        bool video = resource.Kind == TaskResourceKind.Video;
        var image = await Task.Run(() =>
        {
            try
            {
                return video ? VariantExtractor.LoadFramePng(path, 0) is { } png ? BitmapDecode.FromBytes(png) : null : BitmapDecode.TryFromFile(path);
            }
            catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
            {
                return null;
            }
        });
        if (image == null) Warn(T(I18nKeys.YoloTaskSetImageUnreadable).Replace("{name}", System.IO.Path.GetFileName(path)));
        return image;
    }

    private static AnnotationBox ToBox(PixelRect r, string label) => new(label, r.X, r.Y, r.X + r.Width, r.Y + r.Height);

    private static (int X, int Y, int Width, int Height) ToRect(AnnotationBox b) =>
        ((int)b.XMin, (int)b.YMin, Math.Max(1, (int)(b.XMax - b.XMin)), Math.Max(1, (int)(b.YMax - b.YMin)));

    private async Task EditRegionsAsync(ListBox list)
    {
        if (SelectedRow(list)?.Resource is not { } resource || await LoadFullImageAsync(resource) is not { } image) return;
        var label = T(I18nKeys.YoloTaskSetRegionLabel);
        var old = resource.Regions ?? new List<PlacementRegion>();
        var edited = TaskSetRegionEditor.ShowRegions(this, T(I18nKeys.YoloTaskSetRegionsTitle).Replace("{name}", System.IO.Path.GetFileName(resource.File)),
            T(I18nKeys.YoloTaskSetRegionsHint), image, old.Select(r => ToBox(r, label)), label,
            old.FirstOrDefault()?.SnapPitchX ?? 0, old.FirstOrDefault()?.SnapPitchY ?? 0);
        if (edited is not { } e) return;
        _vm.SetRegions(resource, e.Regions.Select(b =>
        {
            var (x, y, w, h) = ToRect(b);
            return new PlacementRegion { X = x, Y = y, Width = w, Height = h, SnapPitchX = e.PitchX, SnapPitchY = e.PitchY };
        }).ToList());
    }

    /// <summary>Masked-out regions of a background (objects that must not be learned as background); labeled boxes are kept.</summary>
    private async Task EditMasksAsync(TaskResource resource)
    {
        if (await LoadFullImageAsync(resource) is not { } image) return;
        var label = T(I18nKeys.YoloTaskSetMaskLabel);
        var boxes = resource.Boxes ?? new List<ResourceBox>();
        var edited = TaskSetRegionEditor.Show(this, T(I18nKeys.YoloTaskSetMasksTitle).Replace("{name}", System.IO.Path.GetFileName(resource.File)),
            T(I18nKeys.YoloTaskSetMasksHint), image, boxes.Where(b => b.Mask).Select(b => ToBox(b, label)), label);
        if (edited == null) return;
        var kept = boxes.Where(b => !b.Mask).ToList();
        kept.AddRange(edited.Select(b =>
        {
            var (x, y, w, h) = ToRect(b);
            return new ResourceBox { X = x, Y = y, Width = w, Height = h, Mask = true };
        }));
        _vm.SetResourceBoxes(resource, kept);
    }

    private void AddHoldout()
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.YoloTaskSetHoldoutFolderTitle) };
        if (dlg.ShowDialog(this) == true) _vm.AddHoldout(dlg.FolderName);
    }

    private void RemoveHoldouts() => _vm.RemoveHoldouts(LstHoldouts.SelectedItems.OfType<TaskSetHoldoutRow>().ToList());

    private async Task AddSegmentsAsync()
    {
        var dlg = new Microsoft.Win32.OpenFolderDialog { Title = T(I18nKeys.YoloTaskSetSegmentsFolderTitle), Multiselect = true };
        if (Directory.Exists(YoloDataLayout.Root)) dlg.InitialDirectory = YoloDataLayout.Root;
        if (dlg.ShowDialog(this) == true) await AddSegmentDirsAsync(dlg.FolderNames);
    }

    private async Task AddSegmentDirsAsync(IReadOnlyList<string> dirs)
    {
        if (dirs.Count == 0) return;
        if (await _vm.AddSegmentsAsync(dirs) == 0) Warn(T(I18nKeys.YoloTaskSetSegmentsNone));
        UpdateEnabled();
    }

    private async Task ExtractSegmentVariantsAsync()
    {
        if (!Confirm(T(I18nKeys.YoloTaskSetSegmentsExtractConfirm)
                .Replace("{step}", N(SegmentVariantOptions.FrameStep))
                .Replace("{distance}", N(SegmentVariantOptions.MinHashDistance))
                .Replace("{max}", N(SegmentVariantOptions.MaxPerLabel)))) return;
        if (await _vm.ExtractSegmentVariantsAsync(VariantCutout.Rectangle, SegmentVariantOptions) is not { } r) return;
        MessageBox.Show(this, T(I18nKeys.YoloTaskSetSegmentsExtractDone)
            .Replace("{segments}", N(r.Segments))
            .Replace("{added}", N(r.Added))
            .Replace("{duplicates}", N(r.Duplicates))
            .Replace("{targets}", r.Created.Count == 0 ? "-" : string.Join(", ", r.Created)), Title, MessageBoxButton.OK, MessageBoxImage.Information);
    }

    private async Task RemoveSelectedAsync(ListBox list)
    {
        var selected = SelectedResources(list);
        if (selected.Count == 0) return;
        if (!Confirm(T(I18nKeys.YoloTaskSetRemoveConfirm).Replace("{count}", N(selected.Count)))) return;
        await _vm.RemoveResourcesAsync(selected);
    }

    private VariantExtractWindow? EnsureExtractor()
    {
        if (_vm.Set is not { } set) return null;
        if (set.Targets.Count == 0)
        {
            Warn(T(I18nKeys.YoloTaskSetExtractNoTarget));
            return null;
        }
        if (_extract != null) return _extract;
        var win = new VariantExtractWindow(set, _vm.Store, _vm.AddExtractedAsync, _vm.AddDistractorsAsync) { Owner = this };
        win.Closed += (_, _) =>
        {
            if (ReferenceEquals(_extract, win)) _extract = null;
        };
        _extract = win;
        _extractSet = set;
        win.Show();
        win.SetAddBlocked(_vm.IsGenerating);
        return win;
    }

    private void OpenExtract(string? sourcePath)
    {
        if (EnsureExtractor() is { } win && _vm.Set is { } set) win.Open(_vm.Target ?? set.Targets[0], sourcePath);
    }

    private void OpenExtractDistractors(string? sourcePath) => EnsureExtractor()?.OpenForDistractors(sourcePath);

    /// <summary>Re-cut the selected stored variant in the extractor (adding replaces it).</summary>
    private void EditSelectedVariant()
    {
        if (_vm.Target is not { } target || SelectedRow(LstVariants)?.Resource is not { } variant) return;
        EnsureExtractor()?.EditVariant(target, variant);
    }
}
