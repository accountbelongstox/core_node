// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/yolo_train_flow.py
using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using DotCore.Foundations;
using DotCore.VocAnnotator;

namespace DotCore.YoloTrain;

/// <summary>Epoch progress parsed from the Ultralytics console or results.csv.</summary>
public sealed record YoloTrainProgress(int Epoch, int TotalEpochs);

/// <summary>results.csv rows of the running training (Rows grow by one per finished epoch).</summary>
public sealed record YoloTrainMetrics(string RunDir, IReadOnlyList<YoloEpochMetrics> Rows)
{
    public YoloEpochMetrics Latest => Rows[^1];

    public YoloEpochMetrics? Best => YoloResultsCsv.Best(Rows);
}

public sealed record YoloRunResult(bool Success, int ExitCode, bool Cancelled, string? RunDir, string? OutputFile, string? Error);

/// <summary>`yolo detect val` outcome; Metrics null when the summary line was not printed.</summary>
public sealed record YoloValResult(YoloRunResult Run, YoloValMetrics? Metrics);

/// <summary>
/// Runs Ultralytics (train, resume, val, export) as a child process through a YoloLauncher: streams console lines (ANSI stripped,
/// tqdm refreshes collapsed), reports epoch progress and results.csv metrics, and cancels by killing the process tree.
/// On Windows the child joins a kill-on-close job object so it never outlives the app. One run at a time per instance.
/// Fixes Python bug: flow6 was a TODO stub (training never started).
/// </summary>
public sealed class YoloTrainRunner
{
    private const string LogTag = "[YoloTrainRunner]";
    private const int ProgressDonePercent = 100;
    private const string ResultsSavedPrefix = "Results saved to ";
    private const string ExportFormatOnnx = "onnx";
    private const string ValAllRow = "all";
    private static readonly TimeSpan MetricsPollInterval = TimeSpan.FromSeconds(2);

    private static readonly Regex Ansi = new(@"\x1B\[[0-9;?]*[ -/]*[@-~]", RegexOptions.Compiled);
    private static readonly Regex EpochLine = new(@"^\s*(\d+)/(\d+)\s+\S", RegexOptions.Compiled);
    private static readonly Regex ArgsEpochs = new(@"^epochs:\s*(\d+)", RegexOptions.Compiled | RegexOptions.Multiline);

    /// <summary>Validation table row: name, images, instances, P, R, mAP50, mAP50-95.</summary>
    private static readonly Regex ValRow = new(@"^\s*(\S.*?)\s+(\d+)\s+(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s*$", RegexOptions.Compiled);

    /// <summary>tqdm ("42%|####") and Ultralytics 8.4+ ("42% ━━━━", downloads "42% ────") progress bars.</summary>
    private static readonly Regex ProgressBar = new(@"(\d{1,3})%\s*[|─━█]", RegexOptions.Compiled);

    private readonly object _lock = new();
    private Process? _process;
    private bool _cancelRequested;

    public event Action<string>? Output;

    public event Action<YoloTrainProgress>? Progress;

    /// <summary>Fires when results.csv of the running training gains rows (worker thread).</summary>
    public event Action<YoloTrainMetrics>? Metrics;

    /// <summary>Working dir of train/resume (stock checkpoints are resolved and downloaded here); null = {data root}/_weights.</summary>
    public string? WeightsDir { get; set; }

    public string EffectiveWeightsDir => WeightsDir ?? YoloArtifacts.SharedWeightsDir(YoloDataLayout.Root);

    public bool IsRunning
    {
        get { lock (_lock) return _process != null; }
    }

