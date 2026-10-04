// PY-REF: none (DOT-only)
namespace DotCore.Decompile;

public sealed record DecompileResult(bool Ok, BinaryKind Kind, string OutputDir, int FileCount, string Summary)
{
    public int ProtectedBodyCount { get; init; }
    public bool Partial { get; init; }
    public int ExitCode { get; init; } = -1;
    public string InputPath { get; init; } = "";
}

/// <summary>
/// Decompile one file by kind:
/// .NET -> de4dot-cex (deobfuscate + rename; skipped when absent) -> ILSpy project output, falling back to ILSpy single-file output
/// (obfuscated names can break project paths); compiled AutoIt -> autoit-ripper, retried after `upx -d` when the PE is UPX-packed;
/// other native code -> not supported (reported).
/// </summary>
public sealed class DecompileRunner
{
    private const string RollForwardEnv = "DOTNET_ROLL_FORWARD";
    private const string RollForwardMajor = "Major";
    private const string PythonPathEnv = "PYTHONPATH";
    private const string RipperScript = "import sys; from autoit_ripper.cli import main; sys.argv = ['autoit-ripper', sys.argv[1], sys.argv[2]]; main()";
    private const string CleanSubdir = "_deobfuscated";
    private const string SingleFileSubdir = "_single";
    private const string UnpackedSuffix = ".unpacked";
    private const string ObfuscatorLinePrefix = "Detected ";
    private const string DnGuardStubMarker = "DNGuard Runtime library not loaded";
    private const string CsPattern = "*.cs";

    private readonly DecompileTools _tools;

    public DecompileRunner(DecompileTools tools) => _tools = tools;

    public async Task<DecompileResult> DecompileAsync(string path, string outDir, Action<string> log, CancellationToken token = default)
    {
        path = Path.GetFullPath(path);
        outDir = Path.GetFullPath(outDir);
        token.ThrowIfCancellationRequested();
        var info = BinaryInspector.Inspect(path);
        log($"{Path.GetFileName(path)}: {info.Kind}{(info.UpxPacked ? " (UPX)" : "")}");
        var result = info.Kind switch
        {
            BinaryKind.Managed => await DecompileManagedAsync(path, outDir, log, token).ConfigureAwait(false),
            BinaryKind.AutoIt => await ExtractAutoItAsync(path, outDir, info.UpxPacked, log, token).ConfigureAwait(false),
            BinaryKind.Missing => new DecompileResult(false, info.Kind, outDir, 0, "file not found"),
            _ => new DecompileResult(false, info.Kind, outDir, 0, "native code: no decompiler for this format"),
        };
        return result with { InputPath = path };
    }

    public async Task<DecompileResult> DecompileManagedAsync(string path, string outDir, Action<string> log, CancellationToken token = default)
    {
        path = Path.GetFullPath(path);
        outDir = Path.Combine(Path.GetFullPath(outDir), Guid.NewGuid().ToString("N"));
        if (!_tools.HasIlSpy) return new DecompileResult(false, BinaryKind.Managed, outDir, 0, "ILSpy not installed");
        Directory.CreateDirectory(outDir);
        try
        {
            var inventory = ManagedAssemblyInspector.Inspect(path);
            await File.WriteAllTextAsync(Path.Combine(outDir, ManagedAssemblyInspector.ReportFileName),
                System.Text.Json.JsonSerializer.Serialize(inventory, new System.Text.Json.JsonSerializerOptions { WriteIndented = true }), token).ConfigureAwait(false);
            log($"Method inventory: {inventory.Methods.Count} methods -> {Path.Combine(outDir, ManagedAssemblyInspector.ReportFileName)}");
        }
        catch (BadImageFormatException ex)
        {
            log($"Method inventory unavailable: {ex.Message}");
        }
        string input = path;
        string obfuscator = "";
        if (_tools.De4dotExe is { } de4dot)
        {
            await ToolProcess.RunAsync(de4dot, new[] { "-d", path }, line =>
            {
                if (line.StartsWith(ObfuscatorLinePrefix, StringComparison.Ordinal)) obfuscator = line;
                log(line);
            }, outDir, token: token).ConfigureAwait(false);
            if (!obfuscator.StartsWith("Detected Unknown Obfuscator", StringComparison.Ordinal))
            {
                string cleaned = Path.Combine(outDir, CleanSubdir, Path.GetFileName(path));
                Directory.CreateDirectory(Path.GetDirectoryName(cleaned)!);
                int cleanCode = await ToolProcess.RunAsync(de4dot, new[] { path, "-o", cleaned }, line =>
                {
                    if (line.StartsWith(ObfuscatorLinePrefix, StringComparison.Ordinal)) obfuscator = line;
                    log(line);
                }, outDir, token: token).ConfigureAwait(false);
                if (cleanCode == 0 && File.Exists(cleaned) && BinaryInspector.Inspect(cleaned).Kind == BinaryKind.Managed) input = cleaned;
            }
        }

        var env = new Dictionary<string, string> { [RollForwardEnv] = RollForwardMajor };
        int code = await ToolProcess.RunAsync(_tools.IlSpyExe, new[] { "-p", "-o", outDir, input }, log, outDir, env, token).ConfigureAwait(false);
        if (code != 0)
        {
            log("ILSpy project output failed, retrying single-file output");
            string single = Path.Combine(outDir, SingleFileSubdir);
            Directory.CreateDirectory(single);
            code = await ToolProcess.RunAsync(_tools.IlSpyExe, new[] { "-o", single, input }, log, outDir, env, token).ConfigureAwait(false);
        }
        string sourceDir = code == 0 && Directory.Exists(Path.Combine(outDir, SingleFileSubdir))
            ? Path.Combine(outDir, SingleFileSubdir) : outDir;
        var files = Directory.EnumerateFiles(sourceDir, CsPattern, SearchOption.AllDirectories).ToList();
        int stubs = files.Sum(f => CountOccurrences(File.ReadAllText(f), DnGuardStubMarker));
        string summary = $"{files.Count} .cs files" + (input != path ? ", deobfuscated" : "")
                         + (obfuscator.Length > 0 ? $"; {obfuscator}" : "")
                         + (stubs > 0 ? $"; {stubs} DNGuard placeholder bodies remain; original method logic not recovered" : "");
        return new DecompileResult(code == 0 && files.Count > 0, BinaryKind.Managed, outDir, files.Count, summary)
        {
            ExitCode = code,
            ProtectedBodyCount = stubs,
            Partial = stubs > 0 || (code != 0 && files.Count > 0)
        };
    }

