// PY-REF: none (DOT-only)
using System.Globalization;

namespace DotCore.YoloTrain;

/// <summary>One results.csv row (epoch is 1-based as written by Ultralytics 8.x); Values holds every numeric column by header name.</summary>
public sealed record YoloEpochMetrics(int Epoch, IReadOnlyDictionary<string, double> Values)
{
    public double? Precision => Get(YoloResultsCsv.ColPrecision);
    public double? Recall => Get(YoloResultsCsv.ColRecall);
    public double? MAP50 => Get(YoloResultsCsv.ColMap50);
    public double? MAP50To95 => Get(YoloResultsCsv.ColMap50To95);
    public double? BoxLoss => Get(YoloResultsCsv.ColBoxLoss);
    public double? ClsLoss => Get(YoloResultsCsv.ColClsLoss);
    public double? DflLoss => Get(YoloResultsCsv.ColDflLoss);
    public double? ValBoxLoss => Get(YoloResultsCsv.ColValBoxLoss);
    public double? ValClsLoss => Get(YoloResultsCsv.ColValClsLoss);
    public double? ValDflLoss => Get(YoloResultsCsv.ColValDflLoss);

    /// <summary>Ultralytics best.pt selection: 0.1 * mAP50 + 0.9 * mAP50-95.</summary>
    public double Fitness => 0.1 * (MAP50 ?? 0) + 0.9 * (MAP50To95 ?? 0);

    public double? Get(string column) => Values.TryGetValue(column, out var v) ? v : null;
}

/// <summary>Reader of Ultralytics results.csv keyed by header name (tolerates added, missing or reordered columns).</summary>
public static class YoloResultsCsv
{
    public const string FileName = "results.csv";
    public const string ColEpoch = "epoch";
    public const string ColPrecision = "metrics/precision(B)";
    public const string ColRecall = "metrics/recall(B)";
    public const string ColMap50 = "metrics/mAP50(B)";
    public const string ColMap50To95 = "metrics/mAP50-95(B)";
    public const string ColBoxLoss = "train/box_loss";
    public const string ColClsLoss = "train/cls_loss";
    public const string ColDflLoss = "train/dfl_loss";
    public const string ColValBoxLoss = "val/box_loss";
    public const string ColValClsLoss = "val/cls_loss";
    public const string ColValDflLoss = "val/dfl_loss";

    public static string PathFor(string runDir) => Path.Combine(runDir, FileName);

    /// <summary>Rows of {runDir}/results.csv or a csv path; empty when missing or unreadable (the file is written while training).</summary>
    public static IReadOnlyList<YoloEpochMetrics> Read(string runDirOrCsv)
    {
        var path = Directory.Exists(runDirOrCsv) ? PathFor(runDirOrCsv) : runDirOrCsv;
        if (!File.Exists(path)) return Array.Empty<YoloEpochMetrics>();
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var reader = new StreamReader(stream);
            return Parse(reader.ReadToEnd());
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return Array.Empty<YoloEpochMetrics>();
        }
    }

    public static IReadOnlyList<YoloEpochMetrics> Parse(string csv)
    {
        var lines = csv.Split('\n').Select(l => l.Trim('\r', ' ')).Where(l => l.Length > 0).ToList();
        if (lines.Count < 2) return Array.Empty<YoloEpochMetrics>();
        var header = lines[0].Split(',').Select(h => h.Trim()).ToArray();
        int epochCol = Array.IndexOf(header, ColEpoch);
        var rows = new List<YoloEpochMetrics>();
        foreach (var line in lines.Skip(1))
        {
            var cells = line.Split(',');
            var values = new Dictionary<string, double>(StringComparer.Ordinal);
            for (int i = 0; i < Math.Min(cells.Length, header.Length); i++)
                if (double.TryParse(cells[i].Trim(), NumberStyles.Float, CultureInfo.InvariantCulture, out var v)) values[header[i]] = v;
            int epoch = epochCol >= 0 && values.TryGetValue(ColEpoch, out var e) ? (int)e : rows.Count + 1;
            rows.Add(new YoloEpochMetrics(epoch, values));
        }
        return rows;
    }

    /// <summary>Row with the highest fitness (the epoch best.pt was saved from), or null.</summary>
    public static YoloEpochMetrics? Best(IReadOnlyList<YoloEpochMetrics> rows) =>
        rows.Count == 0 ? null : rows.OrderByDescending(r => r.Fitness).ThenBy(r => r.Epoch).First();
}