    public async Task<YoloRunResult> TrainAsync(YoloLauncher launcher, string dataYamlPath, YoloTrainParameters parameters, string projectDir, string runName, CancellationToken ct = default)
    {
        Directory.CreateDirectory(projectDir);
        var weightsDir = EffectiveWeightsDir;
        Directory.CreateDirectory(weightsDir);
        var startedUtc = DateTime.UtcNow.AddSeconds(-1);
        var args = parameters.ToTrainArguments(dataYamlPath, projectDir, runName, weightsDir);
        var result = await RunAsync(launcher, args, weightsDir,
            line => line.StartsWith(ResultsSavedPrefix, StringComparison.Ordinal) ? ResolveDir(line[ResultsSavedPrefix.Length..].Trim(), projectDir) : null,
            runDir => YoloArtifacts.WeightsPath(runDir ?? FindRunDir(projectDir, runName, startedUtc) ?? Path.Combine(projectDir, runName)),
            () => FindRunDir(projectDir, runName, startedUtc), parameters.Epochs, null, ct).ConfigureAwait(false);
        if (result.RunDir == null && result.OutputFile != null)
            result = result with { RunDir = Path.GetDirectoryName(Path.GetDirectoryName(result.OutputFile)) };
        return result;
    }

    /// <summary>Continues an interrupted training from {run}/weights/last.pt (Ultralytics restores data, epochs and the run dir from it).</summary>
    public Task<YoloRunResult> ResumeAsync(YoloLauncher launcher, string lastWeightsPath, CancellationToken ct = default)
    {
        var last = Path.GetFullPath(lastWeightsPath);
        var runDir = YoloArtifacts.RunDirOfModel(last) ?? Path.GetDirectoryName(last) ?? "";
        var weightsDir = EffectiveWeightsDir;
        Directory.CreateDirectory(weightsDir);
        var args = new[] { "detect", "train", "model=" + last, "resume=" + last };
        return RunAsync(launcher, args, weightsDir, _ => null, _ => YoloArtifacts.WeightsPath(runDir), () => runDir, ReadArgsEpochs(runDir), runDir, ct);
    }

    public Task<YoloRunResult> ExportOnnxAsync(YoloLauncher launcher, string weightsPath, int imgsz, CancellationToken ct = default) =>
        ExportOnnxAsync(launcher, weightsPath, new YoloExportOptions { Imgsz = imgsz }, ct);

    public Task<YoloRunResult> ExportOnnxAsync(YoloLauncher launcher, string weightsPath, YoloExportOptions options, CancellationToken ct = default)
    {
        var args = new List<string>
        {
            "export",
            "model=" + Path.GetFullPath(weightsPath),
            "format=" + ExportFormatOnnx,
            "imgsz=" + YoloTrainParameters.NormalizeImgsz(options.Imgsz).ToString(CultureInfo.InvariantCulture),
            "half=" + PyBool(options.Half),
            "dynamic=" + PyBool(options.Dynamic),
            "simplify=" + PyBool(options.Simplify),
        };
        if (options.Opset is { } opset) args.Add("opset=" + opset.ToString(CultureInfo.InvariantCulture));
        var dir = Path.GetDirectoryName(Path.GetFullPath(weightsPath)) ?? "";
        return RunAsync(launcher, args, dir, _ => null, _ => YoloArtifacts.OnnxPathForWeights(weightsPath), null, 0, null, ct);
    }

