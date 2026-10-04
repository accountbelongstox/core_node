// PY-REF: none (DOT-only)
using System.IO.Compression;

namespace DotCore.Decompile;

/// <summary>
/// Decompiler toolchain kept under one root folder (the app's data dir): ILSpy CLI (.NET -> C#), de4dot-cex (.NET deobfuscation),
/// autoit-ripper (compiled AutoIt -> .au3), UPX (unpack before AutoIt extraction). Install is idempotent: a present tool is kept.
/// </summary>
public sealed class DecompileTools
{
    public const string IlSpyPackage = "ilspycmd";
    public const string IlSpyVersion = "8.2.0.7535";
    public const string NuGetSource = "https://api.nuget.org/v3/index.json";
    public const string De4dotUrl = "https://github.com/ViRb3/de4dot-cex/releases/download/v4.0.0/de4dot-cex.zip";
    public const string AutoItRipperPackage = "autoit-ripper==1.2.0";
    public const string UpxUrl = "https://github.com/upx/upx/releases/download/v5.2.1/upx-5.2.1-win64.zip";

    private const string IlSpyDirName = "ilspycmd";
    private const string De4dotDirName = "de4dot-cex";
    private const string AutoItRipperDirName = "autoit_ripper";
    private const string UpxDirName = "upx";
    private static readonly string IlSpyExeName = OperatingSystem.IsWindows() ? "ilspycmd.exe" : "ilspycmd";
    private const string De4dotExeName = "de4dot-x64.exe";
    private const string UpxExeName = "upx.exe";
    private const string AutoItRipperModuleDir = "autoit_ripper";
    private const string DotnetExeName = "dotnet.exe";
    private const string DotnetDirName = "dotnet";
    private const string DotnetRootEnv = "DOTNET_ROOT";
    private const string PythonCommand = "python";

