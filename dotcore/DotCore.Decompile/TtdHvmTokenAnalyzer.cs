// PY-REF: none (DOT-only)
using System.Reflection;
using System.Text;
using System.Text.Json;

namespace DotCore.Decompile;

public sealed record TtdHvmTokenAnalysisReport(string TracePath, string OutputPath, int ExitCode,
    int CapturedCalls, int UniqueVirtualTokens, int FailureCount);

public static class TtdHvmTokenAnalyzer
{
    private const string ScriptResourceName = "DotCore.Decompile.Ttd.HvmTokenExtractorX64.js";

    public static async Task<TtdHvmTokenAnalysisReport> AnalyzeAsync(string cdbPath, string tracePath,
        ulong helperAddress, string outputPath, Action<string> log, CancellationToken token = default)
    {
        string fullCdbPath = Path.GetFullPath(cdbPath);
        string fullTracePath = Path.GetFullPath(tracePath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        string temporaryDirectory = Path.Combine(Path.GetTempPath(), "dotcore-hvm-ttd-" + Guid.NewGuid().ToString("N"));
        string scriptPath = Path.Combine(temporaryDirectory, "HvmTokenExtractorX64.js");
        string commandPath = Path.Combine(temporaryDirectory, "commands.txt");
        string script;
        string commands;
        int exitCode;
        int capturedCalls = 0;
        int uniqueVirtualTokens = 0;
        int failureCount = 0;
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("TTD HVM token analysis requires Windows.");
        if (!File.Exists(fullCdbPath))
            throw new FileNotFoundException("The CDB executable was not found.", fullCdbPath);
        if (!File.Exists(fullTracePath))
            throw new FileNotFoundException("The TTD trace was not found.", fullTracePath);
        if (File.Exists(fullOutputPath))
            throw new IOException("The TTD HVM token output already exists.");

        Directory.CreateDirectory(temporaryDirectory);
        Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath)!);
        try
        {
            script = LoadScriptTemplate()
                .Replace("__OUTPUT_PATH__", JsonSerializer.Serialize(fullOutputPath), StringComparison.Ordinal)
                .Replace("__HELPER_ADDRESS__", JsonSerializer.Serialize($"0x{helperAddress:X}"), StringComparison.Ordinal);
            commands = string.Join(Environment.NewLine,
                "!index",
                "!tt 100",
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
                JsonElement calls = capture.RootElement.GetProperty("Calls");
                capturedCalls = calls.GetArrayLength();
                uniqueVirtualTokens = calls.EnumerateArray()
                    .Select(call => call.GetProperty("VirtualToken").GetUInt32()).Distinct().Count();
                failureCount = capture.RootElement.GetProperty("Failures").GetArrayLength();
            }
        }
        finally
        {
            if (File.Exists(scriptPath)) File.Delete(scriptPath);
            if (File.Exists(commandPath)) File.Delete(commandPath);
            if (Directory.Exists(temporaryDirectory)) Directory.Delete(temporaryDirectory);
        }
        return new TtdHvmTokenAnalysisReport(fullTracePath, fullOutputPath, exitCode, capturedCalls,
            uniqueVirtualTokens, failureCount);
    }

    private static string LoadScriptTemplate()
    {
        Assembly assembly = typeof(TtdHvmTokenAnalyzer).Assembly;
        using Stream stream = assembly.GetManifestResourceStream(ScriptResourceName)
            ?? throw new InvalidOperationException("The embedded TTD HVM token extraction script was not found.");
        using var reader = new StreamReader(stream, Encoding.UTF8, true);
        return reader.ReadToEnd();
    }
}
