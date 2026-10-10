// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Globalization;
using System.IO;
using System.Text.Json;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotApps.d3d4tester.ViewModels.Base;
using DotApps.d3d4tester.Windows;
using DotCore.VocAnnotator;
using DotCore.VocAnnotatorUI;
using DotCore.YoloTaskSet;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>Outcome of a batch import (AddMany, folder tree, copied targets, annotated boxes).</summary>
public sealed record TaskSetImportSummary(int Added, int TargetsCreated, IReadOnlyList<ImportFileResult> Unsupported, IReadOnlyList<ImportFileResult> Failed, int Cancelled)
{
    public bool IsClean => Unsupported.Count == 0 && Failed.Count == 0 && Cancelled == 0;

    public static TaskSetImportSummary From(IReadOnlyList<ImportFileResult> files, int targetsCreated = 0) => new(
        files.Count(f => f.Outcome == ImportOutcome.Added),
        targetsCreated,
        files.Where(f => f.Outcome == ImportOutcome.Unsupported).ToList(),
        files.Where(f => f.Outcome == ImportOutcome.Failed).ToList(),
        files.Count(f => f.Outcome == ImportOutcome.Cancelled));
}

/// <summary>One undoable soft delete (store trash token) of a task set.</summary>
public sealed record TaskSetUndoEntry(string SetId, string Token);

/// <summary>
/// State and operations of the task-set manager (YOLO_TASKSET_SYNTHESIS_DESIGN.md section 6). Every store / synthesizer call is
/// serialized through one gate and runs off the UI thread; the window only prompts, renders and forwards input.
/// </summary>
public sealed class TaskSetManagerViewModel : BaseViewModel
{
    public const string ChipIdle = "StatusChipStyle";
    public const string ChipInfo = "StatusChipInfoStyle";
    public const string ChipSuccess = "StatusChipSuccessStyle";
    public const string ChipWarning = "StatusChipWarningStyle";
    public const string ChipDanger = "StatusChipDangerStyle";
    public const int MaxImagesPerTarget = 100_000;

    private const int SaveDebounceMs = 400;
    private const int MaxUndoEntries = 20;
    private const double PixelScaleEpsilon = 1e-6;
    private const int AugGridCount = 9;
    private const string NumberPlaceholderDone = "{done}";
    private const string NumberPlaceholderTotal = "{total}";

    private readonly SemaphoreSlim _gate = new(1, 1);
    private readonly DispatcherTimer _saveTimer;
    private readonly List<TaskSetUndoEntry> _undo = new();
    private TaskSet? _set;
    private TaskTarget? _target;
    private IReadOnlyList<TaskSetIssue>? _issues;
    private IReadOnlyList<ContaminationHit> _hits = Array.Empty<ContaminationHit>();
    private PreviewResult? _preview;
    private BitmapSource? _previewImage;
    private SynthesisResult? _result;
    private CancellationTokenSource? _jobCts;
    private Task? _generateTask;
    private string _statusStyle = ChipIdle;
    private Func<string> _statusText = () => T(I18nKeys.YoloTaskSetStatusIdle);
    private double _progress;
    private int _commonVersion;
    private int _busyDepth;
    private int _editVersion;
    private int _validatedVersion = -1;
    private bool _isGenerating;

