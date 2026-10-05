namespace DotCore.YoloTrain;

/// <summary>Training outputs: Ultralytics writes {project}/{name}/weights/best.pt; ONNX export writes best.onnx beside it.</summary>
public static class YoloArtifacts
{
    public const string TrainedWeightsFileName = "best.pt";
    public const string LastWeightsFileName = "last.pt";
    public const string ExportedOnnxFileName = "best.onnx";
    public const string WeightsSubdir = "weights";
    public const string SharedWeightsSubdir = "_weights";

    /// <summary>{root}/_weights: stock checkpoints (yolov8n.pt, AMP-check weights) shared by every project and task set.</summary>
    public static string SharedWeightsDir(string root) => Path.Combine(root, SharedWeightsSubdir);

    public static string LastWeightsPath(string runDir) => Path.Combine(runDir, WeightsSubdir, LastWeightsFileName);

    public static string OnnxPath(string runDir) => Path.Combine(runDir, WeightsSubdir, ExportedOnnxFileName);

    /// <summary>Run dir of a weights or ONNX file inside {run}/weights, else null.</summary>
    public static string? RunDirOfModel(string modelPath)
    {
        var dir = Path.GetDirectoryName(Path.GetFullPath(modelPath));
        return dir != null && string.Equals(Path.GetFileName(dir), WeightsSubdir, StringComparison.OrdinalIgnoreCase) ? Path.GetDirectoryName(dir) : null;
    }

    public static string WeightsPath(string runDir) => Path.Combine(runDir, WeightsSubdir, TrainedWeightsFileName);

    public static string OnnxPathForWeights(string weightsPath) => Path.ChangeExtension(weightsPath, ".onnx");

    /// <summary>Newest file with this name anywhere under root, or null (project-scoped auto-label only; navigation uses YoloModelRegistry).</summary>
    public static string? FindLatestFile(string? root, string fileName)
    {
        if (string.IsNullOrWhiteSpace(root) || !Directory.Exists(root)) return null;
        try
        {
            return new DirectoryInfo(root).EnumerateFiles(fileName, SearchOption.AllDirectories)
                .OrderByDescending(f => f.LastWriteTimeUtc)
                .FirstOrDefault()?.FullName;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }
}
