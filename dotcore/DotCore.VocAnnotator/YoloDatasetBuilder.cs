using System.Globalization;
using System.Text.RegularExpressions;

namespace DotCore.VocAnnotator;

/// <summary>
/// YOLO dataset generation from annotated images (images/{train,val}, labels/{train,val}, data.yaml) and Ultralytics train command.
/// 1:1 Python pyapps/d3-check/d3utils/yolo_dataset_from_annotations.py and pycore/pyutils/ultralytics/dataset.py.
/// The image source is a save callback (PNG writer) instead of a PIL image; shuffle uses System.Random(seed), so split order differs from Python random.
/// </summary>
public static class YoloDatasetBuilder
{
    public const string DefaultTrainModel = "yolov8n.pt";
    public const int DefaultTrainEpochs = 50;
    public const int DefaultTrainImgsz = 640;
    public const int DefaultTrainBatch = 16;
    public const string DefaultTrainDevice = "cpu";
    public const double DefaultTrainRatio = 0.8;
    public const int DefaultSeed = 42;
    public const string DefaultClientType = "d3_game";
    public const string DatasetFolderPrefix = "yolo_dataset_";
    public const string SplitTrain = "train";
    public const string SplitVal = "val";
    public const string ShapeCircle = "circle";

    private static readonly Regex ShellSafe = new(@"^[\w@%+=:,./-]+$", RegexOptions.Compiled);

    /// <summary>One annotation: rect uses X/Y (top-left) + Width/Height; circle uses X/Y (center) + Radius.</summary>
    public sealed record Annotation(int ClassId, string Type, double X, double Y, double Width = 0, double Height = 0, double Radius = 0);

    /// <summary>One dataset entry: image size, PNG save callback (target path), annotations.</summary>
    public sealed record Entry(int Width, int Height, Action<string> SaveImagePng, IReadOnlyList<Annotation> Annotations);

    public sealed record Result(string? Error, string DatasetDir, string DataYamlPath, int TrainCount, int ValCount, string TrainCommand);

    /// <summary>Write images and normalized labels with a train/val split. 1:1 generate_yolo_dataset.</summary>
    public static Result GenerateYoloDataset(IReadOnlyList<Entry> entries, IReadOnlyList<string> classNames, string outputDir, double trainRatio = DefaultTrainRatio, int seed = DefaultSeed)
    {
        if (entries == null || entries.Count == 0)
            return new Result("No dataset entries", outputDir, "", 0, 0, "");
        if (classNames == null || classNames.Count == 0)
            return new Result("No class names", outputDir, "", 0, 0, "");
        var ratio = Math.Min(Math.Max(trainRatio, 0.0), 1.0);
        var indexes = Enumerable.Range(0, entries.Count).ToArray();
        var rng = new Random(seed);
        for (var i = indexes.Length - 1; i > 0; i--)
        {
            var j = rng.Next(i + 1);
            (indexes[i], indexes[j]) = (indexes[j], indexes[i]);
        }
        var trainCount = Math.Min(Math.Max((int)Math.Round(entries.Count * ratio, MidpointRounding.ToEven), 1), entries.Count);
        var trainIndexes = new HashSet<int>(indexes.Take(trainCount));

        foreach (var split in new[] { SplitTrain, SplitVal })
        {
            Directory.CreateDirectory(Path.Combine(outputDir, DataYamlWriter.ImagesSubdir, split));
            Directory.CreateDirectory(Path.Combine(outputDir, DataYamlWriter.LabelsSubdir, split));
        }

        int savedTrain = 0, savedVal = 0;
        for (var index = 0; index < entries.Count; index++)
        {
            var item = entries[index];
            if (item == null || item.SaveImagePng == null) continue;
            var split = trainIndexes.Contains(index) ? SplitTrain : SplitVal;
            var stem = $"image_{index:D6}";
            item.SaveImagePng(Path.Combine(outputDir, DataYamlWriter.ImagesSubdir, split, stem + ".png"));
            var lines = BuildLabelLines(item.Width, item.Height, item.Annotations ?? Array.Empty<Annotation>(), classNames.Count);
            File.WriteAllText(Path.Combine(outputDir, DataYamlWriter.LabelsSubdir, split, stem + ".txt"), string.Join("\n", lines));
            if (split == SplitTrain) savedTrain++;
            else savedVal++;
        }

        var yamlPath = Path.Combine(outputDir, DataYamlWriter.DataYamlFileName);
        var yaml = new List<string>
        {
            "path: " + outputDir.Replace('\\', '/'),
            $"train: {DataYamlWriter.ImagesSubdir}/{SplitTrain}",
            $"val: {DataYamlWriter.ImagesSubdir}/{SplitVal}",
            "nc: " + classNames.Count,
            "names:",
        };
        yaml.AddRange(classNames.Select((name, i) => $"  {i}: {DataYamlWriter.YamlScalar(name)}"));
        File.WriteAllText(yamlPath, string.Join("\n", yaml) + "\n");
        return new Result(null, outputDir, yamlPath, savedTrain, savedVal, "");
    }

