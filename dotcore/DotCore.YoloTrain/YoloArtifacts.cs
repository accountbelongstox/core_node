namespace DotCore.YoloTrain;

/// <summary>Training outputs: Ultralytics writes {project}/{name}/weights/best.pt; ONNX export writes best.onnx beside it.</summary>
public static class YoloArtifacts
{
    public const string TrainedWeightsFileName = "best.pt";
    public const string LastWeightsFileName = "last.pt";
    public const string ExportedOnnxFileName = "best.onnx";
    public const string WeightsSubdir = "weights";

    public static string WeightsPath(string runDir) => Path.Combine(runDir, WeightsSubdir, TrainedWeightsFileName);

    public static string OnnxPathForWeights(string weightsPath) => Path.ChangeExtension(weightsPath, ".onnx");

    /// <summary>Newest file with this name anywhere under root, or null.</summary>
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
