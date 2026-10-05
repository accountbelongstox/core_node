// PY-REF: none (DOT-only)
using System.Windows.Media;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.VocAnnotatorUI;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.Windows;

/// <summary>
/// Variant cut from a source image or video frame, ready for TaskSetStore.AddVariantFromPng; Replaces is the stored variant being re-cut,
/// PixelScale the source resource's DPI factor (TaskResource.PixelScale) to set on the new variant.
/// </summary>
public sealed record ExtractedVariant(byte[] Png, string OriginalPath, string NameHint, TaskResource? Replaces = null, double PixelScale = 1.0);

/// <summary>Pending crop of the extractor: region of one source frame with its own cutout mode and brush strokes.</summary>
public sealed class ExtractCrop : BaseViewModel
{
    private static readonly IReadOnlyList<CanvasStroke> NoStrokes = Array.Empty<CanvasStroke>();

    private ImageSource? _thumbnail;
    private string _caption = "";
    private string _info = "";
    private string _filmText = "";
    private bool _isChecked = true;

    public ExtractCrop(string sourcePath, bool isVideo, int frame, VariantRegion region, VariantCutout mode, int tolerance)
    {
        SourcePath = sourcePath;
        IsVideo = isVideo;
        Frame = frame;
        Region = region;
        Mode = mode;
        Tolerance = tolerance;
    }

    public string SourcePath { get; }

    public bool IsVideo { get; }

    public int Frame { get; }

    public VariantRegion Region { get; set; }

    public VariantCutout Mode { get; set; }

    public int Tolerance { get; set; }

    /// <summary>ColorKey also keys background visible through enclosed holes.</summary>
    public bool Holes { get; set; } = true;

    /// <summary>DPI factor of the source resource (1 for external files).</summary>
    public double PixelScale { get; init; } = 1.0;

    /// <summary>Brush strokes in source pixels, replaced as a whole on every edit (snapshots stay valid for undo).</summary>
    public IReadOnlyList<CanvasStroke> Strokes { get; set; } = NoStrokes;

    /// <summary>Tracking similarity to the start crop; null for drawn boxes.</summary>
    public double? Confidence { get; init; }

    /// <summary>Stored variant this crop re-cuts ("Edit variant").</summary>
    public TaskResource? Replaces { get; set; }

    /// <summary>Last cut result (BGRA PNG); null while cutting or when the cut failed.</summary>
    public byte[]? Png { get; set; }

    /// <summary>dHash of the last cut; null while cutting.</summary>
    public ulong? Hash { get; set; }

    public bool Failed { get; set; }

    /// <summary>Incremented per cut request so stale background results are dropped.</summary>
    public int Version { get; set; }

    public bool IsChecked { get => _isChecked; set => SetProperty(ref _isChecked, value); }

    public ImageSource? Thumbnail { get => _thumbnail; set => SetProperty(ref _thumbnail, value); }

    public string Caption { get => _caption; set => SetProperty(ref _caption, value); }

    public string Info { get => _info; set => SetProperty(ref _info, value); }

    /// <summary>Short filmstrip caption (frame tag and confidence).</summary>
    public string FilmText { get => _filmText; set => SetProperty(ref _filmText, value); }

    public CropState Snapshot() => new(this, Region, Mode, Tolerance, Holes, Strokes, IsChecked);
}

/// <summary>Undo snapshot of one pending crop.</summary>
public sealed record CropState(ExtractCrop Crop, VariantRegion Region, VariantCutout Mode, int Tolerance, bool Holes, IReadOnlyList<CanvasStroke> Strokes, bool IsChecked)
{
    /// <summary>True when restoring this state changes the cut result.</summary>
    public bool NeedsRecut => Crop.Region != Region || Crop.Mode != Mode || Crop.Tolerance != Tolerance || Crop.Holes != Holes || !ReferenceEquals(Crop.Strokes, Strokes);

    public void Restore()
    {
        Crop.Region = Region;
        Crop.Mode = Mode;
        Crop.Tolerance = Tolerance;
        Crop.Holes = Holes;
        Crop.Strokes = Strokes;
        Crop.IsChecked = IsChecked;
    }
}
