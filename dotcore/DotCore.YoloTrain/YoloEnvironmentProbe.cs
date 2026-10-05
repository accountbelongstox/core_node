using System.Globalization;
using System.Runtime.InteropServices;
using System.Text.Json;
using DotCore.Foundations;
using DotCore.VocAnnotator;

namespace DotCore.YoloTrain;

/// <summary>
/// Detects the training environment: OS, CPU, RAM, NVIDIA GPUs (nvidia-smi) and a Python interpreter with torch + Ultralytics.
/// Python candidates in order: explicit path, VENV_PYTHON3 (Linux venv convention), the interpreter owning `yolo` on PATH,
/// then python / py -3 (Windows) or python3 / python; the first one with Ultralytics wins, else the first that runs.
/// </summary>
public static class YoloEnvironmentProbe
{
    public const string LinuxVenvPythonEnvVar = "VENV_PYTHON3";
    private const string LogTag = "[YoloEnvironmentProbe]";
    private const string ScriptResourceName = "DotCore.YoloTrain.yolo_env_probe.py";
    private const string ScriptMarker = "@@YOLO_ENV@@";
    private const string NvidiaSmi = "nvidia-smi";
    private static readonly TimeSpan PythonTimeout = TimeSpan.FromSeconds(90);
    private static readonly TimeSpan SmiTimeout = TimeSpan.FromSeconds(15);

    public static async Task<YoloEnvironment> ProbeAsync(string? pythonOverride, CancellationToken ct = default)
    {
        var gpusTask = ProbeGpusAsync(ct);
        var candidates = PythonCandidates(pythonOverride);
        PythonEnvironment? best = null;
        var tried = new List<string>();
        var scriptPath = WriteProbeScript();
        try
        {
            var seen = new HashSet<string>(OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal);
            foreach (var (exe, prefix) in candidates)
            {
                ct.ThrowIfCancellationRequested();
                tried.Add(prefix.Count == 0 ? exe : exe + " " + string.Join(" ", prefix));
                var env = await ProbePythonAsync(exe, prefix, scriptPath, ct).ConfigureAwait(false);
                if (env == null || !seen.Add(env.Executable)) continue;
                if (env.CanTrain) { best = env; break; }
                best ??= env;
            }
        }
        finally
        {
            try { File.Delete(scriptPath); } catch (IOException) { }
        }
        var (total, available) = ReadMemory();
        var result = new YoloEnvironment(
            RuntimeInformation.OSDescription,
            RuntimeInformation.OSArchitecture.ToString(),
            ReadCpuName(),
            Environment.ProcessorCount,
            total,
            available,
            await gpusTask.ConfigureAwait(false),
            best,
            tried,
            DateTime.UtcNow);
        ColorPrinter.Blue($"{LogTag} python={best?.Executable ?? "-"} torch={best?.TorchVersion ?? "-"} cuda={best?.CudaAvailable} ultralytics={best?.UltralyticsVersion ?? "-"} gpus={result.Gpus.Count}");
        return result;
    }

    private static List<(string Exe, IReadOnlyList<string> Prefix)> PythonCandidates(string? pythonOverride)
    {
        var none = Array.Empty<string>();
        var list = new List<(string, IReadOnlyList<string>)>();
        if (!string.IsNullOrWhiteSpace(pythonOverride)) list.Add((pythonOverride.Trim(), none));
        var venv = Environment.GetEnvironmentVariable(LinuxVenvPythonEnvVar);
        if (!string.IsNullOrWhiteSpace(venv) && File.Exists(venv)) list.Add((venv, none));
        if (ProcessCapture.FindOnPath("yolo") is { } yolo && PythonBesideCli(yolo) is { } owner) list.Add((owner, none));
        if (OperatingSystem.IsWindows())
        {
            foreach (var py in ProcessCapture.FindAllOnPath("python").Where(p => !IsWindowsAppsAlias(p))) list.Add((py, none));
            if (ProcessCapture.FindOnPath("py") is { } launcher && !IsWindowsAppsAlias(launcher)) list.Add((launcher, new[] { "-3" }));
        }
        else
        {
            foreach (var name in new[] { "python3", "python" })
                foreach (var p in ProcessCapture.FindAllOnPath(name)) list.Add((p, none));
        }
        return list;
    }

    /// <summary>%LOCALAPPDATA%\Microsoft\WindowsApps app-execution alias (Store stub that opens the Store or a sandboxed install).</summary>
    private static bool IsWindowsAppsAlias(string path)
    {
        var local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return local.Length > 0 && YoloDataLayout.IsUnder(path, Path.Combine(local, "Microsoft", "WindowsApps"));
    }

    /// <summary>Interpreter of the environment that installed a yolo entry script (Scripts\yolo.exe or bin/yolo).</summary>
    private static string? PythonBesideCli(string cliPath)
    {
        var dir = Path.GetDirectoryName(cliPath);
        if (dir == null) return null;
        var candidates = OperatingSystem.IsWindows()
            ? new[] { Path.Combine(dir, "python.exe"), Path.Combine(Path.GetDirectoryName(dir) ?? dir, "python.exe") }
            : new[] { Path.Combine(dir, "python3"), Path.Combine(dir, "python") };
        return candidates.FirstOrDefault(File.Exists);
    }

    private static string WriteProbeScript()
    {
        using var stream = typeof(YoloEnvironmentProbe).Assembly.GetManifestResourceStream(ScriptResourceName)
            ?? throw new InvalidOperationException(ScriptResourceName);
        var path = Path.Combine(Path.GetTempPath(), $"yolo_env_probe_{Environment.ProcessId}_{Guid.NewGuid():N}.py");
        using var file = File.Create(path);
        stream.CopyTo(file);
        return path;
    }

