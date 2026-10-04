// PY-REF: none (DOT-only)
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace DotCore.Decompile;

public sealed record TtdHvmLocalAnalysisReport(string OutputPath, int ExitCode, int CapturedLocals,
    int Methods, int Failures);

public static class TtdHvmLocalAnalyzer
{
    private const string ScriptResourceName = "DotCore.Decompile.Ttd.HvmLocalTypeExtractorX64.js";

    public static async Task<TtdHvmLocalAnalysisReport> AnalyzeAsync(string cdbPath, string tracePath,
        ulong getArgTypeAddress, ulong getArgClassAddress, string helperReportPath, string contextReportPath,
        string outputPath, Action<string> log,
        CancellationToken token = default)
    {
        string fullCdbPath = Path.GetFullPath(cdbPath);
        string fullTracePath = Path.GetFullPath(tracePath);
        string fullHelperReportPath = Path.GetFullPath(helperReportPath);
        string fullContextReportPath = Path.GetFullPath(contextReportPath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        string temporaryDirectory = Path.Combine(Path.GetTempPath(), "dotcore-hvm-locals-" + Guid.NewGuid().ToString("N"));
        string scriptPath = Path.Combine(temporaryDirectory, "HvmLocalTypeExtractorX64.js");
        string commandPath = Path.Combine(temporaryDirectory, "commands.txt");
        string script;
        string commands;
        int exitCode;
        int capturedLocals = 0;
        int methods = 0;
        int failures = 0;
        object[] selectedRanges;

        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("TTD HVM local analysis requires Windows.");
        if (!File.Exists(fullCdbPath)) throw new FileNotFoundException("The CDB executable was not found.", fullCdbPath);
        if (!File.Exists(fullTracePath)) throw new FileNotFoundException("The TTD trace was not found.", fullTracePath);
        if (!File.Exists(fullHelperReportPath)) throw new FileNotFoundException("The HVM helper report was not found.", fullHelperReportPath);
        if (!File.Exists(fullContextReportPath)) throw new FileNotFoundException("The HVM context report was not found.", fullContextReportPath);
        if (File.Exists(fullOutputPath)) throw new IOException("The HVM local output already exists.");

        using (JsonDocument helperReport = JsonDocument.Parse(await File.ReadAllTextAsync(fullHelperReportPath, token).ConfigureAwait(false)))
        using (JsonDocument contextReport = JsonDocument.Parse(await File.ReadAllTextAsync(fullContextReportPath, token).ConfigureAwait(false)))
        {
            HashSet<int> indexes = contextReport.RootElement.GetProperty("Operands").EnumerateArray()
                .Select(item => item.GetProperty("JitCallIndex").GetInt32()).ToHashSet();
            selectedRanges = helperReport.RootElement.GetProperty("JitCalls").EnumerateArray()
                .Where(item => indexes.Contains(item.GetProperty("Index").GetInt32()))
                .Select(item => (object)new
                {
                    Index = item.GetProperty("Index").GetInt32(),
                    StartPosition = item.GetProperty("StartPosition").GetString(),
                    EndPosition = item.GetProperty("EndPosition").GetString()
                }).ToArray();
            methods = selectedRanges.Length;
        }

        Directory.CreateDirectory(temporaryDirectory);
        Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath)!);
        try
        {
            script = LoadScriptTemplate()
                .Replace("__OUTPUT_PATH__", JsonSerializer.Serialize(fullOutputPath), StringComparison.Ordinal)
                .Replace("__GET_ARG_TYPE_ADDRESS__", JsonSerializer.Serialize($"0x{getArgTypeAddress:X}"), StringComparison.Ordinal)
                .Replace("__GET_ARG_CLASS_ADDRESS__", JsonSerializer.Serialize($"0x{getArgClassAddress:X}"), StringComparison.Ordinal)
                .Replace("__JIT_RANGES__", JsonSerializer.Serialize(selectedRanges), StringComparison.Ordinal);
            commands = string.Join(Environment.NewLine, "!index", "!tt 100", ".reload /f clr.dll",
                ".reload /f clrjit.dll", $".scriptrun \"{scriptPath}\"", "q", string.Empty);
            await File.WriteAllTextAsync(scriptPath, script, new UTF8Encoding(false), token).ConfigureAwait(false);
            await File.WriteAllTextAsync(commandPath, commands, new UTF8Encoding(false), token).ConfigureAwait(false);
            exitCode = await ToolProcess.RunAsync(fullCdbPath, new[] { "-z", fullTracePath, "-cf", commandPath },
                log, Path.GetDirectoryName(fullTracePath), token: token).ConfigureAwait(false);
            if (File.Exists(fullOutputPath))
            {
                using JsonDocument output = JsonDocument.Parse(await File.ReadAllTextAsync(fullOutputPath, token).ConfigureAwait(false));
                capturedLocals = output.RootElement.GetProperty("Locals").GetArrayLength();
                failures = output.RootElement.GetProperty("Failures").GetArrayLength();
            }
        }
        finally
        {
            if (File.Exists(scriptPath)) File.Delete(scriptPath);
            if (File.Exists(commandPath)) File.Delete(commandPath);
            if (Directory.Exists(temporaryDirectory)) Directory.Delete(temporaryDirectory);
        }
        return new TtdHvmLocalAnalysisReport(fullOutputPath, exitCode, capturedLocals, methods, failures);
    }

    private static string LoadScriptTemplate()
    {
        Assembly assembly = typeof(TtdHvmLocalAnalyzer).Assembly;
        using Stream stream = assembly.GetManifestResourceStream(ScriptResourceName)
            ?? throw new InvalidOperationException("The embedded TTD HVM local extraction script was not found.");
        using var reader = new StreamReader(stream, Encoding.UTF8, true);
        return reader.ReadToEnd();
    }
}
