// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using DotCore.Foundations;

namespace DotCore.YoloTrain;

/// <summary>Epoch progress parsed from the Ultralytics console.</summary>
public sealed record YoloTrainProgress(int Epoch, int TotalEpochs);

public sealed record YoloRunResult(bool Success, int ExitCode, bool Cancelled, string? RunDir, string? OutputFile, string? Error);

/// <summary>
/// Runs the Ultralytics CLI (train, export) as a child process: streams console lines (ANSI stripped, tqdm refreshes collapsed),
/// reports epoch progress, and cancels by killing the process tree. One run at a time per instance.
/// Fixes Python bug: flow6 was a TODO stub (training never started).
/// </summary>
public sealed class YoloTrainRunner
{
    private const string LogTag = "[YoloTrainRunner]";
    private const int ProgressDonePercent = 100;
    private const string ResultsSavedPrefix = "Results saved to ";
    private const string ExportFormatOnnx = "onnx";

    private static readonly Regex Ansi = new(@"\x1B\[[0-9;?]*[ -/]*[@-~]", RegexOptions.Compiled);
    private static readonly Regex EpochLine = new(@"^\s*(\d+)/(\d+)\s+\S", RegexOptions.Compiled);

    /// <summary>tqdm ("42%|####") and Ultralytics 8.4+ ("42% ━━━━", downloads "42% ────") progress bars.</summary>
    private static readonly Regex ProgressBar = new(@"(\d{1,3})%\s*[|─━█]", RegexOptions.Compiled);

    private readonly object _lock = new();
    private Process? _process;
    private bool _cancelRequested;

    public event Action<string>? Output;

    public event Action<YoloTrainProgress>? Progress;

    public bool IsRunning
    {
        get { lock (_lock) return _process != null; }
    }

    public async Task<YoloRunResult> TrainAsync(string cliPath, string dataYamlPath, YoloTrainParameters parameters, string projectDir, string runName, CancellationToken ct = default)
    {
        Directory.CreateDirectory(projectDir);
        var startedUtc = DateTime.UtcNow.AddSeconds(-1);
        var args = parameters.ToTrainArguments(dataYamlPath, projectDir, runName);
        var result = await RunAsync(cliPath, args, projectDir, line => line.StartsWith(ResultsSavedPrefix, StringComparison.Ordinal)
            ? ResolveDir(line[ResultsSavedPrefix.Length..].Trim(), projectDir)
            : null, runDir => YoloArtifacts.WeightsPath(runDir ?? FindRunDir(projectDir, runName, startedUtc) ?? Path.Combine(projectDir, runName)), ct).ConfigureAwait(false);
        if (result.RunDir == null && result.OutputFile != null)
            result = result with { RunDir = Path.GetDirectoryName(Path.GetDirectoryName(result.OutputFile)) };
        return result;
    }

    /// <summary>Run dir of this run when Ultralytics did not print it: newest {runName}* dir whose best.pt was written after the start.</summary>
    private static string? FindRunDir(string projectDir, string runName, DateTime startedUtc)
    {
        try
        {
            return new DirectoryInfo(projectDir).EnumerateDirectories(runName + "*")
                .Select(d => (Dir: d.FullName, Weights: new FileInfo(YoloArtifacts.WeightsPath(d.FullName))))
                .Where(x => x.Weights.Exists && x.Weights.LastWriteTimeUtc >= startedUtc)
                .OrderByDescending(x => x.Weights.LastWriteTimeUtc)
                .Select(x => x.Dir)
                .FirstOrDefault();
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
    }

    public Task<YoloRunResult> ExportOnnxAsync(string cliPath, string weightsPath, int imgsz, CancellationToken ct = default)
    {
        var args = new[]
        {
            "export",
            "model=" + weightsPath,
            "format=" + ExportFormatOnnx,
            "imgsz=" + YoloTrainParameters.NormalizeImgsz(imgsz).ToString(CultureInfo.InvariantCulture),
        };
        var dir = Path.GetDirectoryName(Path.GetFullPath(weightsPath)) ?? "";
        return RunAsync(cliPath, args, dir, _ => null, _ => YoloArtifacts.OnnxPathForWeights(weightsPath), ct);
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

    private async Task<YoloRunResult> RunAsync(string cliPath, IReadOnlyList<string> args, string workDir,
        Func<string, string?> runDirFromLine, Func<string?, string> outputFile, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = cliPath,
            WorkingDirectory = workDir,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        psi.Environment["PYTHONIOENCODING"] = "utf-8";
        psi.Environment["PYTHONUNBUFFERED"] = "1";

        var process = new Process { StartInfo = psi };
        lock (_lock)
        {
            if (_process != null) return new YoloRunResult(false, -1, false, null, null, "busy");
            _cancelRequested = false;
            try
            {
                if (!process.Start()) return new YoloRunResult(false, -1, false, null, null, cliPath);
            }
            catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
            {
                process.Dispose();
                return new YoloRunResult(false, -1, false, null, null, ex.Message);
            }
            _process = process;
        }
        Emit(YoloTrainParameters.FormatCommand(cliPath, args));
        string? runDir = null;
        int lastEpoch = -1;
        var handleLock = new object();
        void Handle(string? raw)
        {
            if (raw == null) return;
            var line = Ansi.Replace(raw, "").TrimEnd();
            if (line.Length == 0) return;
            lock (handleLock)
            {
                var m = EpochLine.Match(line);
                if (m.Success && int.TryParse(m.Groups[1].Value, out var ep) && int.TryParse(m.Groups[2].Value, out var total) && total > 0)
                {
                    if (ep != lastEpoch) Progress?.Invoke(new YoloTrainProgress(ep, total));
                    lastEpoch = ep;
                }
                if (runDirFromLine(line) is { } dir) runDir = dir;
                var bar = ProgressBar.Match(line);
                if (bar.Success && int.TryParse(bar.Groups[1].Value, out var pct) && pct < ProgressDonePercent) return;
                Emit(line);
            }
        }
        using var registration = ct.Register(Cancel);
        try
        {
            var stdout = PumpAsync(process.StandardOutput, Handle);
            var stderr = PumpAsync(process.StandardError, Handle);
            await process.WaitForExitAsync().ConfigureAwait(false);
            await Task.WhenAll(stdout, stderr).ConfigureAwait(false);
            bool cancelled;
            lock (_lock) cancelled = _cancelRequested;
            var file = outputFile(runDir);
            bool ok = !cancelled && process.ExitCode == 0 && File.Exists(file);
            ColorPrinter.Blue($"{LogTag} exit={process.ExitCode} cancelled={cancelled} output={file}");
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
}
