// PY-REF: none (DOT-only)
using System.Windows;
using System.Windows.Media;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>Task set list row of the task-set manager.</summary>
public sealed class TaskSetRow : BaseViewModel
{
    private string _name = "";
    private string _detail = "";

    public TaskSetRow(TaskSet set) => Set = set;

    public TaskSet Set { get; }

    public string Name { get => _name; set => SetProperty(ref _name, value); }

    public string Detail { get => _detail; set => SetProperty(ref _detail, value); }
}

/// <summary>Target list row (list position = YOLO class id).</summary>
public sealed class TaskTargetRow : BaseViewModel
{
    private string _title = "";
    private string _detail = "";

    public TaskTargetRow(TaskTarget target) => Target = target;

    public TaskTarget Target { get; }

    public string Title { get => _title; set => SetProperty(ref _title, value); }

    public string Detail { get => _detail; set => SetProperty(ref _detail, value); }
}

/// <summary>
/// Thumbnail row of a variant, scene, common or distractor resource; Label edits write through to the resource. The thumbnail
/// is decoded lazily on the first binding read, so only rows realized by the virtualizing panel decode anything.
/// </summary>
public sealed class TaskResourceRow : BaseViewModel
{
    public const string GlyphImage = "\uE8B9";
    public const string GlyphVideo = "\uE714";

    private readonly Action? _labelChanged;
    private ImageSource? _thumbnail;
    private bool _thumbnailRequested;
    private string _info = "";

    public TaskResourceRow(TaskResource resource, string path, Action? labelChanged)
    {
        Resource = resource;
        Path = path;
        Glyph = resource.Kind == TaskResourceKind.Video ? GlyphVideo : GlyphImage;
        _labelChanged = labelChanged;
    }

    public TaskResource Resource { get; }

    public string Path { get; }

    public string Glyph { get; }

    public string FileName => System.IO.Path.GetFileName(Resource.File);

    public string OriginalPath => Resource.OriginalPath;

    public bool IsVideo => Resource.Kind == TaskResourceKind.Video;

    public Visibility LabelVisibility => _labelChanged == null ? Visibility.Collapsed : Visibility.Visible;

    /// <summary>Estimated extracted frames for videos; null while unknown.</summary>
    public int? Frames { get; set; }

    public bool FramesFailed { get; set; }

    public string Label
    {
        get => Resource.Label;
        set
        {
            var v = (value ?? "").Trim();
            if (v == Resource.Label) return;
            Resource.Label = v;
            RaisePropertyChanged();
            _labelChanged?.Invoke();
        }
    }

    public ImageSource? Thumbnail
    {
        get
        {
            if (!_thumbnailRequested)
            {
                _thumbnailRequested = true;
                _ = LoadThumbnailAsync();
            }
            return _thumbnail;
        }
    }

    public Visibility GlyphVisibility => _thumbnail == null ? Visibility.Visible : Visibility.Collapsed;

    public string Info { get => _info; set => SetProperty(ref _info, value); }

    private async Task LoadThumbnailAsync()
    {
        _thumbnail = await TaskSetThumbnailCache.Shared.GetAsync(Path, IsVideo);
        RaisePropertyChanged(nameof(Thumbnail));
        RaisePropertyChanged(nameof(GlyphVisibility));
    }
}

/// <summary>Folder of real annotated screenshots (JSON / VOC) written as the held-out split.</summary>
public sealed class TaskSetHoldoutRow : BaseViewModel
{
    private string _detail = "";

    public TaskSetHoldoutRow(HoldoutSource source, string fullPath) => (Source, FullPath) = (source, fullPath);

    public HoldoutSource Source { get; }

    public string FullPath { get; }

    public string Detail { get => _detail; set => SetProperty(ref _detail, value); }
}

/// <summary>Generated dataset under {set}/_datasets (History tab).</summary>
public sealed class TaskSetDatasetRow : BaseViewModel
{
    private string _detail = "";

    public TaskSetDatasetRow(string dir, DateTime created) => (Dir, Created) = (dir, created);

    public string Dir { get; }

    public string Name => System.IO.Path.GetFileName(Dir);

    public DateTime Created { get; }

    public int TrainImages { get; init; }

    public int ValImages { get; init; }

    public int Negatives { get; init; }

    public IReadOnlyList<string> Classes { get; init; } = Array.Empty<string>();

    public IReadOnlyDictionary<string, int> Instances { get; init; } = new Dictionary<string, int>();

    public string? DataYamlPath { get; init; }

    public string? PreviewPath { get; init; }

    public long SizeBytes { get; set; } = -1;

    public string Detail { get => _detail; set => SetProperty(ref _detail, value); }
}

/// <summary>Training run under {set}/_runs (History tab).</summary>
public sealed class TaskSetRunRow : BaseViewModel
{
    private string _detail = "";

    public TaskSetRunRow(string dir, DateTime modified) => (Dir, Modified) = (dir, modified);

    public string Dir { get; }

    public string Name => System.IO.Path.GetFileName(Dir);

    public DateTime Modified { get; }

    public string? WeightsPath { get; init; }

    public string? OnnxPath { get; init; }

    public string Detail { get => _detail; set => SetProperty(ref _detail, value); }
}

/// <summary>
/// Validation row; the view picks the Danger/Warning brush from IsError via DynamicResource so it follows theme switches.
/// Hit is set for BackgroundContainsTarget rows (Show / Auto-label / Mask actions).
/// </summary>
public sealed record TaskSetIssueRow(TaskSetIssue Issue, string Glyph, string Text, ContaminationHit? Hit = null)
{
    public bool IsError => Issue.IsError;

    public Visibility ActionsVisibility => Hit == null ? Visibility.Collapsed : Visibility.Visible;
}