    /// <summary>Build dataset under Root/_generated/{clientType}/yolo_dataset_yyyyMMdd_HHmmss (or outputDir) and attach the train command. 1:1 generate_dataset_from_screenshot_history.</summary>
    public static Result GenerateDatasetFromScreenshotHistory(IReadOnlyList<Entry> screenshotHistory, IReadOnlyList<string> classNames, double trainRatio = DefaultTrainRatio, string? outputDir = null, string clientType = DefaultClientType)
    {
        if (classNames == null || classNames.Count == 0)
        {
            DotCore.Foundations.ColorPrinter.Red("[YOLO_DATASET] No class names");
            return new Result("No class names", "", "", 0, 0, "");
        }
        if (screenshotHistory == null || screenshotHistory.Count == 0)
        {
            DotCore.Foundations.ColorPrinter.Red("[YOLO_DATASET] No screenshots");
            return new Result("No screenshots", "", "", 0, 0, "");
        }
        var datasetDir = !string.IsNullOrWhiteSpace(outputDir)
            ? outputDir
            : YoloDataLayout.GetGeneratedDatasetPath(string.IsNullOrWhiteSpace(clientType) ? DefaultClientType : clientType,
                DatasetFolderPrefix + DateTime.Now.ToString("yyyyMMdd_HHmmss", CultureInfo.InvariantCulture));
        Directory.CreateDirectory(datasetDir);
        var result = GenerateYoloDataset(screenshotHistory, classNames, datasetDir, trainRatio);
        if (result.Error != null)
            return result with { TrainCommand = "", DatasetDir = datasetDir };
        var command = BuildTrainCommand(result.DataYamlPath);
        DotCore.Foundations.ColorPrinter.Green($"[YOLO_DATASET] Generated: {datasetDir}");
        DotCore.Foundations.ColorPrinter.Green($"[YOLO_DATASET] Train: {result.TrainCount}, Val: {result.ValCount}");
        return result with { TrainCommand = command, DatasetDir = datasetDir };
    }

    /// <summary>Ultralytics CLI arguments: detect train key=value ... (data, model, epochs, imgsz, batch, device).</summary>
    public static List<string> BuildTrainArguments(string dataYamlPath, string model = DefaultTrainModel, int epochs = DefaultTrainEpochs, int imgsz = DefaultTrainImgsz, int batch = DefaultTrainBatch, string device = DefaultTrainDevice)
    {
        var args = new List<string> { "detect", "train" };
        args.AddRange(TrainValues(dataYamlPath, model, epochs, imgsz, batch, device).Select(kv => $"{kv.Key}={kv.Value}"));
        return args;
    }

    /// <summary>Ultralytics CLI command string with shell-quoted values. 1:1 build_train_command.</summary>
    public static string BuildTrainCommand(string dataYamlPath, string model = DefaultTrainModel, int epochs = DefaultTrainEpochs, int imgsz = DefaultTrainImgsz, int batch = DefaultTrainBatch, string device = DefaultTrainDevice)
    {
        var arguments = string.Join(" ", TrainValues(dataYamlPath, model, epochs, imgsz, batch, device).Select(kv => $"{kv.Key}={ShellQuote(kv.Value)}"));
        return $"{YoloTrainFlow.YoloCliExe} detect train {arguments}";
    }

    private static IEnumerable<KeyValuePair<string, string>> TrainValues(string dataYamlPath, string model, int epochs, int imgsz, int batch, string device)
    {
        yield return new("data", dataYamlPath);
        yield return new("model", model);
        yield return new("epochs", epochs.ToString(CultureInfo.InvariantCulture));
        yield return new("imgsz", imgsz.ToString(CultureInfo.InvariantCulture));
        yield return new("batch", batch.ToString(CultureInfo.InvariantCulture));
        yield return new("device", device);
    }

    private static string ShellQuote(string value)
    {
        if (string.IsNullOrEmpty(value)) return "''";
        return ShellSafe.IsMatch(value) ? value : "'" + value.Replace("'", "'\"'\"'") + "'";
    }

    private static List<string> BuildLabelLines(int width, int height, IReadOnlyList<Annotation> annotations, int classCount)
    {
        var lines = new List<string>();
        if (width <= 0 || height <= 0) return lines;
        foreach (var a in annotations)
        {
            if (a.ClassId < 0 || a.ClassId >= classCount) continue;
            double boxW, boxH, cx, cy;
            if (a.Type == ShapeCircle)
            {
                var r = Math.Max(a.Radius, 0.0);
                boxW = r * 2.0;
                boxH = r * 2.0;
                cx = a.X;
                cy = a.Y;
            }
            else
            {
                boxW = Math.Max(a.Width, 0.0);
                boxH = Math.Max(a.Height, 0.0);
                cx = a.X + boxW / 2.0;
                cy = a.Y + boxH / 2.0;
            }
            if (boxW <= 0 || boxH <= 0) continue;
            var values = new[] { cx / width, cy / height, boxW / width, boxH / height }.Select(v => Math.Min(Math.Max(v, 0.0), 1.0));
            lines.Add(a.ClassId + " " + string.Join(" ", values.Select(v => v.ToString("F6", CultureInfo.InvariantCulture))));
        }
        return lines;
    }
}