    public async Task<DecompileResult> ExportIlAsync(string path, string outDir, Action<string> log, CancellationToken token = default)
    {
        var env = new Dictionary<string, string> { [RollForwardEnv] = RollForwardMajor };
        var info = BinaryInspector.Inspect(path);
        path = Path.GetFullPath(path);
        outDir = Path.Combine(Path.GetFullPath(outDir), Guid.NewGuid().ToString("N"));
        if (info.Kind != BinaryKind.Managed || !_tools.HasIlSpy)
            return new DecompileResult(false, info.Kind, outDir, 0, "IL export requires a managed assembly and ILSpy");
        Directory.CreateDirectory(outDir);
        int code = await ToolProcess.RunAsync(_tools.IlSpyExe, new[] { "-il", "-o", outDir, path }, log, outDir, env, token).ConfigureAwait(false);
        var files = Directory.EnumerateFiles(outDir, "*.il", SearchOption.AllDirectories).ToList();
        int stubs = files.Sum(file => CountOccurrences(File.ReadAllText(file), DnGuardStubMarker));
        return new DecompileResult(code == 0 && files.Count > 0, info.Kind, outDir, files.Count,
            $"{files.Count} IL files; {stubs} DNGuard placeholders; original static IL export")
        {
            ExitCode = code,
            InputPath = path,
            ProtectedBodyCount = stubs,
            Partial = stubs > 0
        };
    }

    public async Task<DecompileResult> ExtractAutoItAsync(string path, string outDir, bool upxPacked, Action<string> log, CancellationToken token = default)
    {
        path = Path.GetFullPath(path);
        outDir = Path.Combine(Path.GetFullPath(outDir), Guid.NewGuid().ToString("N"));
        if (!_tools.HasAutoItRipper) return new DecompileResult(false, BinaryKind.AutoIt, outDir, 0, "autoit-ripper not installed");
        Directory.CreateDirectory(outDir);
        int count = await RunRipperAsync(path, outDir, log, token).ConfigureAwait(false);
        if (count == 0 && upxPacked && _tools.UpxExe is { } upx)
        {
            string unpacked = Path.Combine(outDir, Path.GetFileName(path) + UnpackedSuffix);
            log("No script found, unpacking UPX and retrying");
            int unpackCode = await ToolProcess.RunAsync(upx, new[] { "-d", "-o", unpacked, path }, log, outDir, token: token).ConfigureAwait(false);
            if (unpackCode == 0 && File.Exists(unpacked)) count = await RunRipperAsync(unpacked, outDir, log, token).ConfigureAwait(false);
        }
        return new DecompileResult(count > 0, BinaryKind.AutoIt, outDir, count, count > 0 ? $"{count} files extracted (.au3 script + embedded resources)" : "no AutoIt script found")
        {
            ExitCode = count > 0 ? 0 : -1
        };
    }

    private async Task<int> RunRipperAsync(string path, string outDir, Action<string> log, CancellationToken token)
    {
        var env = new Dictionary<string, string> { [PythonPathEnv] = _tools.AutoItRipperDir };
        if (!await _tools.ResolvePythonAsync(log, token).ConfigureAwait(false)) return 0;
        int code = await ToolProcess.RunAsync(_tools.PythonExe, new[] { "-c", RipperScript, path, outDir }, log, outDir, env, token).ConfigureAwait(false);
        bool scriptFound = Directory.EnumerateFiles(outDir, "*.au3", SearchOption.AllDirectories).Any(f => new FileInfo(f).Length > 0);
        return code == 0 && scriptFound ? Directory.EnumerateFiles(outDir, "*", SearchOption.AllDirectories).Count(f => !f.EndsWith(UnpackedSuffix, StringComparison.OrdinalIgnoreCase)) : 0;
    }

    private static int CountOccurrences(string text, string marker)
    {
        int n = 0;
        for (int i = text.IndexOf(marker, StringComparison.Ordinal); i >= 0; i = text.IndexOf(marker, i + marker.Length, StringComparison.Ordinal)) n++;
        return n;
    }
}
