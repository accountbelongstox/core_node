// PY-REF: none (DOT-only)
using System.Text.Json;
using System.Text.RegularExpressions;
using DotCore.VocAnnotator;

namespace DotCore.YoloTrain;

/// <summary>Where a run lives: a recorded project ({root}/{client}/{project}/_runs) or a task set ({root}/_tasksets/{id}/_runs).</summary>
public enum YoloRunScopeKind
{
    Project,
    TaskSet,
    Other,
}

/// <summary>One training run dir with its run_info (null for runs made before run_info existed) and model files.</summary>
public sealed record YoloRunEntry(string RunDir, YoloRunScopeKind ScopeKind, string ScopeDir, YoloRunInfo? Info,
    string? Weights, string? LastWeights, string? Onnx, DateTime UpdatedUtc)
{
    public string Name => Path.GetFileName(RunDir);

    /// <summary>Classes from run_info, else from the run's args.yaml dataset (data.yaml names).</summary>
    public IReadOnlyList<string> Classes => Info?.Classes is { Count: > 0 } c ? c : YoloModelRegistry.ClassesFromArgs(RunDir);

    /// <summary>last.pt exists and the run did not complete (resume candidate); without run_info: results.csv has fewer rows than args.yaml epochs.</summary>
    public bool CanResume => LastWeights != null && (Info != null ? Info.Status is not YoloRunStatus.Completed : !YoloModelRegistry.ReachedArgsEpochs(RunDir));
}

/// <summary>Current model of one consumer as stored in _models.json.</summary>
public sealed record YoloCurrentModel(string Model, string? RunDir, DateTime SetUtc);

public enum YoloModelResolveStatus
{
    Ok,
    NotSet,
    FileMissing,
    MissingClasses,
}

/// <summary>Resolution of a consumer's model; MissingClasses lists required classes the model lacks (unknown classes = empty list).</summary>
public sealed record YoloModelResolution(YoloModelResolveStatus Status, string? ModelPath, IReadOnlyList<string> Classes, IReadOnlyList<string> MissingClasses)
{
    public bool IsOk => Status == YoloModelResolveStatus.Ok;
}

/// <summary>
/// Training runs under the YOLO data root and the current model per consumer ({root}/_models.json, e.g. "navigation").
/// Scans only the fixed run locations (no recursive search over recorded frames).
/// </summary>
public sealed class YoloModelRegistry
{
    public const string ModelsFileName = "_models.json";
    public const string ConsumerNavigation = "navigation";
    public const string ConsumerAutoLabel = "auto_label";
    public const string TaskSetsSubdir = YoloDataLayout.ReservedPrefix + "tasksets";
    private const string ArgsYamlFileName = "args.yaml";

    private static readonly object FileLock = new();
    private static readonly Regex YamlKeyValue = new(@"^(\w+):\s*(.*)$", RegexOptions.Compiled);
    private static readonly Regex YamlName = new(@"^\s+(\d+):\s*(.*)$", RegexOptions.Compiled);

    public YoloModelRegistry(string root) => Root = Path.GetFullPath(root);

    /// <summary>Registry of the current data root (YoloDataLayout.Root).</summary>
    public static YoloModelRegistry Default => new(YoloDataLayout.Root);

    public string Root { get; }

    public string ModelsFile => Path.Combine(Root, ModelsFileName);

    /// <summary>Every runs dir: projects {root}/{client}/{project}/_runs and task sets {root}/_tasksets/{id}/_runs.</summary>
    public IReadOnlyList<(YoloRunScopeKind Kind, string RunsDir)> RunsDirs()
    {
        var list = new List<(YoloRunScopeKind, string)>();
        foreach (var top in SafeDirs(Root))
        {
            var name = Path.GetFileName(top);
            if (string.Equals(name, TaskSetsSubdir, StringComparison.OrdinalIgnoreCase))
            {
                foreach (var set in SafeDirs(top)) AddIfExists(list, YoloRunScopeKind.TaskSet, set);
                continue;
            }
            if (YoloDataLayout.IsReservedName(name)) continue;
            foreach (var project in SafeDirs(top))
                if (!YoloDataLayout.IsReservedName(Path.GetFileName(project))) AddIfExists(list, YoloRunScopeKind.Project, project);
        }
        return list;
    }