    private static async Task<PythonEnvironment?> ProbePythonAsync(string exe, IReadOnlyList<string> prefix, string scriptPath, CancellationToken ct)
    {
        var run = await ProcessCapture.RunAsync(exe, prefix.Append(scriptPath), PythonTimeout, ct).ConfigureAwait(false);
        var line = run.StdOut.Split('\n').Select(l => l.Trim()).FirstOrDefault(l => l.StartsWith(ScriptMarker, StringComparison.Ordinal));
        if (line == null)
        {
            ColorPrinter.Gray($"{LogTag} {exe}: no report (exit={run.ExitCode} timeout={run.TimedOut} {run.StartError ?? run.StdErr.Trim()})");
            return null;
        }
        try
        {
            using var doc = JsonDocument.Parse(line[ScriptMarker.Length..]);
            var r = doc.RootElement;
            var error = string.Join("; ", new[] { Str(r, "torch_error"), Str(r, "ultralytics_error") }.Where(e => !string.IsNullOrEmpty(e)));
            var devices = r.TryGetProperty("devices", out var d) && d.ValueKind == JsonValueKind.Array
                ? d.EnumerateArray().Select(e => e.GetString() ?? "").ToList()
                : new List<string>();
            return new PythonEnvironment(
                Str(r, "python") ?? exe,
                Str(r, "version") ?? "",
                Str(r, "torch"),
                Bool(r, "cuda"),
                Str(r, "cuda_version"),
                devices,
                Bool(r, "mps"),
                Str(r, "ultralytics"),
                Str(r, "yolo_cli"),
                error.Length == 0 ? null : error) { HasEntrypoint = Bool(r, "entrypoint") };
        }
        catch (JsonException ex)
        {
            ColorPrinter.Yellow($"{LogTag} {exe}: bad report {ex.Message}");
            return null;
        }
    }

    private static async Task<IReadOnlyList<GpuInfo>> ProbeGpusAsync(CancellationToken ct)
    {
        var exe = ProcessCapture.FindOnPath(NvidiaSmi);
        if (exe == null && OperatingSystem.IsWindows())
        {
            var legacy = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), "NVIDIA Corporation", "NVSMI", NvidiaSmi + ".exe");
            exe = File.Exists(legacy) ? legacy : null;
        }
        if (exe == null) return Array.Empty<GpuInfo>();
        var run = await ProcessCapture.RunAsync(exe,
            new[] { "--query-gpu=index,name,memory.total,memory.free,driver_version", "--format=csv,noheader,nounits" }, SmiTimeout, ct).ConfigureAwait(false);
        if (run.ExitCode != 0) return Array.Empty<GpuInfo>();
        var gpus = new List<GpuInfo>();
        foreach (var raw in run.StdOut.Split('\n', StringSplitOptions.RemoveEmptyEntries))
        {
            var f = raw.Split(',').Select(s => s.Trim()).ToArray();
            if (f.Length < 5 || !int.TryParse(f[0], out var idx)) continue;
            gpus.Add(new GpuInfo(idx, f[1], ParseInt(f[2]), ParseInt(f[3]), f[4]));
        }
        return gpus;
    }

    private static string ReadCpuName()
    {
        try
        {
            if (OperatingSystem.IsWindows())
            {
                using var key = Microsoft.Win32.Registry.LocalMachine.OpenSubKey(@"HARDWARE\DESCRIPTION\System\CentralProcessor\0");
                if (key?.GetValue("ProcessorNameString") is string name && name.Trim().Length > 0) return name.Trim();
                return Environment.GetEnvironmentVariable("PROCESSOR_IDENTIFIER") ?? "";
            }
            if (File.Exists("/proc/cpuinfo"))
            {
                var line = File.ReadLines("/proc/cpuinfo").FirstOrDefault(l => l.StartsWith("model name", StringComparison.Ordinal));
                int colon = line?.IndexOf(':') ?? -1;
                if (line != null && colon >= 0) return line[(colon + 1)..].Trim();
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or System.Security.SecurityException) { }
        return RuntimeInformation.ProcessArchitecture.ToString();
    }

    private static (long Total, long Available) ReadMemory()
    {
        long total = GC.GetGCMemoryInfo().TotalAvailableMemoryBytes;
        long available = 0;
        try
        {
            if (OperatingSystem.IsWindows())
            {
                var status = new MemoryStatusEx { Length = (uint)Marshal.SizeOf<MemoryStatusEx>() };
                if (GlobalMemoryStatusEx(ref status))
                {
                    total = (long)status.TotalPhys;
                    available = (long)status.AvailPhys;
                }
            }
            else if (File.Exists("/proc/meminfo"))
            {
                foreach (var line in File.ReadLines("/proc/meminfo"))
                {
                    var parts = line.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                    if (parts.Length < 2 || !long.TryParse(parts[1], out var kb)) continue;
                    if (parts[0] == "MemTotal:") total = kb * 1024;
                    else if (parts[0] == "MemAvailable:") available = kb * 1024;
                }
            }
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
        return (total, available);
    }

    private static string? Str(JsonElement e, string name) =>
        e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String ? v.GetString() : null;

    private static bool Bool(JsonElement e, string name) => e.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.True;

    private static int ParseInt(string s) => int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v) ? v : 0;

    [StructLayout(LayoutKind.Sequential)]
    private struct MemoryStatusEx
    {
        public uint Length;
        public uint MemoryLoad;
        public ulong TotalPhys;
        public ulong AvailPhys;
        public ulong TotalPageFile;
        public ulong AvailPageFile;
        public ulong TotalVirtual;
        public ulong AvailVirtual;
        public ulong AvailExtendedVirtual;
    }

    [DllImport("kernel32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx(ref MemoryStatusEx buffer);
}
