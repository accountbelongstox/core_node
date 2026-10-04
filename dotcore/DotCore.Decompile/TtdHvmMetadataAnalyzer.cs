// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text;
using System.Text.Json;

namespace DotCore.Decompile;

public sealed record HvmMethodHandleMetadata(string Handle, string Name, uint DefinitionToken,
    string ModuleHandle, string ModulePath);

public sealed record TtdHvmMetadataAnalysisReport(string OutputPath, int ExitCode,
    int MethodHandles, int ResolvedMethods, int Modules);

public static class TtdHvmMetadataAnalyzer
{
    public static async Task<TtdHvmMetadataAnalysisReport> AnalyzeAsync(string cdbPath, string tracePath,
        string helperReportPath, string outputPath, Action<string> log, CancellationToken token = default)
    {
        string fullCdbPath = Path.GetFullPath(cdbPath);
        string fullTracePath = Path.GetFullPath(tracePath);
        string fullHelperReportPath = Path.GetFullPath(helperReportPath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        string temporaryDirectory = Path.Combine(Path.GetTempPath(), "dotcore-hvm-metadata-" + Guid.NewGuid().ToString("N"));
        string methodCommandsPath = Path.Combine(temporaryDirectory, "methods.txt");
        string moduleCommandsPath = Path.Combine(temporaryDirectory, "modules.txt");
        string[] handles;
        List<string> methodOutput = new();
        List<string> moduleOutput = new();
        List<MutableMethodMetadata> methods;
        Dictionary<string, string> modules;
        int methodExitCode;
        int moduleExitCode = 0;
        int exitCode;

        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("TTD HVM metadata analysis requires Windows.");
        if (!File.Exists(fullCdbPath)) throw new FileNotFoundException("The CDB executable was not found.", fullCdbPath);
        if (!File.Exists(fullTracePath)) throw new FileNotFoundException("The TTD trace was not found.", fullTracePath);
        if (!File.Exists(fullHelperReportPath)) throw new FileNotFoundException("The HVM helper report was not found.", fullHelperReportPath);
        if (File.Exists(fullOutputPath)) throw new IOException("The HVM metadata output already exists.");

        using (JsonDocument helperReport = JsonDocument.Parse(
                   await File.ReadAllTextAsync(fullHelperReportPath, token).ConfigureAwait(false)))
        {
            handles = helperReport.RootElement.GetProperty("Calls").EnumerateArray()
                .Select(call => call.GetProperty("MethodHandle").GetString()!)
                .Where(handle => !string.Equals(handle, "0x0", StringComparison.OrdinalIgnoreCase))
                .Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
        }

        Directory.CreateDirectory(temporaryDirectory);
        Directory.CreateDirectory(Path.GetDirectoryName(fullOutputPath)!);
        try
        {
            await File.WriteAllTextAsync(methodCommandsPath, BuildMethodCommands(handles),
                new UTF8Encoding(false), token).ConfigureAwait(false);
            methodExitCode = await ToolProcess.RunAsync(fullCdbPath,
                new[] { "-z", fullTracePath, "-cf", methodCommandsPath },
                line => { methodOutput.Add(line); log(line); }, Path.GetDirectoryName(fullTracePath), token: token)
                .ConfigureAwait(false);
            methods = ParseMethods(methodOutput);
            string[] moduleHandles = methods.Select(method => method.ModuleHandle)
                .Where(handle => !string.IsNullOrEmpty(handle)).Distinct(StringComparer.OrdinalIgnoreCase).ToArray();
            if (moduleHandles.Length > 0)
            {
                await File.WriteAllTextAsync(moduleCommandsPath, BuildModuleCommands(moduleHandles),
                    new UTF8Encoding(false), token).ConfigureAwait(false);
                moduleExitCode = await ToolProcess.RunAsync(fullCdbPath,
                    new[] { "-z", fullTracePath, "-cf", moduleCommandsPath },
                    line => { moduleOutput.Add(line); log(line); }, Path.GetDirectoryName(fullTracePath), token: token)
                    .ConfigureAwait(false);
            }
            modules = ParseModules(moduleOutput);
            foreach (MutableMethodMetadata method in methods)
                if (modules.TryGetValue(method.ModuleHandle, out string? modulePath)) method.ModulePath = modulePath;
            exitCode = methodExitCode != 0 ? methodExitCode : moduleExitCode;
            await File.WriteAllTextAsync(fullOutputPath, JsonSerializer.Serialize(new
            {
                Methods = methods.Where(method => method.DefinitionToken != 0).Select(method =>
                    new HvmMethodHandleMetadata(method.Handle, method.Name, method.DefinitionToken,
                        method.ModuleHandle, method.ModulePath)),
                Failures = handles.Where(handle => methods.All(method =>
                    !string.Equals(method.Handle, handle, StringComparison.OrdinalIgnoreCase))).ToArray()
            }, new JsonSerializerOptions { WriteIndented = true }), token).ConfigureAwait(false);
            return new TtdHvmMetadataAnalysisReport(fullOutputPath, exitCode, handles.Length,
                methods.Count(method => method.DefinitionToken != 0), modules.Count);
        }
        finally
        {
            if (File.Exists(methodCommandsPath)) File.Delete(methodCommandsPath);
            if (File.Exists(moduleCommandsPath)) File.Delete(moduleCommandsPath);
            if (Directory.Exists(temporaryDirectory)) Directory.Delete(temporaryDirectory);
        }
    }

    private static string BuildMethodCommands(IEnumerable<string> handles)
    {
        List<string> commands = new() { "!index", "!tt 100", ".loadby sos clr" };
        foreach (string handle in handles)
        {
            commands.Add($".echo HVM_METHOD {handle}");
            commands.Add($"!dumpmd {handle.Substring(2)}");
        }
        commands.Add("q");
        return string.Join(Environment.NewLine, commands) + Environment.NewLine;
    }

    private static string BuildModuleCommands(IEnumerable<string> handles)
    {
        List<string> commands = new() { "!index", "!tt 100", ".loadby sos clr" };
        foreach (string handle in handles)
        {
            commands.Add($".echo HVM_MODULE {handle}");
            commands.Add($"!dumpmodule {handle.Substring(2)}");
        }
        commands.Add("q");
        return string.Join(Environment.NewLine, commands) + Environment.NewLine;
    }

    private static List<MutableMethodMetadata> ParseMethods(IEnumerable<string> lines)
    {
        List<MutableMethodMetadata> result = new();
        MutableMethodMetadata? current = null;
        foreach (string line in lines)
        {
            string trimmed = line.Trim();
            if (trimmed.StartsWith("HVM_METHOD ", StringComparison.Ordinal))
            {
                current = new MutableMethodMetadata { Handle = trimmed.Substring("HVM_METHOD ".Length) };
                result.Add(current);
            }
            else if (current != null && trimmed.StartsWith("Method Name:", StringComparison.Ordinal))
                current.Name = trimmed.Substring("Method Name:".Length).Trim();
            else if (current != null && trimmed.StartsWith("mdToken:", StringComparison.Ordinal))
                current.DefinitionToken = uint.Parse(trimmed.Substring("mdToken:".Length).Trim(),
                    NumberStyles.HexNumber, CultureInfo.InvariantCulture);
            else if (current != null && trimmed.StartsWith("Module:", StringComparison.Ordinal))
                current.ModuleHandle = NormalizePointer(trimmed.Substring("Module:".Length).Trim());
        }
        return result;
    }

    private static Dictionary<string, string> ParseModules(IEnumerable<string> lines)
    {
        Dictionary<string, string> result = new(StringComparer.OrdinalIgnoreCase);
        string current = string.Empty;
        foreach (string line in lines)
        {
            string trimmed = line.Trim();
            if (trimmed.StartsWith("HVM_MODULE ", StringComparison.Ordinal))
                current = NormalizePointer(trimmed.Substring("HVM_MODULE ".Length));
            else if (!string.IsNullOrEmpty(current) && trimmed.StartsWith("Name:", StringComparison.Ordinal))
                result[current] = trimmed.Substring("Name:".Length).Trim();
        }
        return result;
    }

    private static string NormalizePointer(string value)
    {
        string digits = value.Replace("`", string.Empty).Replace("0x", string.Empty).TrimStart('0');
        return "0x" + (digits.Length == 0 ? "0" : digits.ToLowerInvariant());
    }

    private sealed class MutableMethodMetadata
    {
        internal string Handle { get; set; } = string.Empty;
        internal string Name { get; set; } = string.Empty;
        internal uint DefinitionToken { get; set; }
        internal string ModuleHandle { get; set; } = string.Empty;
        internal string ModulePath { get; set; } = string.Empty;
    }
}