    /// <summary>Runs of every scope, newest first.</summary>
    public IReadOnlyList<YoloRunEntry> ListRuns() =>
        RunsDirs().SelectMany(r => ListRunsIn(r.RunsDir, r.Kind)).OrderByDescending(e => e.UpdatedUtc).ToList();

    /// <summary>Runs of one runs dir ({scope}/_runs), newest first.</summary>
    public static IReadOnlyList<YoloRunEntry> ListRunsIn(string runsDir, YoloRunScopeKind kind = YoloRunScopeKind.Other) =>
        SafeDirs(runsDir).Select(d => ReadRun(d, kind, Path.GetDirectoryName(Path.GetFullPath(runsDir)) ?? runsDir))
            .Where(e => e != null).Select(e => e!).OrderByDescending(e => e.UpdatedUtc).ToList();

    /// <summary>A single run dir, or null when it has no weights, results or run_info.</summary>
    public static YoloRunEntry? ReadRun(string runDir, YoloRunScopeKind kind = YoloRunScopeKind.Other, string? scopeDir = null)
    {
        var info = YoloRunInfo.Load(runDir);
        var weights = ExistingOrNull(YoloArtifacts.WeightsPath(runDir));
        var last = ExistingOrNull(YoloArtifacts.LastWeightsPath(runDir));
        var onnx = info?.Onnx is { } o && File.Exists(o) ? o : ExistingOrNull(YoloArtifacts.OnnxPath(runDir));
        bool hasResults = File.Exists(YoloResultsCsv.PathFor(runDir));
        if (info == null && weights == null && last == null && !hasResults) return null;
        var updated = new[] { weights, last, onnx, YoloRunInfo.PathFor(runDir) }.Where(p => p != null && File.Exists(p))
            .Select(p => File.GetLastWriteTimeUtc(p!)).DefaultIfEmpty(Directory.GetLastWriteTimeUtc(runDir)).Max();
        return new YoloRunEntry(Path.GetFullPath(runDir), kind, scopeDir ?? Path.GetDirectoryName(Path.GetDirectoryName(Path.GetFullPath(runDir))) ?? "",
            info, weights, last, onnx, updated);
    }

    /// <summary>Class names of a model file inside a run ({run}/weights/*): run_info, else args.yaml → data.yaml; empty when unknown.</summary>
    public static IReadOnlyList<string> ClassesForModel(string modelPath)
    {
        var runDir = YoloArtifacts.RunDirOfModel(modelPath);
        if (runDir == null) return Array.Empty<string>();
        var info = YoloRunInfo.Load(runDir);
        return info?.Classes is { Count: > 0 } c ? c : ClassesFromArgs(runDir);
    }

    /// <summary>names of the data.yaml referenced by {run}/args.yaml; empty when unavailable.</summary>
    public static IReadOnlyList<string> ClassesFromArgs(string runDir)
    {
        var args = Path.Combine(runDir, ArgsYamlFileName);
        if (!File.Exists(args)) return Array.Empty<string>();
        try
        {
            var data = File.ReadLines(args).Select(l => YamlKeyValue.Match(l)).FirstOrDefault(m => m.Success && m.Groups[1].Value == "data")?.Groups[2].Value.Trim();
            return string.IsNullOrEmpty(data) ? Array.Empty<string>() : ReadDataYamlNames(Unquote(data));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return Array.Empty<string>();
        }
    }

    /// <summary>True when results.csv reached the epochs of args.yaml (a run trained before run_info existed finished).</summary>
    public static bool ReachedArgsEpochs(string runDir)
    {
        var args = Path.Combine(runDir, ArgsYamlFileName);
        if (!File.Exists(args)) return false;
        try
        {
            var epochs = File.ReadLines(args).Select(l => YamlKeyValue.Match(l)).FirstOrDefault(m => m.Success && m.Groups[1].Value == "epochs")?.Groups[2].Value.Trim();
            var rows = YoloResultsCsv.Read(runDir);
            return int.TryParse(epochs, out var n) && rows.Count > 0 && rows[^1].Epoch >= n;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return false;
        }
    }

    /// <summary>names of a data.yaml written by YoloDataYaml (index: 'name' lines).</summary>
    public static IReadOnlyList<string> ReadDataYamlNames(string dataYaml)
    {
        if (!File.Exists(dataYaml)) return Array.Empty<string>();
        var names = new SortedDictionary<int, string>();
        bool inNames = false;
        foreach (var line in File.ReadLines(dataYaml))
        {
            if (line.StartsWith("names:", StringComparison.Ordinal)) { inNames = true; continue; }
            if (!inNames) continue;
            var m = YamlName.Match(line);
            if (!m.Success) break;
            names[int.Parse(m.Groups[1].Value)] = Unquote(m.Groups[2].Value.Trim());
        }
        return names.Values.ToList();
    }

