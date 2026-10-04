// PY-REF: pycore/pyutils/common/ultralytics_comm/yaml_io.py
using DotCore.VocAnnotator;

namespace DotCore.YoloTrain;

/// <summary>Ultralytics dataset config (data.yaml): path, train, val, optional test, nc, names. 1:1 pycore ultralytics_comm write_data_yaml.</summary>
public static class YoloDataYaml
{
    public const string FileName = "data.yaml";

    public static string SplitImagesDir(YoloSplit split) => YoloDataLayout.ImagesSubdir + "/" + SplitName(split);

    public static string SplitLabelsDir(YoloSplit split) => YoloDataLayout.LabelsSubdir + "/" + SplitName(split);

    public static string SplitName(YoloSplit split) => split.ToString().ToLowerInvariant();

    public static string Write(string datasetDir, IReadOnlyList<string> classes, bool includeTest)
    {
        var lines = new List<string>
        {
            "path: " + Path.GetFullPath(datasetDir).Replace('\\', '/'),
            "train: " + SplitImagesDir(YoloSplit.Train),
            "val: " + SplitImagesDir(YoloSplit.Val),
        };
        if (includeTest) lines.Add("test: " + SplitImagesDir(YoloSplit.Test));
        lines.Add("nc: " + classes.Count);
        lines.Add("names:");
        lines.AddRange(classes.Select((name, i) => $"  {i}: {YamlScalar(name)}"));
        Directory.CreateDirectory(datasetDir);
        var path = Path.Combine(datasetDir, FileName);
        File.WriteAllText(path, string.Join("\n", lines) + "\n");
        return path;
    }

    /// <summary>Single-quoted YAML scalar ('' escapes '). 1:1 pycore _yaml_scalar.</summary>
    public static string YamlScalar(string? value) => "'" + (value ?? "").Replace("'", "''") + "'";
}