    /// <summary>`yolo detect val` of weights on a dataset's val split; outputs (plots) go to {projectDir}/{name}.</summary>
    public async Task<YoloValResult> ValAsync(YoloLauncher launcher, string weightsPath, string dataYamlPath, int imgsz, string projectDir, string name,
        string? device = null, CancellationToken ct = default)
    {
        Directory.CreateDirectory(projectDir);
        var args = new List<string>
        {
            "detect", "val",
            "model=" + Path.GetFullPath(weightsPath),
            "data=" + Path.GetFullPath(dataYamlPath),
            "imgsz=" + YoloTrainParameters.NormalizeImgsz(imgsz).ToString(CultureInfo.InvariantCulture),
            "split=val",
            "project=" + Path.GetFullPath(projectDir),
            "name=" + name,
            "exist_ok=True",
        };
        if (!string.IsNullOrWhiteSpace(device)) args.Add("device=" + device);
        var rows = new List<(string Name, YoloClassValMetrics M)>();
        void Observe(string line)
        {
            var m = ValRow.Match(line);
            if (!m.Success) return;
            rows.Add((m.Groups[1].Value.Trim(), new YoloClassValMetrics(Int(m.Groups[2].Value), Int(m.Groups[3].Value),
                Dbl(m.Groups[4].Value), Dbl(m.Groups[5].Value), Dbl(m.Groups[6].Value), Dbl(m.Groups[7].Value))));
        }
        var outDir = Path.Combine(projectDir, name);
        var run = await RunAsync(launcher, args, Path.GetFullPath(projectDir), _ => null, _ => outDir, null, 0, null, ct, Observe).ConfigureAwait(false);
        run = run with { RunDir = outDir, OutputFile = null, Success = run.Success || (!run.Cancelled && run.ExitCode == 0) };
        int allIdx = rows.FindLastIndex(r => r.Name == ValAllRow);
        if (allIdx < 0) return new YoloValResult(run, null);
        var all = rows[allIdx].M;
        var perClass = new Dictionary<string, YoloClassValMetrics>(StringComparer.Ordinal);
        foreach (var (n, m) in rows.Skip(allIdx + 1)) perClass[n] = m;
        return new YoloValResult(run, new YoloValMetrics(all.Images, all.Instances, all.Precision, all.Recall, all.MAP50, all.MAP50To95, perClass));
    }

    public void Cancel()
    {
        lock (_lock)
        {
            if (_process == null) return;
            _cancelRequested = true;
            try { _process.Kill(entireProcessTree: true); }
            catch (InvalidOperationException) { }
        }
    }

    /// <summary>Waits until no child is running (after Cancel); false on timeout.</summary>
    public bool WaitForIdle(TimeSpan timeout)
    {
        var sw = Stopwatch.StartNew();
        while (IsRunning)
        {
            if (sw.Elapsed >= timeout) return false;
            Thread.Sleep(50);
        }
        return true;
    }