    public IReadOnlyDictionary<string, YoloCurrentModel> GetAllCurrent()
    {
        lock (FileLock) return ReadModelsFile();
    }

    public YoloCurrentModel? GetCurrent(string consumer) => GetAllCurrent().TryGetValue(consumer, out var m) ? m : null;

    /// <summary>Set (modelPath non-empty) or clear the consumer's current model; the path is stored absolute.</summary>
    public void SetCurrent(string consumer, string? modelPath)
    {
        lock (FileLock)
        {
            var all = new Dictionary<string, YoloCurrentModel>(ReadModelsFile(), StringComparer.Ordinal);
            if (string.IsNullOrWhiteSpace(modelPath)) all.Remove(consumer);
            else
            {
                var full = Path.GetFullPath(modelPath);
                all[consumer] = new YoloCurrentModel(full, YoloArtifacts.RunDirOfModel(full), DateTime.UtcNow);
            }
            Directory.CreateDirectory(Root);
            var tmp = ModelsFile + ".tmp";
            File.WriteAllText(tmp, JsonSerializer.Serialize(all, YoloRunInfo.JsonOptions));
            File.Move(tmp, ModelsFile, overwrite: true);
        }
    }

    /// <summary>Consumer's current model checked against required classes (classes unknown = accepted; the detector re-checks).</summary>
    public YoloModelResolution Resolve(string consumer, IReadOnlyCollection<string>? requiredClasses = null)
    {
        var current = GetCurrent(consumer);
        if (current == null) return new YoloModelResolution(YoloModelResolveStatus.NotSet, null, Array.Empty<string>(), Array.Empty<string>());
        return Check(current.Model, requiredClasses);
    }

    /// <summary>Checks a model file against required classes.</summary>
    public static YoloModelResolution Check(string modelPath, IReadOnlyCollection<string>? requiredClasses)
    {
        if (!File.Exists(modelPath)) return new YoloModelResolution(YoloModelResolveStatus.FileMissing, modelPath, Array.Empty<string>(), Array.Empty<string>());
        var classes = ClassesForModel(modelPath);
        var missing = classes.Count == 0 || requiredClasses == null ? Array.Empty<string>() : requiredClasses.Where(c => !classes.Contains(c)).ToArray();
        return new YoloModelResolution(missing.Length > 0 ? YoloModelResolveStatus.MissingClasses : YoloModelResolveStatus.Ok, modelPath, classes, missing);
    }

    /// <summary>Last write time of _models.json (cache key for consumers), DateTime.MinValue when absent.</summary>
    public DateTime ModelsFileStamp() => File.Exists(ModelsFile) ? File.GetLastWriteTimeUtc(ModelsFile) : DateTime.MinValue;

    private Dictionary<string, YoloCurrentModel> ReadModelsFile()
    {
        if (!File.Exists(ModelsFile)) return new Dictionary<string, YoloCurrentModel>(StringComparer.Ordinal);
        try
        {
            return JsonSerializer.Deserialize<Dictionary<string, YoloCurrentModel>>(File.ReadAllText(ModelsFile), YoloRunInfo.JsonOptions)
                ?? new Dictionary<string, YoloCurrentModel>(StringComparer.Ordinal);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return new Dictionary<string, YoloCurrentModel>(StringComparer.Ordinal);
        }
    }

    private static void AddIfExists(List<(YoloRunScopeKind, string)> list, YoloRunScopeKind kind, string scopeDir)
    {
        var runs = YoloDataLayout.GetRunsDir(scopeDir);
        if (Directory.Exists(runs)) list.Add((kind, runs));
    }

    private static IEnumerable<string> SafeDirs(string dir)
    {
        try
        {
            return Directory.Exists(dir) ? Directory.GetDirectories(dir) : Array.Empty<string>();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return Array.Empty<string>();
        }
    }

    private static string? ExistingOrNull(string path) => File.Exists(path) ? path : null;

    private static string Unquote(string value) =>
        value.Length >= 2 && (value[0] == '\'' && value[^1] == '\'' || value[0] == '"' && value[^1] == '"')
            ? value[1..^1].Replace("''", "'")
            : value;
}