    public TaskSetManagerViewModel()
    {
        _saveTimer = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(SaveDebounceMs) };
        _saveTimer.Tick += async (_, _) => await FlushSaveAsync();
    }

    /// <summary>A handled failure; the text is already localized (TaskSetUiErrors.Describe).</summary>
    public event Action<string>? ErrorRaised;

    /// <summary>Busy / generating / selection state changed: the view refreshes IsEnabled of its commands.</summary>
    public event Action? StateChanged;

    public TaskSetStore Store => new(TaskSetStore.DefaultRoot);

    public ObservableCollection<TaskSetRow> Sets { get; } = new();

    public ObservableCollection<TaskTargetRow> Targets { get; } = new();

    public ObservableCollection<TaskResourceRow> Variants { get; } = new();

    public ObservableCollection<TaskResourceRow> Scenes { get; } = new();

    public ObservableCollection<TaskResourceRow> Common { get; } = new();

    public ObservableCollection<TaskResourceRow> Distractors { get; } = new();

    public ObservableCollection<TaskSetIssueRow> IssueRows { get; } = new();

    public ObservableCollection<TaskSetHoldoutRow> Holdouts { get; } = new();

    public ObservableCollection<TaskSetSegmentRow> Segments { get; } = new();

    public ObservableCollection<TaskSetDatasetRow> Datasets { get; } = new();

    public ObservableCollection<TaskSetRunRow> Runs { get; } = new();

    public TaskSet? Set { get => _set; private set => SetProperty(ref _set, value); }

    public TaskTarget? Target { get => _target; private set => SetProperty(ref _target, value); }

    public IReadOnlyList<TaskSetIssue>? Issues
    {
        get => _issues;
        private set => SetValidation(value, Array.Empty<ContaminationHit>());
    }

    /// <summary>Issue rows; BackgroundContainsTarget rows carry their contamination hit (matched through TaskSetSynthesizer.ToIssue).</summary>
    private void SetValidation(IReadOnlyList<TaskSetIssue>? issues, IReadOnlyList<ContaminationHit> hits)
    {
        _issues = issues;
        _hits = hits;
        IssueRows.Clear();
        var open = hits.ToList();
        foreach (var issue in TaskSetIssueFormatter.Ordered(issues ?? Array.Empty<TaskSetIssue>()))
        {
            int idx = issue.Code == TaskSetIssueCode.BackgroundContainsTarget ? open.FindIndex(h => TaskSetSynthesizer.ToIssue(h) == issue) : -1;
            ContaminationHit? hit = idx < 0 ? null : open[idx];
            if (idx >= 0) open.RemoveAt(idx);
            IssueRows.Add(TaskSetIssueFormatter.Row(issue, hit));
        }
        RaisePropertyChanged(nameof(Issues));
    }

    /// <summary>Contamination hit resolved by the user: the matched object becomes a positive label of its target, or is masked out.</summary>
    public void ResolveHit(TaskSetIssueRow row, bool mask)
    {
        if (row.Hit is not { } hit || FindResource(hit.ResourceId) is not { } resource) return;
        (resource.Boxes ??= new List<ResourceBox>()).Add(new ResourceBox
        {
            X = hit.X, Y = hit.Y, Width = hit.Width, Height = hit.Height, Label = mask ? "" : hit.TargetName, Mask = mask,
        });
        IssueRows.Remove(row);
        foreach (var r in Variants.Concat(Scenes).Concat(Common).Concat(Distractors)) DescribeResource(r);
        ScheduleSave();
    }

    /// <summary>Image a contamination hit was found in (the cached frame for videos).</summary>
    public string HitImagePath(ContaminationHit hit)
    {
        if (_set == null) return "";
        var dir = Store.GetDir(_set.Id);
        return hit.Frame != null ? Path.Combine(TaskSetStore.FrameCacheDir(dir, hit.ResourceId), hit.Frame)
            : FindResource(hit.ResourceId) is { } r ? Store.ResourcePath(_set, r)
            : Path.IsPathRooted(hit.ResourceFile) ? hit.ResourceFile : "";
    }

    public PreviewResult? Preview { get => _preview; private set => SetProperty(ref _preview, value); }

    public BitmapSource? PreviewImage { get => _previewImage; private set => SetProperty(ref _previewImage, value); }

    public int PreviewSeed { get; private set; }

    public SynthesisResult? Result { get => _result; private set => SetProperty(ref _result, value); }

    public double Progress { get => _progress; private set => SetProperty(ref _progress, value); }

    public string StatusStyle => _statusStyle;

    public string StatusText => _statusText();

    public bool IsBusy => _busyDepth > 0;

    /// <summary>Generation (on a snapshot of the set) is running; the extractor must not add variants meanwhile.</summary>
    public bool IsGenerating => _isGenerating;

    /// <summary>A cancellable job (import, preview or generation) is running.</summary>
    public bool CanCancel => _jobCts != null;

    public bool IsIdle => !IsBusy && _jobCts == null;

    public bool HasPendingWork => _saveTimer.IsEnabled || _generateTask != null;

    public bool CanUndo => _set != null && _undo.Any(u => u.SetId == _set.Id);

    public int TargetIndex => _target == null || _set == null ? -1 : _set.Targets.IndexOf(_target);

    public string TaskSetDir => _set == null ? "" : Store.GetDir(_set.Id);

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static string N(int value) => value.ToString(CultureInfo.InvariantCulture);

    // ---------- infrastructure ----------

    /// <summary>Serialized background store / synthesizer call; handled failures raise ErrorRaised and yield default.</summary>
    public async Task<TResult?> RunAsync<TResult>(Func<TResult> work, bool busy = false)
    {
        await _gate.WaitAsync();
        if (busy) EnterBusy();
        try
        {
            return await Task.Run(work);
        }
        catch (OperationCanceledException)
        {
            return default;
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            ReportError(ex);
            return default;
        }
        finally
        {
            if (busy) ExitBusy();
            _gate.Release();
        }
    }

    public Task<bool> RunAsync(Action work, bool busy = false) => RunAsync(() =>
    {
        work();
        return true;
    }, busy);

    public void ReportError(Exception ex)
    {
        SetStatus(ChipDanger, () => T(I18nKeys.YoloTaskSetStatusFailed));
        ErrorRaised?.Invoke(TaskSetUiErrors.Describe(ex));
    }

    private void EnterBusy()
    {
        _busyDepth++;
        if (_busyDepth == 1) SetStatus(ChipInfo, () => T(I18nKeys.YoloTaskSetStatusBusy));
        StateChanged?.Invoke();
    }

    private void ExitBusy()
    {
        _busyDepth = Math.Max(0, _busyDepth - 1);
        if (_busyDepth == 0 && _statusStyle == ChipInfo && _jobCts == null) SetStatus(ChipIdle, () => T(I18nKeys.YoloTaskSetStatusIdle));
        StateChanged?.Invoke();
    }

    public void SetStatus(string style, Func<string> text)
    {
        _statusStyle = style;
        _statusText = text;
        RaisePropertyChanged(nameof(StatusStyle));
        RaisePropertyChanged(nameof(StatusText));
    }

    public void ScheduleSave()
    {
        if (_set == null) return;
        _editVersion++;
        _saveTimer.Stop();
        _saveTimer.Start();
    }

    public async Task FlushSaveAsync()
    {
        if (!_saveTimer.IsEnabled) return;
        _saveTimer.Stop();
        if (_set is not { } set) return;
        await RunAsync(() => Store.Save(set));
        RefreshSetRows();
    }

    /// <summary>Wait for a running generation and the pending save (window close).</summary>
    public async Task CompletePendingAsync()
    {
        _jobCts?.Cancel();
        if (_generateTask is { } running)
        {
            try
            {
                await running;
            }
            catch (Exception ex) when (ex is OperationCanceledException || TaskSetUiErrors.IsHandled(ex))
            {
            }
        }
        await FlushSaveAsync();
    }

    public void CancelJob() => _jobCts?.Cancel();

    private CancellationTokenSource BeginJob()
    {
        var cts = new CancellationTokenSource();
        _jobCts = cts;
        Progress = 0;
        StateChanged?.Invoke();
        return cts;
    }

    private void EndJob(CancellationTokenSource cts)
    {
        if (ReferenceEquals(_jobCts, cts)) _jobCts = null;
        cts.Dispose();
        StateChanged?.Invoke();
    }

    private void ReportProgress(int done, int total, string key)
    {
        Progress = total <= 0 ? 0 : (double)done / total;
        SetStatus(ChipInfo, () => T(key).Replace(NumberPlaceholderDone, N(done)).Replace(NumberPlaceholderTotal, N(total)));
    }

    /// <summary>Re-apply every localized row text (language switch).</summary>
    public void RefreshTexts()
    {
        RefreshSetRows();
        RefreshTargetRows();
        foreach (var row in Variants.Concat(Scenes).Concat(Common).Concat(Distractors)) DescribeResource(row);
        SetValidation(_issues, _hits);
        foreach (var row in Datasets) DescribeDataset(row);
        SyncHoldouts();
        SyncSegments();
        foreach (var row in Runs) DescribeRun(row);
        RaisePropertyChanged(nameof(StatusText));
    }

    // ---------- task sets ----------

    public async Task ReloadSetsAsync(string? selectId, string? selectTargetId = null)
    {
        await FlushSaveAsync();
        var list = await RunAsync(() => Store.List()) ?? Array.Empty<TaskSet>();
        Sets.Clear();
        foreach (var s in list.OrderBy(s => s.Name, StringComparer.CurrentCultureIgnoreCase)) Sets.Add(new TaskSetRow(s));
        RefreshSetRows();
        var row = Sets.FirstOrDefault(r => r.Set.Id == selectId) ?? Sets.FirstOrDefault();
        await SelectSetAsync(row?.Set, selectTargetId);
    }

    /// <summary>Re-read the selected set from disk after another window changed it (selection kept by id).</summary>
    public Task ReloadCurrentAsync() => _set is { } set ? ReloadSetsAsync(set.Id, _target?.Id) : Task.CompletedTask;

    public void RefreshSetRows()
    {
        foreach (var row in Sets)
        {
            row.Name = row.Set.Name;
            row.Detail = T(I18nKeys.YoloTaskSetSetRowDetail)
                .Replace("{targets}", N(row.Set.Targets.Count))
                .Replace("{common}", N(row.Set.CommonResources.Count));
        }
    }

    public async Task SelectSetAsync(TaskSet? set, string? selectTargetId = null)
    {
        if (ReferenceEquals(set, _set)) return;
        await FlushSaveAsync();
        Set = set;
        Target = null;
        Issues = null;
        Preview = null;
        PreviewImage = null;
        Result = null;
        PreviewSeed = set?.Synthesis.Seed ?? 0;
        if (set != null) ConfigBinding.SaveString(ConfigKeys.YoloTaskSetLastTaskSet, set.Id);
        RefreshTargetRows(selectTargetId);
        SyncResources(TaskResourcePool.Common);
        SyncResources(TaskResourcePool.Distractors);
        SyncHoldouts();
        SyncSegments();
        SetStatus(ChipIdle, () => T(I18nKeys.YoloTaskSetStatusIdle));
        StateChanged?.Invoke();
        await RefreshHistoryAsync();
    }

    public async Task<TaskSet?> CreateSetAsync(string name)
    {
        var created = await RunAsync(() => Store.Create(name));
        if (created != null) await ReloadSetsAsync(created.Id);
        return created;
    }

    public async Task RenameSetAsync(string name)
    {
        if (_set is not { } set || name == set.Name) return;
        set.Name = name;
        _saveTimer.Stop();
        await RunAsync(() => Store.Save(set));
        RefreshSetRows();
    }

    public async Task DuplicateSetAsync(string name)
    {
        if (_set is not { } set) return;
        await FlushSaveAsync();
        var copy = await RunAsync(() => Store.Duplicate(set.Id, name), busy: true);
        if (copy != null) await ReloadSetsAsync(copy.Id);
    }

    public async Task DeleteSetAsync()
    {
        if (_set is not { } set) return;
        _saveTimer.Stop();
        if (await RunAsync(() => Store.Delete(set.Id), busy: true)) await ReloadSetsAsync(null);
    }

    public void SetDescription(string text)
    {
        if (_set == null || _set.Description == text) return;
        _set.Description = text;
        ScheduleSave();
    }

    // ---------- targets ----------

    /// <summary>Sync target rows with the set (rows of unchanged targets are kept) and keep / fix the selection.</summary>
    public void RefreshTargetRows(string? selectId = null)
    {
        selectId ??= _target?.Id;
        var targets = _set?.Targets ?? new List<TaskTarget>();
        SyncRows(Targets, targets, r => r.Target, t => new TaskTargetRow(t));
        for (int i = 0; i < Targets.Count; i++)
        {
            var t = Targets[i].Target;
            Targets[i].Title = T(I18nKeys.YoloTaskSetTargetRow).Replace("{number}", N(i + 1)).Replace("{name}", t.Name);
            Targets[i].Detail = T(I18nKeys.YoloTaskSetTargetRowDetail)
                .Replace("{index}", N(i))
                .Replace("{variants}", N(t.Variants.Count))
                .Replace("{scenes}", N(t.Scenes.Count));
        }
        var next = targets.FirstOrDefault(t => t.Id == selectId) ?? targets.FirstOrDefault();
        SelectTarget(next);
    }

    public void SelectTarget(TaskTarget? target)
    {
        if (ReferenceEquals(target, _target)) return;
        Target = target;
        SyncResources(TaskResourcePool.Variants);
        SyncResources(TaskResourcePool.Scenes);
        StateChanged?.Invoke();
    }

    public string TargetTitle(TaskTarget? target)
    {
        int idx = target == null || _set == null ? -1 : _set.Targets.IndexOf(target);
        return idx >= 0 && idx < Targets.Count ? Targets[idx].Title
            : T(_set == null ? I18nKeys.YoloTaskSetNoSetSelected : I18nKeys.YoloTaskSetNoTargetSelected);
    }

    public async Task<TaskTarget?> AddTargetAsync(string name)
    {
        if (_set is not { } set) return null;
        var added = await RunAsync(() => Store.AddTarget(set, name));
        AfterStructureChange(added?.Id);
        return added;
    }

    public async Task RenameTargetAsync(string name)
    {
        if (_set is not { } set || _target is not { } target || name == target.Name) return;
        target.Name = name;
        _saveTimer.Stop();
        await RunAsync(() => Store.Save(set));
        AfterStructureChange(target.Id);
    }

    public async Task DeleteTargetAsync()
    {
        if (_set is not { } set || _target is not { } target) return;
        int idx = set.Targets.IndexOf(target);
        await FlushSaveAsync();
        var token = await RunAsync(() => Store.RemoveTarget(set, target.Id), busy: true);
        PushUndo(set, token);
        var next = set.Targets.Count == 0 ? null : set.Targets[Math.Clamp(idx, 0, set.Targets.Count - 1)].Id;
        AfterStructureChange(next);
    }

    public async Task MoveTargetAsync(int delta)
    {
        if (_set is not { } set || _target is not { } target) return;
        await RunAsync(() => Store.MoveTarget(set, target.Id, delta));
        AfterStructureChange(target.Id);
    }

    /// <summary>Raised after targets or resources changed (the extractor refreshes its target list).</summary>
    public event Action? StructureChanged;

    private void AfterStructureChange(string? selectTargetId)
    {
        _editVersion++;
        Issues = null;
        RefreshTargetRows(selectTargetId);
        SyncResources(TaskResourcePool.Variants);
        SyncResources(TaskResourcePool.Scenes);
        SyncResources(TaskResourcePool.Common);
        SyncResources(TaskResourcePool.Distractors);
        RefreshSetRows();
        StructureChanged?.Invoke();
        StateChanged?.Invoke();
    }

    public void SetImagesPerTarget(int? value)
    {
        if (_target == null || _set == null) return;
        _target.ImagesPerTarget = value is { } v ? Math.Clamp(v, 1, MaxImagesPerTarget) : null;
        ScheduleSave();
    }

    // ---------- resources ----------

    public ObservableCollection<TaskResourceRow> RowsOf(TaskResourcePool pool) => pool switch
    {
        TaskResourcePool.Variants => Variants,
        TaskResourcePool.Scenes => Scenes,
        TaskResourcePool.Distractors => Distractors,
        _ => Common,
    };

    private IReadOnlyList<TaskResource> ResourcesOf(TaskResourcePool pool) => pool switch
    {
        TaskResourcePool.Variants => _target?.Variants ?? new List<TaskResource>(),
        TaskResourcePool.Scenes => _target?.Scenes ?? new List<TaskResource>(),
        TaskResourcePool.Distractors => _set?.Distractors ?? new List<TaskResource>(),
        _ => _set?.CommonResources ?? new List<TaskResource>(),
    };

    /// <summary>Incremental row sync: rows of kept resources (and their decoded thumbnails) survive, new rows are inserted in place.</summary>
    public void SyncResources(TaskResourcePool pool)
    {
        var set = _set;
        Action? labelChanged = pool == TaskResourcePool.Variants ? ScheduleSave : null;
        var rows = RowsOf(pool);
        SyncRows(rows, set == null ? new List<TaskResource>() : ResourcesOf(pool), r => r.Resource,
            r => new TaskResourceRow(r, Store.ResourcePath(set!, r), labelChanged));
        foreach (var row in rows) DescribeResource(row);
        if (pool == TaskResourcePool.Common) RefreshVideoEstimates();
    }

    private static void SyncRows<TRow, TItem>(ObservableCollection<TRow> rows, IReadOnlyList<TItem> items, Func<TRow, TItem> itemOf, Func<TItem, TRow> create)
        where TItem : class
    {
        var keep = new HashSet<TItem>(items, ReferenceEqualityComparer.Instance as IEqualityComparer<TItem>);
        for (int i = rows.Count - 1; i >= 0; i--)
            if (!keep.Contains(itemOf(rows[i]))) rows.RemoveAt(i);
        for (int i = 0; i < items.Count; i++)
        {
            if (i < rows.Count && ReferenceEquals(itemOf(rows[i]), items[i])) continue;
            int existing = -1;
            for (int j = i + 1; j < rows.Count; j++)
            {
                if (!ReferenceEquals(itemOf(rows[j]), items[i])) continue;
                existing = j;
                break;
            }
            if (existing >= 0) rows.Move(existing, i);
            else rows.Insert(i, create(items[i]));
        }
        while (rows.Count > items.Count) rows.RemoveAt(rows.Count - 1);
    }

    private static void DescribeResource(TaskResourceRow row)
    {
        var r = row.Resource;
        var parts = new List<string>
        {
            !row.IsVideo ? T(I18nKeys.YoloTaskSetKindImage)
            : row.FramesFailed ? T(I18nKeys.YoloTaskSetVideoFramesFailed)
            : row.Frames is { } n ? T(I18nKeys.YoloTaskSetVideoFrames).Replace("{count}", N(n))
            : T(I18nKeys.YoloTaskSetVideoFramesPending),
        };
        if (Math.Abs(r.EffectivePixelScale - 1) > PixelScaleEpsilon)
            parts.Add(T(I18nKeys.YoloTaskSetInfoPixelScale).Replace("{scale}", TaskSetFields.Format(r.EffectivePixelScale)));
        if (r.ValOnly) parts.Add(T(I18nKeys.YoloTaskSetInfoValOnly));
        if (r.Regions is { Count: > 0 } regions) parts.Add(T(I18nKeys.YoloTaskSetInfoRegions).Replace("{count}", N(regions.Count)));
        if (r.Boxes is { Count: > 0 } boxes) parts.Add(T(I18nKeys.YoloTaskSetInfoBoxes).Replace("{count}", N(boxes.Count)));
        row.Info = string.Join(T(I18nKeys.YoloTaskSetInfoSeparator), parts);
    }


    public void RefreshVideoEstimates()
    {
        if (_set is not { } set) return;
        int version = ++_commonVersion;
        int interval = set.Synthesis.VideoFrameInterval;
        int max = set.Synthesis.VideoMaxFrames;
        foreach (var row in Common.Where(r => r.IsVideo))
        {
            row.Frames = null;
            row.FramesFailed = false;
            DescribeResource(row);
            _ = EstimateFramesAsync(row, interval, max, version);
        }
    }

    private async Task EstimateFramesAsync(TaskResourceRow row, int interval, int max, int version)
    {
        var path = row.Path;
        int? frames;
        try
        {
            frames = await Task.Run(() => VideoFrameExtractor.EstimateFrames(path, interval, max));
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            frames = null;
        }
        if (version != _commonVersion) return;
        row.Frames = frames;
        row.FramesFailed = frames is null or <= 0;
        DescribeResource(row);
    }

    /// <summary>Batch import into a pool (directories recursively, one save) with progress / cancel; bad files are reported, not thrown.</summary>
    public async Task<TaskSetImportSummary?> AddPathsAsync(TaskResourcePool pool, IReadOnlyList<string> paths, TaskTarget? target = null)
    {
        if (_set is not { } set) return null;
        target ??= _target;
        bool needsTarget = TaskSetStore.PoolNeedsTarget(pool);
        if (needsTarget && (target == null || !set.Targets.Contains(target))) return null;
        await FlushSaveAsync();
        var owner = needsTarget ? target : null;
        var results = await RunJobAsync(I18nKeys.YoloTaskSetStatusImporting, (progress, ct) => Store.AddMany(set, owner, pool, paths, progress, ct));
        AfterStructureChange(_target?.Id);
        return results == null ? null : TaskSetImportSummary.From(results);
    }

    /// <summary>Progress sinks (created on the UI thread) and cancel token of one background job.</summary>
    private sealed record JobContext(IProgress<WorkProgress> Work, IProgress<SynthesisProgress> Synthesis, CancellationToken Token);

    private Task<TResult?> RunJobAsync<TResult>(string progressKey, Func<IProgress<WorkProgress>, CancellationToken, TResult> work) =>
        RunJobAsync(progressKey, job => work(job.Work, job.Token));

    /// <summary>Background job with progress (status line) and cancel (Cancel button); handled failures and cancel yield default.</summary>
    private async Task<TResult?> RunJobAsync<TResult>(string progressKey, Func<JobContext, TResult> work)
    {
        var cts = BeginJob();
        var job = new JobContext(
            new Progress<WorkProgress>(p => ReportProgress(p.Done, p.Total, progressKey)),
            new Progress<SynthesisProgress>(p => ReportProgress(p.Done, p.Total, progressKey)),
            cts.Token);
        try
        {
            var result = await RunAsync(() => work(job), busy: true);
            if (cts.IsCancellationRequested) SetStatus(ChipWarning, () => T(I18nKeys.YoloTaskSetStatusCancelled));
            return result;
        }
        finally
        {
            EndJob(cts);
            Progress = 0;
            if (_statusStyle == ChipInfo) SetStatus(ChipIdle, () => T(I18nKeys.YoloTaskSetStatusIdle));
        }
    }

    /// <summary>Soft delete (store trash) with undo.</summary>
    public async Task RemoveResourcesAsync(IReadOnlyList<TaskResource> resources)
    {
        if (_set is not { } set || resources.Count == 0) return;
        await FlushSaveAsync();
        var token = await RunAsync(() => Store.RemoveResources(set, resources), busy: true);
        PushUndo(set, token);
        AfterStructureChange(_target?.Id);
    }

    private void PushUndo(TaskSet set, string? token)
    {
        if (token == null) return;
        _undo.Add(new TaskSetUndoEntry(set.Id, token));
        while (_undo.Count(u => u.SetId == set.Id) > MaxUndoEntries) _undo.Remove(_undo.First(u => u.SetId == set.Id));
        _ = RunAsync(() => Store.PurgeTrash(set, MaxUndoEntries));
        StateChanged?.Invoke();
    }

    /// <summary>Restore the latest soft delete of the selected set; false when nothing (or not everything) could be restored.</summary>
    public async Task<bool> UndoAsync()
    {
        if (_set is not { } set || _undo.LastOrDefault(u => u.SetId == set.Id) is not { } entry) return false;
        _undo.Remove(entry);
        await FlushSaveAsync();
        bool restored = await RunAsync(() => Store.Restore(set, entry.Token), busy: true);
        AfterStructureChange(_target?.Id);
        return restored;
    }

    /// <summary>Dry run of a folder-tree import (subfolder = target, scenes/ = scenes, root common/ = common).</summary>
    public async Task<FolderTreePlan?> PlanFolderTreeAsync(string rootDir)
    {
        if (_set is not { } set) return null;
        return await RunAsync(() => Store.PlanFolderTree(set, rootDir), busy: true);
    }

    public async Task<TaskSetImportSummary?> ImportFolderTreeAsync(string rootDir)
    {
        if (_set is not { } set) return null;
        await FlushSaveAsync();
        var result = await RunJobAsync(I18nKeys.YoloTaskSetStatusImporting, (progress, ct) => Store.ImportFolderTree(set, rootDir, dryRun: false, progress, ct));
        AfterStructureChange(_target?.Id);
        return result == null ? null : TaskSetImportSummary.From(result.Files, result.TargetsCreated);
    }

    /// <summary>Copy targets (variants, scenes, overrides) of another task set into the selected one; same names merge.</summary>
    public async Task<TaskSetImportSummary?> CopyTargetsAsync(TaskSet fromSet, IReadOnlyList<TaskTarget> targets)
    {
        if (_set is not { } set || fromSet.Id == set.Id) return null;
        await FlushSaveAsync();
        var ids = targets.Select(t => t.Id).ToList();
        var result = await RunAsync(() => Store.CopyTargets(fromSet, ids, set), busy: true);
        AfterStructureChange(result?.Targets.FirstOrDefault()?.Id ?? _target?.Id);
        return result == null ? null : TaskSetImportSummary.From(result.Files, result.TargetsCreated);
    }

    /// <summary>Task sets other than the selected one (sources for "import targets from another task set").</summary>
    public IReadOnlyList<TaskSet> OtherSets => Sets.Select(r => r.Set).Where(s => s.Id != _set?.Id).ToList();

    // ---------- resource properties ----------

    /// <summary>Capture DPI factor of resources (1 = 100 %).</summary>
    public void SetPixelScale(IReadOnlyList<TaskResource> resources, double scale)
    {
        foreach (var r in resources) r.PixelScale = scale;
        AfterPropertyChange();
    }

    public void SetValOnly(IReadOnlyList<TaskResource> resources, bool valOnly)
    {
        foreach (var r in resources) r.ValOnly = valOnly;
        AfterPropertyChange();
    }

    public void SetRegions(TaskResource resource, IReadOnlyList<PlacementRegion> regions)
    {
        resource.Regions = regions.Count == 0 ? null : regions.ToList();
        AfterPropertyChange();
    }

    /// <summary>Objects already present in a background: positive labels (target name) or masked-out regions.</summary>
    public void SetResourceBoxes(TaskResource resource, IReadOnlyList<ResourceBox> boxes)
    {
        resource.Boxes = boxes.Count == 0 ? null : boxes.ToList();
        AfterPropertyChange();
    }

    private void AfterPropertyChange()
    {
        Issues = null;
        foreach (var row in Variants.Concat(Scenes).Concat(Common).Concat(Distractors)) DescribeResource(row);
        ScheduleSave();
    }

    /// <summary>Resource of the selected set by id or store-relative file.</summary>
    public TaskResource? FindResource(string resourceIdOrFile) =>
        _set == null ? null : _set.CommonResources.Concat(_set.Distractors).Concat(_set.Targets.SelectMany(t => t.Variants.Concat(t.Scenes)))
            .FirstOrDefault(r => r.Id == resourceIdOrFile || r.File == resourceIdOrFile);

    public string ResourcePath(TaskResource resource) => _set == null ? "" : Store.ResourcePath(_set, resource);

    /// <summary>Extractor callback: store cut variants (blocked while a generation runs).</summary>
    /// <summary>Extractor callback for the distractor pool (S10); blocked while a generation runs.</summary>
    public async Task<int> AddDistractorsAsync(IReadOnlyList<ExtractedVariant> variants)
    {
        if (_set is not { } set || _isGenerating) return 0;
        await FlushSaveAsync();
        int added = 0;
        await RunAsync(() =>
        {
            foreach (var v in variants)
            {
                Store.AddDistractorFromPng(set, v.Png, v.OriginalPath, v.NameHint).PixelScale = v.PixelScale;
                added++;
            }
            if (added > 0) Store.Save(set);
        }, busy: true);
        AfterStructureChange(_target?.Id);
        return added;
    }

    public async Task<int> AddExtractedAsync(TaskTarget target, IReadOnlyList<ExtractedVariant> variants)
    {
        if (_set is not { } set || !set.Targets.Contains(target) || _isGenerating) return 0;
        await FlushSaveAsync();
        int added = 0;
        var replaced = new List<TaskResource>();
        var token = await RunAsync(() =>
        {
            foreach (var v in variants)
            {
                var resource = Store.AddVariantFromPng(set, target, v.Png, v.OriginalPath, v.NameHint);
                resource.PixelScale = v.PixelScale;
                added++;
                int index = v.Replaces == null ? -1 : target.Variants.IndexOf(v.Replaces);
                if (index < 0) continue;
                var old = v.Replaces!;
                target.Variants.Remove(resource);
                target.Variants.Insert(index + 1, resource);
                (resource.Label, resource.ValOnly) = (old.Label, old.ValOnly);
                replaced.Add(old);
            }
            return replaced.Count > 0 ? Store.RemoveResources(set, replaced) : null;
        }, busy: true);
        PushUndo(set, token);
        AfterStructureChange(_target?.Id);
        return added;
    }

    // ---------- augmentation and synthesis ----------

    public void CommitGlobalAug(TaskSetAugField field, object value)
    {
        if (_set is not { } set) return;
        var p = set.Augmentation.Clone();
        field.Set(p, value);
        set.Augmentation = p.Normalized();
        ScheduleSave();
    }

    public void SetOverrideInherit(TaskSetAugField field, bool inherit)
    {
        if (_set is not { } set || _target is not { } target) return;
        var o = target.Augmentation ?? new AugmentationOverride();
        field.SetOverride(o, inherit ? null : field.Get(set.Augmentation));
        target.Augmentation = o.IsEmpty ? null : o;
        ScheduleSave();
    }

    public void CommitOverride(TaskSetAugField field, object value)
    {
        if (_set is not { } set || _target is not { } target) return;
        var probe = set.Augmentation.Clone();
        field.Set(probe, value);
        var o = target.Augmentation ?? new AugmentationOverride();
        field.SetOverride(o, field.Get(probe.Normalized()));
        target.Augmentation = o.IsEmpty ? null : o;
        ScheduleSave();
    }

    /// <summary>Returns true when the stored value changed.</summary>
    public bool CommitSynthesis(TaskSetSynField field, object value)
    {
        if (_set is not { } set || Equals(field.Get(set.Synthesis), value)) return false;
        var s = set.Synthesis.Clone();
        field.Set(s, value);
        set.Synthesis = s.Normalized();
        ScheduleSave();
        if (field.AffectsVideoEstimate) RefreshVideoEstimates();
        return true;
    }

    /// <summary>Inference ROI hint of the task set (design section 11); anchor null removes it.</summary>
    public void SetRoiHint(string? anchor, int bandPixels, PixelRect? rect)
    {
        if (_set is not { } set) return;
        set.InferenceRoiHint = anchor == null ? null : new InferenceRoiHint
        {
            Anchor = anchor,
            BandPixels = Math.Max(1, bandPixels),
            Rect = anchor == InferenceRoiHint.AnchorRect ? rect : null,
        };
        ScheduleSave();
    }

    // ---------- holdout sources (real annotated validation images) ----------

    /// <summary>Rows of the holdout sources with their annotated-image count (counted in the background).</summary>
    public void SyncHoldouts()
    {
        Holdouts.Clear();
        if (_set is not { } set) return;
        var dir = Store.GetDir(set.Id);
        foreach (var source in set.HoldoutSources)
        {
            var row = new TaskSetHoldoutRow(source, Path.GetFullPath(Path.Combine(dir, source.ImagesDir)))
            {
                Detail = T(I18nKeys.YoloTaskSetHoldoutCounting),
            };
            Holdouts.Add(row);
            _ = CountHoldoutAsync(row, string.IsNullOrWhiteSpace(source.AnnotationDir) ? row.FullPath : Path.GetFullPath(Path.Combine(dir, source.AnnotationDir)));
        }
    }

    private static async Task CountHoldoutAsync(TaskSetHoldoutRow row, string annotationDir)
    {
        var (images, annotated) = await Task.Run(() =>
        {
            try
            {
                var list = AnnotationIo.ListImages(row.FullPath);
                return (list.Count, list.Count(i => AnnotationIo.Load(i, annotationDir) != null));
            }
            catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
            {
                return (0, 0);
            }
        });
        row.Detail = annotated == 0 ? T(I18nKeys.YoloTaskSetHoldoutEmpty)
            : T(I18nKeys.YoloTaskSetHoldoutCount).Replace("{annotated}", N(annotated)).Replace("{images}", N(images));
    }

    public void AddHoldout(string imagesDir)
    {
        if (_set is not { } set) return;
        var full = Path.GetFullPath(imagesDir);
        if (Holdouts.Any(r => string.Equals(r.FullPath, full, StringComparison.OrdinalIgnoreCase))) return;
        set.HoldoutSources.Add(new HoldoutSource { ImagesDir = full });
        Issues = null;
        ScheduleSave();
        SyncHoldouts();
    }

    public void RemoveHoldouts(IReadOnlyList<TaskSetHoldoutRow> rows)
    {
        if (_set is not { } set || rows.Count == 0) return;
        foreach (var row in rows) set.HoldoutSources.Remove(row.Source);
        Issues = null;
        ScheduleSave();
        SyncHoldouts();
    }

    // ---------- shared recorded segments (frames and annotations used in place) ----------

    /// <summary>Rows of the linked segments with their annotation counts (counted in the background).</summary>
    public void SyncSegments()
    {
        Segments.Clear();
        if (_set is not { } set) return;
        foreach (var source in set.SegmentSources)
        {
            var row = new TaskSetSegmentRow(source, TaskSetStore.ResolveSegmentDir(source), OnSegmentEdited) { Detail = T(I18nKeys.YoloTaskSetSegmentsCounting) };
            Segments.Add(row);
            _ = CountSegmentAsync(row);
        }
    }

    private void OnSegmentEdited()
    {
        Issues = null;
        ScheduleSave();
        foreach (var row in Segments) _ = CountSegmentAsync(row);
    }

    private static async Task CountSegmentAsync(TaskSetSegmentRow row)
    {
        var scan = await Task.Run(() =>
        {
            try
            {
                return TaskSetStore.ScanSegment(row.Source);
            }
            catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
            {
                return null;
            }
        });
        row.Detail = scan == null || scan.Annotated == 0 ? T(I18nKeys.YoloTaskSetSegmentsEmpty)
            : T(I18nKeys.YoloTaskSetSegmentsCount)
                .Replace("{annotated}", N(scan.Annotated))
                .Replace("{images}", N(scan.Images))
                .Replace("{boxes}", N(scan.Boxes))
                .Replace("{labels}", string.Join(", ", scan.Labels.OrderByDescending(kv => kv.Value).Select(kv => kv.Key + " " + N(kv.Value))));
    }

    /// <summary>Links the segments below the folders (a project folder adds all its segments); returns how many were added.</summary>
    public async Task<int> AddSegmentsAsync(IReadOnlyList<string> dirs)
    {
        if (_set is not { } set || dirs.Count == 0) return 0;
        await FlushSaveAsync();
        var added = await RunAsync(() => Store.AddSegmentSources(set, dirs), busy: true);
        Issues = null;
        SyncSegments();
        RefreshSetRows();
        return added?.Count ?? 0;
    }

    public async Task RemoveSegmentsAsync(IReadOnlyList<TaskSetSegmentRow> rows)
    {
        if (_set is not { } set || rows.Count == 0) return;
        await FlushSaveAsync();
        await RunAsync(() =>
        {
            Store.RemoveSegmentSources(set, rows.Select(r => r.Source));
            return true;
        }, busy: true);
        Issues = null;
        SyncSegments();
    }

    /// <summary>Annotated boxes of every linked segment become deduplicated variants of the same-named targets (created when missing).</summary>
    public async Task<(int Segments, int Added, int Duplicates, IReadOnlyList<string> Created)?> ExtractSegmentVariantsAsync(VariantCutout cutout,
        AnnotationVariantOptions options)
    {
        if (_set is not { } set || set.SegmentSources.Count == 0) return null;
        await FlushSaveAsync();
        var results = await RunJobAsync(I18nKeys.YoloTaskSetSegmentsStatusExtracting, (progress, ct) =>
            Store.AddVariantsFromSegments(set, null, cutout, options, progress, ct));
        AfterStructureChange(_target?.Id);
        if (results == null) return null;
        return (results.Count, results.Sum(r => r.Added), results.Sum(r => r.Duplicates), results.SelectMany(r => r.CreatedTargets).Distinct().ToList());
    }

    public void SetPlacement(string placement)
    {
        if (_target == null || !TargetPlacement.All.Contains(placement) || _target.Placement == placement) return;
        _target.Placement = placement;
        Issues = null;
        ScheduleSave();
    }

    // ---------- validate, preview, generate ----------

    /// <summary>Structural checks plus the contamination template match, with progress and cancel.</summary>
    public async Task<IReadOnlyList<TaskSetIssue>?> ValidateAsync()
    {
        if (_set is not { } set) return null;
        await FlushSaveAsync();
        var dir = Store.GetDir(set.Id);
        int version = _editVersion;
        var validation = await RunJobAsync(I18nKeys.YoloTaskSetStatusValidating, job => TaskSetSynthesizer.ValidateDetailed(set, dir, job.Synthesis, job.Token));
        if (validation == null) return null;
        var issues = validation.Issues;
        SetValidation(issues, validation.Hits);
        _validatedVersion = version;
        SetStatus(issues.Any(i => i.IsError) ? ChipDanger : issues.Count > 0 ? ChipWarning : ChipSuccess, () => T(I18nKeys.YoloTaskSetStatusIdle));
        return issues;
    }

    /// <summary>Validated preview of one sample (targetId null = random class); false when validation reports errors.</summary>
    public async Task<bool> PreviewAsync(bool reset, string? targetId = null)
    {
        if (_set is not { } set) return false;
        var issues = _validatedVersion == _editVersion && _issues != null ? _issues : await ValidateAsync();
        if (issues == null) return true;
        if (issues.Any(i => i.IsError)) return false;
        PreviewSeed = reset ? set.Synthesis.Seed : PreviewSeed + 1;
        int seed = PreviewSeed;
        var dir = Store.GetDir(set.Id);
        var rendered = await RunJobAsync(I18nKeys.YoloTaskSetStatusPreparingPreview, job =>
        {
            var r = TaskSetSynthesizer.RenderPreview(set, dir, seed, targetId, job.Synthesis, job.Token);
            return (Result: r, Image: BitmapDecode.FromBytes(r.Png));
        });
        if (rendered.Result == null) return true;
        PreviewImage = rendered.Image;
        Preview = rendered.Result;
        StateChanged?.Invoke();
        return true;
    }

    /// <summary>Grid of augmented variants of a target (U5); global = the task-set profile without the target override. Null when unavailable.</summary>
    public async Task<BitmapSource?> RenderAugmentationGridAsync(TaskTarget target, bool global, int seed)
    {
        if (_set is not { } set || target.Variants.Count == 0) return null;
        var dir = Store.GetDir(set.Id);
        var snapshot = Snapshot(set);
        var id = target.Id;
        if (global && snapshot.Targets.FirstOrDefault(t => t.Id == id) is { } copy) copy.Augmentation = null;
        try
        {
            return await Task.Run(() => BitmapDecode.FromBytes(TaskSetSynthesizer.RenderAugmentationGrid(snapshot, dir, id, AugGridCount, seed)));
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            return null;
        }
    }

    /// <summary>Deep copy for background work, so UI edits and extractor adds cannot race the enumeration.</summary>
    private static TaskSet Snapshot(TaskSet set) => TaskSetStore.Clone(set);

    /// <summary>Validate then generate a dataset on a snapshot; false when blocked by validation errors.</summary>
    public async Task<bool> GenerateAsync()
    {
        if (_set is not { } set) return false;
        var issues = await ValidateAsync();
        if (issues == null) return true;
        if (issues.Any(i => i.IsError)) return false;
        var snapshot = Snapshot(set);
        var dir = Store.GetDir(set.Id);
        var datasetsDir = Path.Combine(dir, TaskSetStore.DatasetsSubdir);
        var outDir = Path.Combine(datasetsDir, YoloTrainingService.UniqueStamp(datasetsDir));
        var cts = BeginJob();
        _isGenerating = true;
        Result = null;
        var progress = new Progress<SynthesisProgress>(p => ReportProgress(p.Done, p.Total, I18nKeys.YoloTaskSetStatusGenerating));
        SetStatus(ChipInfo, () => T(I18nKeys.YoloTaskSetStatusBusy));
        StateChanged?.Invoke();
        var task = Task.Run(() => TaskSetSynthesizer.Generate(snapshot, dir, outDir, progress, cts.Token));
        _generateTask = task;
        try
        {
            Result = await task;
            Progress = 1;
            SetStatus(ChipSuccess, () => T(I18nKeys.YoloTaskSetStatusDone));
        }
        catch (OperationCanceledException)
        {
            SetStatus(ChipWarning, () => T(I18nKeys.YoloTaskSetStatusCancelled));
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            ReportError(ex);
        }
        finally
        {
            _generateTask = null;
            _isGenerating = false;
            EndJob(cts);
        }
        await RefreshHistoryAsync();
        return true;
    }

    // ---------- history ----------

    public async Task RefreshHistoryAsync()
    {
        var dir = _set == null ? null : Store.GetDir(_set.Id);
        var (datasets, runs) = dir == null ? (new List<TaskSetDatasetRow>(), new List<TaskSetRunRow>())
            : await Task.Run(() => (TaskSetHistory.ListDatasets(dir), TaskSetHistory.ListRuns(dir)));
        if (dir != TaskSetDirOrNull()) return;
        Datasets.Clear();
        foreach (var d in datasets)
        {
            DescribeDataset(d);
            Datasets.Add(d);
        }
        Runs.Clear();
        foreach (var r in runs)
        {
            DescribeRun(r);
            Runs.Add(r);
        }
        foreach (var d in datasets) _ = MeasureDatasetAsync(d);
    }

    private string? TaskSetDirOrNull() => _set == null ? null : Store.GetDir(_set.Id);

    private async Task MeasureDatasetAsync(TaskSetDatasetRow row)
    {
        row.SizeBytes = await Task.Run(() => TaskSetHistory.DirectorySize(row.Dir));
        DescribeDataset(row);
    }

    private static void DescribeDataset(TaskSetDatasetRow row) =>
        row.Detail = T(I18nKeys.YoloTaskSetHistoryDatasetDetail)
            .Replace("{train}", N(row.TrainImages))
            .Replace("{val}", N(row.ValImages))
            .Replace("{negative}", N(row.Negatives))
            .Replace("{classes}", N(row.Classes.Count))
            .Replace("{size}", row.SizeBytes < 0 ? T(I18nKeys.YoloTaskSetHistorySizePending) : TaskSetHistory.FormatSize(row.SizeBytes))
            .Replace("{created}", row.Created.ToString("g", CultureInfo.CurrentCulture));

    private static void DescribeRun(TaskSetRunRow row) =>
        row.Detail = T(I18nKeys.YoloTaskSetHistoryRunDetail)
            .Replace("{weights}", T(row.WeightsPath != null ? I18nKeys.YoloTaskSetValueOn : I18nKeys.YoloTaskSetValueOff))
            .Replace("{onnx}", T(row.OnnxPath != null ? I18nKeys.YoloTaskSetValueOn : I18nKeys.YoloTaskSetValueOff))
            .Replace("{modified}", row.Modified.ToString("g", CultureInfo.CurrentCulture));

    /// <summary>Delete a dataset or run dir of the selected set; false while a training (any app instance) uses the set's runs.</summary>
    public async Task<bool> DeleteHistoryDirAsync(string path)
    {
        if (_set is not { } set) return true;
        var root = Store.GetDir(set.Id);
        var full = Path.GetFullPath(path);
        if (!full.StartsWith(Path.GetFullPath(root) + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)) return true;
        if (YoloTrainingService.Instance.IsRunning || YoloRunLock.ReadOwner(Path.Combine(root, TaskSetStore.RunsSubdir)) != null) return false;
        await RunAsync(() => Directory.Delete(full, recursive: true), busy: true);
        if (_result != null && string.Equals(Path.GetFullPath(_result.DatasetDir), full, StringComparison.OrdinalIgnoreCase)) Result = null;
        await RefreshHistoryAsync();
        return true;
    }
}

