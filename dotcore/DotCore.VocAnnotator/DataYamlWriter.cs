namespace DotCore.VocAnnotator;

/// <summary>
/// Writes Ultralytics dataset config (data.yaml): path, train, val, nc, names.
/// Logic 1:1 with pycore ultralytics_comm.write_data_yaml / yolo_data_layout.write_data_yaml.
/// </summary>
public static class DataYamlWriter
{
    public const string DataYamlFileName = "data.yaml";
    public const string ImagesSubdir = "images";
    public const string LabelsSubdir = "labels";

    /// <summary>Write data.yaml into segmentDir. trainSubdir/valSubdir are relative to path (e.g. "images"). If valSubdir is null, uses trainSubdir (same split). Returns path to written file.</summary>
    public static string WriteDataYaml(string segmentDir, IReadOnlyList<string> classes, string? trainSubdir = null, string? valSubdir = null)
    {
        trainSubdir ??= ImagesSubdir;
        valSubdir ??= trainSubdir;
        var pathAbs = Path.GetFullPath(segmentDir);
        var pathNorm = pathAbs.Replace('\\', '/');
        var nc = classes?.Count ?? 0;
        var sb = new System.Text.StringBuilder();
        sb.Append("# YOLO dataset config (Ultralytics).\n");
        sb.Append("path: ").Append(pathNorm).Append('\n');
        sb.Append("train: ").Append(trainSubdir).Append('\n');
        sb.Append("val: ").Append(valSubdir).Append('\n');
        sb.Append("nc: ").Append(nc).Append('\n');
        sb.Append("names:\n");
        for (var i = 0; i < nc; i++)
            sb.Append("  ").Append(i).Append(": ").Append(classes![i] ?? "").Append('\n');
        var yamlPath = Path.Combine(segmentDir, DataYamlFileName);
        Directory.CreateDirectory(segmentDir);
        File.WriteAllText(yamlPath, sb.ToString());
        return yamlPath;
    }
}
