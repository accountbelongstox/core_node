using DotCore.VocAnnotator;
using DotCore.YoloDetect;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotCore.VocAnnotatorUI;

/// <summary>Model-assisted labeling: runs an Ultralytics ONNX model (YoloOnnxDetector) on an image and merges the detections.</summary>
public sealed class AutoLabelService : IDisposable
{
    private const double MergeOverlapIou = 0.5;
    private readonly object _lock = new();
    private YoloOnnxDetector? _detector;

    /// <summary>Configured model when it exists, else the newest best.onnx under the project folder.</summary>
    public static string? ResolveModel(string? configured, string? projectDir)
    {
        if (!string.IsNullOrWhiteSpace(configured) && File.Exists(configured)) return Path.GetFullPath(configured);
        return YoloArtifacts.FindLatestFile(projectDir, YoloArtifacts.ExportedOnnxFileName);
    }

    /// <summary>Detections in image pixels (thread-safe; the model is cached until the path changes).</summary>
    public IReadOnlyList<AnnotationBox> Detect(string modelPath, string imagePath, double confidence, double iou)
    {
        using var mat = Cv2.ImDecode(File.ReadAllBytes(imagePath), ImreadModes.Color);
        if (mat.Empty()) return Array.Empty<AnnotationBox>();
        YoloOnnxDetector detector;
        lock (_lock)
        {
            if (_detector == null || !string.Equals(_detector.ModelPath, modelPath, StringComparison.OrdinalIgnoreCase))
            {
                _detector?.Dispose();
                _detector = new YoloOnnxDetector(modelPath);
            }
            detector = _detector;
        }
        return detector.Detect(mat, (float)confidence, (float)iou)
            .Select(d => new AnnotationBox(d.ClassName, d.Box.X, d.Box.Y, d.Box.X + d.Box.Width, d.Box.Y + d.Box.Height))
            .ToList();
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
            _detector?.Dispose();
            _detector = null;
        }
    }
}