    private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromMinutes(5) };
    private string? _pythonExe;

    public DecompileTools(string root) => Root = root;

    public string Root { get; }
    public string PythonExe => _pythonExe ?? PythonCommand;

    public async Task<bool> ResolvePythonAsync(Action<string> log, CancellationToken token = default)
    {
        var candidates = new List<string>(OperatingSystem.IsWindows() ? new[] { "py", "python", "python3" } : new[] { "python3", "python" });
        var executableName = OperatingSystem.IsWindows() ? "python.exe" : "python3";
        foreach (var entry in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            var directory = entry.Trim('"');
            if (!Path.IsPathFullyQualified(directory)) continue;
            candidates.Add(Path.Combine(directory, executableName));
            if (Path.GetFileName(directory.TrimEnd(Path.DirectorySeparatorChar)).Equals("Scripts", StringComparison.OrdinalIgnoreCase)
                && Directory.GetParent(directory) is { } parent)
                candidates.Add(Path.Combine(parent.FullName, executableName));
        }
        if (_pythonExe != null) return true;
        foreach (var candidate in candidates.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            if (Path.IsPathFullyQualified(candidate) && !File.Exists(candidate)) continue;
            var output = new List<string>();
            var args = candidate == "py"
                ? new[] { "-3", "-c", "import sys; print(sys.executable)" }
                : new[] { "-c", "import sys; print(sys.executable)" };
            int code = await ToolProcess.RunAsync(candidate, args, line => { lock (output) output.Add(line); }, token: token).ConfigureAwait(false);
            if (code != 0) continue;
            _pythonExe = output.Select(line => line.Trim()).FirstOrDefault(File.Exists);
            if (_pythonExe != null)
            {
                log($"Python: {_pythonExe}");
                return true;
            }
        }
        log("Python: no working Python 3 interpreter found");
        return false;
    }

    public string IlSpyExe => Path.Combine(Root, IlSpyDirName, IlSpyExeName);

    public string? De4dotExe => FindFile(Path.Combine(Root, De4dotDirName), De4dotExeName);

    public string? UpxExe => FindFile(Path.Combine(Root, UpxDirName), UpxExeName);

    /// <summary>pip --target folder; put on PYTHONPATH to run autoit_ripper.</summary>
    public string AutoItRipperDir => Path.Combine(Root, AutoItRipperDirName);

    public bool HasIlSpy => File.Exists(IlSpyExe);
    public bool HasDe4dot => De4dotExe != null;
    public bool HasUpx => UpxExe != null;
    public bool HasAutoItRipper => Directory.Exists(Path.Combine(AutoItRipperDir, AutoItRipperModuleDir));

    public async Task<IReadOnlyDictionary<string, bool>> VerifyAsync(Action<string> log, CancellationToken token = default)
    {
        var checks = new Dictionary<string, bool>();
        var env = new Dictionary<string, string> { ["DOTNET_ROLL_FORWARD"] = "Major" };
        var pythonEnv = new Dictionary<string, string> { ["PYTHONPATH"] = AutoItRipperDir };
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
        timeout.CancelAfter(TimeSpan.FromMinutes(2));
        checks["ILSpy"] = HasIlSpy && await ToolProcess.RunAsync(IlSpyExe, new[] { "--version" }, log, env: env, token: timeout.Token).ConfigureAwait(false) == 0;
        checks["de4dot-cex"] = De4dotExe is { } de4dot && await ToolProcess.RunAsync(de4dot, new[] { "--help" }, log, token: timeout.Token).ConfigureAwait(false) == 0;
        checks["UPX"] = UpxExe is { } upx && await ToolProcess.RunAsync(upx, new[] { "--version" }, log, token: timeout.Token).ConfigureAwait(false) == 0;
        checks["autoit-ripper"] = HasAutoItRipper && await ResolvePythonAsync(log, timeout.Token).ConfigureAwait(false) && await ToolProcess.RunAsync(PythonExe,
            new[] { "-c", "from autoit_ripper.cli import main; import sys; sys.argv=['autoit-ripper','--help']; main()" }, log, env: pythonEnv, token: timeout.Token).ConfigureAwait(false) == 0;
        foreach (var check in checks) log($"CHECK {check.Key}: {(check.Value ? "PASS" : "FAIL")}");
        return checks;
    }

    /// <summary>Install every missing tool; true when all are present afterwards.</summary>
    public async Task<bool> InstallAllAsync(Action<string> log, CancellationToken token = default)
    {
        Directory.CreateDirectory(Root);
        bool ok = await InstallIlSpyAsync(log, token).ConfigureAwait(false);
        ok &= await InstallZipAsync("de4dot-cex", De4dotUrl, Path.Combine(Root, De4dotDirName), () => HasDe4dot, log, token).ConfigureAwait(false);
        ok &= await InstallZipAsync("UPX", UpxUrl, Path.Combine(Root, UpxDirName), () => HasUpx, log, token).ConfigureAwait(false);
        ok &= await InstallAutoItRipperAsync(log, token).ConfigureAwait(false);
        return ok;
    }

    /// <summary>`dotnet tool install ilspycmd --tool-path` with nuget.org given explicitly (machines without a configured NuGet source).</summary>
    public async Task<bool> InstallIlSpyAsync(Action<string> log, CancellationToken token = default)
    {
        if (HasIlSpy) return Present("ILSpy", log);
        log($"ILSpy: installing {IlSpyPackage} {IlSpyVersion} ...");
        int code = await ToolProcess.RunAsync(DotnetExe(), new[] { "tool", "install", IlSpyPackage, "--version", IlSpyVersion, "--tool-path", Path.Combine(Root, IlSpyDirName), "--add-source", NuGetSource },
            log, Root, token: token).ConfigureAwait(false);
        return Done("ILSpy", code == 0 && HasIlSpy, log);
    }

    /// <summary>`python -m pip install --target` (needs Python 3).</summary>
    public async Task<bool> InstallAutoItRipperAsync(Action<string> log, CancellationToken token = default)
    {
        if (HasAutoItRipper) return Present("autoit-ripper", log);
        if (!await ResolvePythonAsync(log, token).ConfigureAwait(false)) return Done("autoit-ripper", false, log);
        log($"autoit-ripper: installing {AutoItRipperPackage} ...");
        int code = await ToolProcess.RunAsync(PythonExe, new[] { "-m", "pip", "install", "--quiet", "--upgrade", "--target", AutoItRipperDir, AutoItRipperPackage },
            log, Root, token: token).ConfigureAwait(false);
        return Done("autoit-ripper", code == 0 && HasAutoItRipper, log);
    }

    private static async Task<bool> InstallZipAsync(string name, string url, string dir, Func<bool> present, Action<string> log, CancellationToken token)
    {
        if (present()) return Present(name, log);
        log($"{name}: downloading {url} ...");
        try
        {
            var zip = dir + ".zip";
            using (var response = await Http.GetAsync(url, token).ConfigureAwait(false))
            {
                response.EnsureSuccessStatusCode();
                await using var file = File.Create(zip);
                await response.Content.CopyToAsync(file, token).ConfigureAwait(false);
            }
            ZipFile.ExtractToDirectory(zip, dir, overwriteFiles: true);
            File.Delete(zip);
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log($"{name}: {ex.Message}");
        }
        return Done(name, present(), log);
    }

    /// <summary>dotnet host: DOTNET_ROOT, then Program Files\dotnet, then PATH.</summary>
    public static string DotnetExe()
    {
        var root = Environment.GetEnvironmentVariable(DotnetRootEnv);
        if (!string.IsNullOrEmpty(root) && File.Exists(Path.Combine(root, DotnetExeName))) return Path.Combine(root, DotnetExeName);
        var pf = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles), DotnetDirName, DotnetExeName);
        return File.Exists(pf) ? pf : DotnetDirName;
    }

    private static string? FindFile(string dir, string name) =>
        Directory.Exists(dir) ? Directory.EnumerateFiles(dir, name, SearchOption.AllDirectories).FirstOrDefault() : null;

    private static bool Present(string name, Action<string> log)
    {
        log($"{name}: already installed");
        return true;
    }

    private static bool Done(string name, bool ok, Action<string> log)
    {
        log(ok ? $"{name}: installed" : $"{name}: install failed");
        return ok;
    }
}
