// PY-REF: none (DOT-only)
namespace DotCore.Decompile;

public enum RuntimeMethodCompilationMode
{
    ForceJit,
    PrepareMethod
}

public sealed record RuntimeMethodTransition(string Token, string Type, string Name, string BeforeState,
    string AfterState, int AfterIlSize);

public sealed record RuntimeMethodAcquisitionReport(string InputPath, string? OutputPath, int ExitCode,
    IReadOnlyList<RuntimeMethodTransition> Transitions)
{
    public int RecoveredProtectedMethods => Transitions.Count(transition =>
        transition.BeforeState == "DnGuardPlaceholder" && transition.AfterState == "StaticIL");
}

public static class RuntimeMethodAcquisitionRunner
{
    public static async Task<RuntimeMethodAcquisitionReport> RunAsync(string collectorPath, string targetPath,
        string outputPath, RuntimeMethodCompilationMode mode, Action<string> log, int? methodToken = null,
        CancellationToken token = default)
    {
        string fullCollectorPath = Path.GetFullPath(collectorPath);
        string fullTargetPath = Path.GetFullPath(targetPath);
        string fullOutputPath = Path.GetFullPath(outputPath);
        AssemblyInspection before;
        AssemblyInspection after;
        Dictionary<string, MethodInspection> afterByToken;
        List<RuntimeMethodTransition> transitions;
        List<string> arguments;
        int exitCode;
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("Runtime method acquisition requires Windows.");
        if (!File.Exists(fullCollectorPath))
            return new RuntimeMethodAcquisitionReport(fullTargetPath, null, -1, Array.Empty<RuntimeMethodTransition>());

        before = ManagedAssemblyInspector.Inspect(fullTargetPath);
        arguments = new List<string> { fullTargetPath, fullOutputPath };
        if (mode == RuntimeMethodCompilationMode.PrepareMethod)
            arguments.Add("--prepare");
        if (methodToken.HasValue)
        {
            arguments.Add("--token");
            arguments.Add($"0x{methodToken.Value:X8}");
        }

        exitCode = await ToolProcess.RunAsync(fullCollectorPath, arguments, log,
            Path.GetDirectoryName(fullTargetPath), token: token).ConfigureAwait(false);
        if (!File.Exists(fullOutputPath))
            return new RuntimeMethodAcquisitionReport(fullTargetPath, null, exitCode, Array.Empty<RuntimeMethodTransition>());

        after = ManagedAssemblyInspector.Inspect(fullOutputPath);
        afterByToken = after.Methods.ToDictionary(method => method.Token);
        transitions = before.Methods
            .Where(method => afterByToken.TryGetValue(method.Token, out MethodInspection? captured)
                && captured.Type == method.Type && captured.Name == method.Name && captured.State != method.State)
            .Select(method =>
            {
                MethodInspection captured = afterByToken[method.Token];
                return new RuntimeMethodTransition(method.Token, method.Type, method.Name, method.State,
                    captured.State, captured.IlSize);
            })
            .ToList();
        return new RuntimeMethodAcquisitionReport(fullTargetPath, fullOutputPath, exitCode, transitions);
    }
}
