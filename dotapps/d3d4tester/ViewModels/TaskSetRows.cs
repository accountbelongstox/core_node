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

/// <summary>Thumbnail row of a variant, scene or common resource; Label edits write through to the resource.</summary>
public sealed class TaskResourceRow : BaseViewModel
{
    private readonly Action? _labelChanged;
    private ImageSource? _thumbnail;
    private string _info = "";

    public TaskResourceRow(TaskResource resource, string path, string glyph, Action? labelChanged)
    {
        Resource = resource;
        Path = path;
        Glyph = glyph;
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

    public ImageSource? Thumbnail { get => _thumbnail; set => SetProperty(ref _thumbnail, value); }

    public string Info { get => _info; set => SetProperty(ref _info, value); }
}

public sealed record TaskSetIssueRow(string Glyph, string Text, Brush Brush);
