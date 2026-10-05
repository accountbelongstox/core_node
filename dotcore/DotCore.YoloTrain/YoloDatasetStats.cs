// PY-REF: none (DOT-only)
namespace DotCore.YoloTrain;

/// <summary>Dataset facts the training advisor uses: a planned dataset (YoloDatasetPlan) or a synthesis estimate (task set).</summary>
public interface IYoloDatasetStats
{
    int LabeledImages { get; }

    /// <summary>All images (labeled + background) of every split.</summary>
    int TotalImages { get; }

    int ValImages { get; }

    int MaxWidth { get; }

    int MaxHeight { get; }

    IReadOnlyDictionary<string, int> ClassInstances { get; }

    IReadOnlyDictionary<string, int> UnknownLabels { get; }

    /// <summary>Imgsz the data requires (native-scale synthesis window: tiles are detected unscaled), 0 = free choice.</summary>
    int RequiredImgsz => 0;
}

/// <summary>Plain IYoloDatasetStats value (estimates, existing datasets).</summary>
public sealed record YoloDatasetStats(
    int LabeledImages,
    int TotalImages,
    int ValImages,
    int MaxWidth,
    int MaxHeight,
    IReadOnlyDictionary<string, int> ClassInstances,
    IReadOnlyDictionary<string, int> UnknownLabels) : IYoloDatasetStats
{
    public int RequiredImgsz { get; init; }
}