/// <summary>Reads the generated datasets (synthesis_manifest.json) and training runs of a task set dir.</summary>
public static class TaskSetHistory
{
    private const string DataYamlFileName = "data.yaml";
    private static readonly string[] SizeUnits = { "B", "KB", "MB", "GB", "TB" };

    public static List<TaskSetDatasetRow> ListDatasets(string taskSetDir)
    {
        var root = Path.Combine(taskSetDir, TaskSetStore.DatasetsSubdir);
        var rows = new List<TaskSetDatasetRow>();
        if (!Directory.Exists(root)) return rows;
        foreach (var dir in Directory.EnumerateDirectories(root))
        {
            var info = new DirectoryInfo(dir);
            int train = 0, val = 0, negatives = 0;
            var classes = new List<string>();
            var instances = new Dictionary<string, int>(StringComparer.Ordinal);
            try
            {
                var manifest = Path.Combine(dir, TaskSetSynthesizer.ManifestFileName);
                if (File.Exists(manifest))
                {
                    using var doc = JsonDocument.Parse(File.ReadAllText(manifest));
                    var rootEl = doc.RootElement;
                    if (rootEl.TryGetProperty("classes", out var cls) && cls.ValueKind == JsonValueKind.Array)
                        classes.AddRange(cls.EnumerateArray().Select(c => c.GetString() ?? ""));
                    if (rootEl.TryGetProperty("counts", out var counts) && counts.ValueKind == JsonValueKind.Object)
                        foreach (var split in counts.EnumerateObject())
                        {
                            int images = split.Value.TryGetProperty("images", out var im) && im.TryGetInt32(out var n) ? n : 0;
                            if (split.Name == YoloDataYaml.SplitName(YoloSplit.Val)) val += images;
                            else train += images;
                            if (split.Value.TryGetProperty("negatives", out var ng) && ng.TryGetInt32(out var nn)) negatives += nn;
                            if (split.Value.TryGetProperty("instances", out var inst) && inst.ValueKind == JsonValueKind.Object)
                                foreach (var c in inst.EnumerateObject())
                                    instances[c.Name] = (instances.TryGetValue(c.Name, out var have) ? have : 0) + (c.Value.TryGetInt32(out var k) ? k : 0);
                        }
                }
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException or InvalidOperationException)
            {
            }
            var yaml = Path.Combine(dir, DataYamlFileName);
            var previews = Path.Combine(dir, TaskSetSynthesizer.PreviewsSubdir);
            string? preview = null;
            try
            {
                preview = Directory.Exists(previews) ? Directory.EnumerateFiles(previews).OrderBy(f => f, StringComparer.OrdinalIgnoreCase).FirstOrDefault() : null;
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
            }
            rows.Add(new TaskSetDatasetRow(dir, info.CreationTime)
            {
                TrainImages = train,
                ValImages = val,
                Negatives = negatives,
                Classes = classes,
                Instances = instances,
                DataYamlPath = File.Exists(yaml) ? yaml : null,
                PreviewPath = preview,
            });
        }
        return rows.OrderByDescending(r => r.Name, StringComparer.Ordinal).ToList();
    }