    /// <summary>Run dir of this run: newest {runName}* dir whose results.csv or best.pt was written after the start.</summary>
    private static string? FindRunDir(string projectDir, string runName, DateTime startedUtc)
    {
        try
        {
            return new DirectoryInfo(projectDir).EnumerateDirectories(runName + "*")
                .Select(d => (Dir: d.FullName, Stamp: new[] { YoloArtifacts.WeightsPath(d.FullName), YoloResultsCsv.PathFor(d.FullName) }
                    .Select(p => new FileInfo(p)).Where(f => f.Exists).Select(f => f.LastWriteTimeUtc).DefaultIfEmpty(DateTime.MinValue).Max()))
                .Where(x => x.Stamp >= startedUtc)
                .OrderByDescending(x => x.Stamp)
                .Select(x => x.Dir)
                .FirstOrDefault();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    private static int ReadArgsEpochs(string runDir)
    {
        try
        {
            var path = Path.Combine(runDir, "args.yaml");
            var m = File.Exists(path) ? ArgsEpochs.Match(File.ReadAllText(path)) : Match.Empty;
            return m.Success ? Int(m.Groups[1].Value) : 0;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return 0;
        }
    }

    private async Task<YoloRunResult> RunAsync(YoloLauncher launcher, IReadOnlyList<string> args, string workDir,
        Func<string, string?> runDirFromLine, Func<string?, string> outputFile, Func<string?>? metricsDir, int totalEpochs, string? knownRunDir,
        CancellationToken ct, Action<string>? observe = null)
    {
        var psi = new ProcessStartInfo
        {
            FileName = launcher.FileName,
            WorkingDirectory = workDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var a in launcher.Arguments(args)) psi.ArgumentList.Add(a);
        psi.Environment["PYTHONIOENCODING"] = "utf-8";
        psi.Environment["PYTHONUNBUFFERED"] = "1";

        var process = new Process { StartInfo = psi };
        lock (_lock)
        {
            if (_process != null) return new YoloRunResult(false, -1, false, null, null, "busy");
            _cancelRequested = false;
            try
            {
                if (!process.Start()) return new YoloRunResult(false, -1, false, null, null, launcher.FileName);
            }
            catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
            {
                process.Dispose();
                return new YoloRunResult(false, -1, false, null, null, ex.Message);
            }
            ChildProcessJob.Assign(process);
            _process = process;
        }
        Emit(launcher.Format(args));
        string? runDir = knownRunDir;
        int lastEpoch = -1;
        var handleLock = new object();
        void ReportEpoch(int ep, int total)
        {
            if (ep > lastEpoch && total > 0) Progress?.Invoke(new YoloTrainProgress(ep, total));
            lastEpoch = Math.Max(lastEpoch, ep);
        }
        void Handle(string? raw)
        {
            if (raw == null) return;
            var line = Ansi.Replace(raw, "").TrimEnd();
            if (line.Length == 0) return;
            lock (handleLock)
            {
                observe?.Invoke(line);
                var m = EpochLine.Match(line);
                if (m.Success && int.TryParse(m.Groups[1].Value, out var ep) && int.TryParse(m.Groups[2].Value, out var total) && total > 0)
                    ReportEpoch(ep, total);
                if (runDirFromLine(line) is { } dir) runDir = dir;
                var bar = ProgressBar.Match(line);
                if (bar.Success && int.TryParse(bar.Groups[1].Value, out var pct) && pct < ProgressDonePercent) return;
                Emit(line);
            }
        }
        int metricRows = 0;
        void PollMetrics()
        {
            var dir = runDir ?? metricsDir?.Invoke();
            if (dir == null) return;
            var rows = YoloResultsCsv.Read(dir);
            if (rows.Count <= metricRows) return;
            metricRows = rows.Count;
            lock (handleLock) ReportEpoch(rows[^1].Epoch, totalEpochs);
            Metrics?.Invoke(new YoloTrainMetrics(dir, rows));
        }
        using var registration = ct.Register(Cancel);
        try
        {
            var stdout = PumpAsync(process.StandardOutput, Handle);
            var stderr = PumpAsync(process.StandardError, Handle);
            var exited = process.WaitForExitAsync();
            if (metricsDir != null)
            {
                while (await Task.WhenAny(exited, Task.Delay(MetricsPollInterval)).ConfigureAwait(false) != exited)
                    PollMetrics();
            }
            await exited.ConfigureAwait(false);
            await Task.WhenAll(stdout, stderr).ConfigureAwait(false);
            if (metricsDir != null) PollMetrics();
            bool cancelled;
            lock (_lock) cancelled = _cancelRequested;
            var file = outputFile(runDir);
            bool ok = !cancelled && process.ExitCode == 0 && File.Exists(file);
            ColorPrinter.Blue($"{LogTag} exit={process.ExitCode} cancelled={cancelled} output={file}");
            runDir ??= metricsDir?.Invoke();
            return new YoloRunResult(ok, process.ExitCode, cancelled, runDir, File.Exists(file) ? file : null, ok ? null : $"exit {process.ExitCode}");
        }
        finally
        {
            lock (_lock) _process = null;
            process.Dispose();
        }
    }

    private void Emit(string line) => Output?.Invoke(line);

    private static async Task PumpAsync(StreamReader reader, Action<string?> handle)
    {
        string? line;
        while ((line = await reader.ReadLineAsync().ConfigureAwait(false)) != null)
            handle(line);
    }

    private static string ResolveDir(string path, string baseDir) => Path.GetFullPath(Path.IsPathRooted(path) ? path : Path.Combine(baseDir, path));

    private static string PyBool(bool value) => value ? "True" : "False";

    private static int Int(string s) => int.Parse(s, CultureInfo.InvariantCulture);

    private static double Dbl(string s) => double.Parse(s, CultureInfo.InvariantCulture);
}
