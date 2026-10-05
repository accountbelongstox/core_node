using System.IO;
using DotCore.VocAnnotator;
using DotCore.YoloDetect;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotCore.VocAnnotatorUI;

/// <summary>Model chosen for auto-label: ModelPath when usable, else MessageKey (ui.voc_annotator.*) explains why; {path} / {classes} fill it.</summary>
public sealed record AutoLabelModelChoice(string? ModelPath, string? MessageKey, string Path = "", string Classes = "")
{
    public bool IsOk => ModelPath != null;
}

/// <summary>Model-assisted labeling: runs an Ultralytics ONNX model through the shared YoloModelHost session and merges the detections.</summary>
public sealed class AutoLabelService : IDisposable
{
    private const double MergeOverlapIou = 0.5;
    private readonly object _lock = new();
    private YoloModelLease? _lease;

    /// <summary>
    /// The configured model path, else the model registry's current "auto_label" model; never the newest file on disk.
    /// A registry model must know at least one project class unless unknown model classes may be added to the project
    /// (models whose class names cannot be read are accepted; detections are mapped per class afterwards).
    /// </summary>
    public static AutoLabelModelChoice ResolveModel(string? configured, IReadOnlyCollection<string> projectClasses, bool addClasses,
        YoloModelRegistry? registry = null)
    {
        if (!string.IsNullOrWhiteSpace(configured))
        {
            var full = Path.GetFullPath(configured);
            return File.Exists(full) ? new AutoLabelModelChoice(full, null) : new AutoLabelModelChoice(null, AnnotatorI18nKeys.AutoLabelModelMissing, full);
        }
        var resolution = (registry ?? YoloModelRegistry.Default).Resolve(YoloModelRegistry.ConsumerAutoLabel);
        switch (resolution.Status)
        {
            case YoloModelResolveStatus.NotSet:
                return new AutoLabelModelChoice(null, AnnotatorI18nKeys.AutoLabelNoModel);
            case YoloModelResolveStatus.FileMissing:
                return new AutoLabelModelChoice(null, AnnotatorI18nKeys.AutoLabelModelMissing, resolution.ModelPath ?? "");
        }
        var modelPath = Path.GetFullPath(resolution.ModelPath!);
        var modelClasses = resolution.Classes;
        bool shares = modelClasses.Count == 0 || modelClasses.Any(c => projectClasses.Contains(c, StringComparer.Ordinal));
        return shares || addClasses
            ? new AutoLabelModelChoice(modelPath, null)
            : new AutoLabelModelChoice(null, AnnotatorI18nKeys.AutoLabelModelClasses, modelPath, string.Join(", ", modelClasses));
    }

    /// <summary>Localized reason of a failed choice.</summary>
    public static string Describe(AutoLabelModelChoice choice) =>
        choice.MessageKey == null ? "" : AnnotatorI18n.T(choice.MessageKey).Replace("{path}", choice.Path).Replace("{classes}", choice.Classes);

    /// <summary>Annotation source of pseudo-labels from this model: run folder name (…/{run}/weights/best.onnx) or the file name.</summary>
    public static string SourceOf(string modelPath, double confidenceThreshold)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(modelPath));
        var run = dir != null && string.Equals(Path.GetFileName(dir), YoloArtifacts.WeightsSubdir, StringComparison.OrdinalIgnoreCase)
            ? Path.GetFileName(Path.GetDirectoryName(dir)) ?? Path.GetFileName(modelPath)
            : Path.GetFileName(modelPath);
        return AnnotationSources.Model(run, confidenceThreshold);
    }

    /// <summary>Detections in image pixels (serialized so the lease is never swapped mid-inference; kept until the path changes or the model file is replaced).</summary>
    public IReadOnlyList<AnnotationBox> Detect(string modelPath, string imagePath, double confidence, double iou)
    {
        using var mat = Cv2.ImDecode(File.ReadAllBytes(imagePath), ImreadModes.Color);
        if (mat.Empty()) return Array.Empty<AnnotationBox>();
        lock (_lock)
        {
            if (_lease == null || _lease.IsStale || !string.Equals(_lease.ModelPath, Path.GetFullPath(modelPath), StringComparison.OrdinalIgnoreCase))
            {
                _lease?.Dispose();
                _lease = null;
                _lease = YoloModelHost.Shared.Acquire(modelPath);
            }
            return _lease.Detector.Detect(mat, (float)confidence, (float)iou)
                .Select(d => new AnnotationBox(d.ClassName, d.Box.X, d.Box.Y, d.Box.X + d.Box.Width, d.Box.Y + d.Box.Height, Confidence: d.Confidence))
                .ToList();
        }
    }

    /// <summary>Combine existing boxes with detections per AnnotatorSettings.AutoLabelMode.</summary>
    public static List<AnnotationBox> Merge(IReadOnlyList<AnnotationBox> existing, IReadOnlyList<AnnotationBox> detected, string mode) => mode switch
    {
        AnnotatorSettings.AutoLabelReplace => detected.ToList(),
        AnnotatorSettings.AutoLabelEmptyOnly => existing.Count == 0 ? detected.ToList() : existing.ToList(),
        _ => existing.Concat(detected.Where(d => !existing.Any(e => e.Label == d.Label && e.IoU(d) >= MergeOverlapIou))).ToList(),
    };

    public void Dispose()
    {
        lock (_lock)
        {
            _lease?.Dispose();
            _lease = null;
        }
    }
}
