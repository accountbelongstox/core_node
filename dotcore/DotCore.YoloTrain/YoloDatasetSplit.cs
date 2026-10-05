namespace DotCore.YoloTrain;

/// <summary>
/// How annotated images become a YOLO dataset. Percentages must sum to 100 with train and val above 0.
/// Background = an image whose annotation file exists but has no usable box (reviewed, no objects); images without an
/// annotation file are never used, so unreviewed frames cannot become false negatives.
/// </summary>
public sealed record YoloDatasetSplit
{
    public const int PercentTotal = 100;

    public int TrainPercent { get; init; } = 80;
    public int ValPercent { get; init; } = 20;
    public int TestPercent { get; init; }
    public int Seed { get; init; } = 42;
    public bool Shuffle { get; init; } = true;

    /// <summary>Split each class group (keyed by the rarest class in the image) separately so every class reaches val.</summary>
    public bool Stratify { get; init; } = true;

    /// <summary>
    /// Assign whole sources (recorded segments: consecutive near-duplicate frames) to splits so val does not leak train frames.
    /// Applies with at least 2 sources; sources holding a class no other source has are split per image.
    /// </summary>
    public bool GroupBySource { get; init; } = true;

    /// <summary>
    /// Also train on model pseudo-labels nobody has reviewed (ImageAnnotation.Reviewed false). They only ever go to train, never to
    /// val or test (the model would grade its own predictions); unreviewed images without boxes are never used (likely misses).
    /// </summary>
    public bool IncludeUnreviewedPseudoLabels { get; init; }

    public bool IncludeBackground { get; init; } = true;

    /// <summary>Upper bound of background images as a share of the whole dataset.</summary>
    public int BackgroundMaxPercent { get; init; } = 10;

    /// <summary>Leave difficult boxes out of the label files (Ultralytics has no difficult flag).</summary>
    public bool SkipDifficult { get; init; } = true;

    public bool IsValid =>
        TrainPercent > 0 && ValPercent > 0 && TestPercent >= 0 && TrainPercent + ValPercent + TestPercent == PercentTotal
        && BackgroundMaxPercent is >= 0 and < PercentTotal;
}

public enum YoloSplit
{
    Train,
    Val,
    Test,
}

/// <summary>One annotated image folder feeding the dataset (e.g. a recorded segment's frames).</summary>
public sealed record YoloDatasetSource(string Name, string ImagesDir, string AnnotationDir);

/// <summary>Planned dataset image: source image, filtered annotation (known classes only), target split.</summary>
public sealed record YoloDatasetEntry(string ImagePath, VocAnnotator.ImageAnnotation Annotation, string SourceName, YoloSplit Split, bool IsBackground)
{
    public bool IsPseudoLabel => !Annotation.Reviewed;
}

/// <summary>Images, background images and box instances per class of one split.</summary>
public sealed record YoloSplitSummary(int Images, int Background, IReadOnlyDictionary<string, int> Instances);
