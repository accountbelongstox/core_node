// PY-REF: none (DOT-only)
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace DotCore.Decompile;

public sealed record TtdJitTraceAnalysisReport(string TracePath, string OutputPath, int ExitCode,
    int CapturedCalls, int UniqueMethodTokens, int FailureCount);

public static class TtdJitTraceAnalyzer
{
    private const string ScriptResourceName = "DotCore.Decompile.Ttd.JitExtractorX64.js";

    public static async Task<TtdJitTraceAnalysisReport> AnalyzeAsync(string cdbPath, string tracePath,
        string targetModuleName, string outputPath, Action<string> log, CancellationToken token = default)
    {
        string fullCdbPath = Path.GetFullPath(cdbPath);
        string fullTracePath = Path.GetFullPath(tracePath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        string temporaryDirectory = Path.Combine(Path.GetTempPath(), "dotcore-ttd-" + Guid.NewGuid().ToString("N"));
        string scriptPath = Path.Combine(temporaryDirectory, "JitExtractorX64.js");
        string commandPath = Path.Combine(temporaryDirectory, "commands.txt");
        string script;
        string commands;
        int exitCode;
        int capturedCalls = 0;
        int uniqueMethodTokens = 0;
        int failureCount = 0;
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("TTD trace analysis requires Windows.");
        if (!File.Exists(fullCdbPath))
            throw new FileNotFoundException("The CDB executable was not found.", fullCdbPath);
        if (!File.Exists(fullTracePath))
            throw new FileNotFoundException("The TTD trace was not found.", fullTracePath);
        if (File.Exists(fullOutputPath))
            throw new IOException("The TTD extraction output already exists.");

        Directory.CreateDirectory(temporaryDirectory);
        Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath)!);
        try
        {
            script = LoadScriptTemplate()
                .Replace("__OUTPUT_PATH__", JsonSerializer.Serialize(fullOutputPath), StringComparison.Ordinal)
                .Replace("__TARGET_MODULE__", JsonSerializer.Serialize(targetModuleName.ToLowerInvariant()), StringComparison.Ordinal);
            commands = string.Join(Environment.NewLine,
                "!index",
                "!tt 100",
                ".symfix+",
                ".reload /f clrjit.dll",
                ".loadby sos clr",
                $".scriptrun \"{scriptPath}\"",
                "q",
                string.Empty);
            await File.WriteAllTextAsync(scriptPath, script, new UTF8Encoding(false), token).ConfigureAwait(false);
            await File.WriteAllTextAsync(commandPath, commands, new UTF8Encoding(false), token).ConfigureAwait(false);
            exitCode = await ToolProcess.RunAsync(fullCdbPath, new[] { "-z", fullTracePath, "-cf", commandPath },
                log, Path.GetDirectoryName(fullTracePath), token: token).ConfigureAwait(false);
            if (File.Exists(fullOutputPath))
            {
                using JsonDocument capture = JsonDocument.Parse(await File.ReadAllTextAsync(fullOutputPath, token).ConfigureAwait(false));
                JsonElement methods = capture.RootElement.GetProperty("ModulesInfo")[0].GetProperty("MethodsInfo");
                capturedCalls = methods.GetArrayLength();
                uniqueMethodTokens = methods.EnumerateArray().Select(method => method.GetProperty("MethodToken").GetUInt32()).Distinct().Count();
                failureCount = capture.RootElement.GetProperty("Failures").GetArrayLength();
            }
        }
        finally
        {
            if (File.Exists(scriptPath)) File.Delete(scriptPath);
            if (File.Exists(commandPath)) File.Delete(commandPath);
            if (Directory.Exists(temporaryDirectory)) Directory.Delete(temporaryDirectory);
        }
        return new TtdJitTraceAnalysisReport(fullTracePath, fullOutputPath, exitCode, capturedCalls,
            uniqueMethodTokens, failureCount);
    }

    private static string LoadScriptTemplate()
    {
        Assembly assembly = typeof(TtdJitTraceAnalyzer).Assembly;
        using Stream stream = assembly.GetManifestResourceStream(ScriptResourceName)
            ?? throw new InvalidOperationException("The embedded TTD JIT extraction script was not found.");
        using var reader = new StreamReader(stream, Encoding.UTF8, true);
        return reader.ReadToEnd();
    }
}