    public static List<TaskSetRunRow> ListRuns(string taskSetDir)
    {
        var root = Path.Combine(taskSetDir, TaskSetStore.RunsSubdir);
        var rows = new List<TaskSetRunRow>();
        if (!Directory.Exists(root)) return rows;
        foreach (var dir in Directory.EnumerateDirectories(root))
        {
            var weights = YoloArtifacts.WeightsPath(dir);
            var onnx = YoloArtifacts.OnnxPathForWeights(weights);
            rows.Add(new TaskSetRunRow(dir, new DirectoryInfo(dir).LastWriteTime)
            {
                WeightsPath = File.Exists(weights) ? weights : null,
                OnnxPath = File.Exists(onnx) ? onnx : null,
            });
        }
        return rows.OrderByDescending(r => r.Modified).ToList();
    }

    public static long DirectorySize(string dir)
    {
        try
        {
            return new DirectoryInfo(dir).EnumerateFiles("*", SearchOption.AllDirectories).Sum(f => f.Length);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return 0;
        }
    }

    public static string FormatSize(long bytes)
    {
        double value = bytes;
        int unit = 0;
        while (value >= 1024 && unit < SizeUnits.Length - 1)
        {
            value /= 1024;
            unit++;
        }
        return value.ToString(unit == 0 ? "0" : "0.#", CultureInfo.InvariantCulture) + " " + SizeUnits[unit];
    }
}
