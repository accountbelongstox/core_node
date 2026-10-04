#nullable enable
// PY-REF: none (DOT-only)
using System.IO;
using System.Text.Json;
using DotCore.Decompile;

namespace DotApps.d3d4tester.Services;

public sealed record SourceRecoveryReport(string OutputDirectory, bool AllProtectedBodiesRecovered,
    int RecoveredProtectedMethods, int UnpackerExitCode, IReadOnlyList<DecompileResult> Sources)
{
    public int DiagnosticScanExitCode { get; init; } = -1;
    public int StructurallyValidCandidateMethods { get; init; }
    public int DynamicAcquisitionExitCode { get; init; } = -1;
    public int DynamicallyTransitionedMethods { get; init; }
    public int DynamicallyRecoveredProtectedMethods { get; init; }
    public string? DynamicCandidatePath { get; init; }
}

public static class RosbotSourceRecovery
{
    public const string ReportName = "recovery_report.json";
    public const string ToolFileName = "RosbotRecovery.dll";
    public const string DynamicCollectorFileName = "DnGuardDynamicCollector.exe";
    private const string DnGuardRuntimeType = "ZYXDNGuarder";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    public static async Task<SourceRecoveryReport> RunAsync(string executable, string outputRoot,
        DecompileTools tools, string recoveryTool, string dynamicCollector, Action<string> log,
        CancellationToken token = default)
    {
        string runDirectory = Path.Combine(Path.GetFullPath(outputRoot), "recovery", Guid.NewGuid().ToString("N"));
        string attemptDirectory = Path.Combine(runDirectory, "dnguard-attempt");
        string executableDirectory = Path.GetDirectoryName(Path.GetFullPath(executable))!;
        string copiedExecutable = Path.Combine(attemptDirectory, Path.GetFileName(executable));
        string candidate = Path.Combine(attemptDirectory, Path.GetFileNameWithoutExtension(executable) + "-NoDNG.exe");
        var results = new List<DecompileResult>();
        var runner = new DecompileRunner(tools);
        var before = ManagedAssemblyInspector.Inspect(executable);
        Action<string> originalLog = log;
        object logLock = new();
        int recovered = 0;
        int protectedMethodCount = before.Methods.Count(method => method.State == "DnGuardPlaceholder");
        int unpackerExitCode = -1;
        int diagnosticScanExitCode = -1;
        int candidateMethods = 0;
        int dynamicExitCode = -1;
        int dynamicTransitions = 0;
        int dynamicRecovered = 0;
        int dynamicAllProtectedRecovered = 0;
        string? dynamicCandidatePath = null;
        DecompileResult? staticRecoverySource = null;
        DecompileResult? dynamicRecoverySource = null;
        bool staticComplete;
        bool dynamicComplete;
        bool allProtectedBodiesRecovered;
        Directory.CreateDirectory(attemptDirectory);
        log = line =>
        {
            lock (logLock) File.AppendAllText(Path.Combine(runDirectory, "recovery.log"), line + Environment.NewLine);
            originalLog(line);
        };
        await File.WriteAllTextAsync(Path.Combine(attemptDirectory, "before_inventory.json"), JsonSerializer.Serialize(before, JsonOptions), token);
        results.Add(await runner.DecompileAsync(executable, Path.Combine(runDirectory, "main-static"), log, token));
        foreach (string library in Directory.EnumerateFiles(executableDirectory, "*.dll", SearchOption.AllDirectories))
        {
            token.ThrowIfCancellationRequested();
            if (BinaryInspector.Inspect(library).Kind != BinaryKind.Managed) continue;
            results.Add(await runner.DecompileAsync(library, Path.Combine(runDirectory, "libraries", Path.GetFileNameWithoutExtension(library)), log, token));
        }
        if (before.Methods.Any(method => method.State == "DnGuardPlaceholder") && File.Exists(recoveryTool))
        {
            File.Copy(executable, copiedExecutable);
            foreach (string runtime in new[] { "ucrtbase2.dll", "ucrtbasex.dll" })
            {
                string runtimePath = Path.Combine(executableDirectory, runtime);
                if (File.Exists(runtimePath)) File.Copy(runtimePath, Path.Combine(attemptDirectory, runtime));
            }
            using var timeout = CancellationTokenSource.CreateLinkedTokenSource(token);
            timeout.CancelAfter(TimeSpan.FromMinutes(5));
            unpackerExitCode = await ToolProcess.RunAsync(DecompileTools.DotnetExe(),
                new[] { recoveryTool, "--unpack", copiedExecutable, "--noninteractive", "--methods-only" }, log,
                attemptDirectory, new Dictionary<string, string> { ["DNG_TARGET_ONLY"] = "0", ["DNG_SKIP_PROXY"] = "0" }, timeout.Token);
            if (unpackerExitCode != 0)
            {
                log("Starting full diagnostic scan; candidate IL will not be accepted as verified recovery.");
                diagnosticScanExitCode = await ToolProcess.RunAsync(DecompileTools.DotnetExe(),
                    new[] { recoveryTool, "--unpack", copiedExecutable, "--noninteractive", "--methods-only" }, log,
                    attemptDirectory, new Dictionary<string, string> { ["DNG_TARGET_ONLY"] = "0", ["DNG_SKIP_PROXY"] = "0", ["DNG_SCAN_METHODS"] = "1" }, timeout.Token);
                string candidateReport = Path.Combine(attemptDirectory, "candidate_methods.json");
                if (File.Exists(candidateReport))
                {
                    using var candidates = JsonDocument.Parse(await File.ReadAllTextAsync(candidateReport, token));
                    candidateMethods = candidates.RootElement.GetArrayLength();
                }
            }
            if (File.Exists(candidate))
            {
                var after = ManagedAssemblyInspector.Inspect(candidate);
                var afterByToken = after.Methods.ToDictionary(method => method.Token);
                recovered = before.Methods.Count(method => method.State == "DnGuardPlaceholder"
                    && afterByToken.TryGetValue(method.Token, out var restored) && restored.State == "StaticIL"
                    && restored.Type == method.Type && restored.Name == method.Name);
                await File.WriteAllTextAsync(Path.Combine(attemptDirectory, "after_inventory.json"), JsonSerializer.Serialize(after, JsonOptions), token);
                if (unpackerExitCode == 0 && recovered > 0)
                {
                    staticRecoverySource = await runner.DecompileAsync(candidate,
                        Path.Combine(runDirectory, "main-recovered"), log, token);
                    results.Add(staticRecoverySource);
                }
                else log("REJECTED unpacker output: no verified protected method recovery.");
            }
        }
        if (before.Methods.Any(method => method.State == "DnGuardPlaceholder") && File.Exists(dynamicCollector))
        {
            string dynamicAttemptDirectory = Path.Combine(runDirectory, "dynamic-attempt");
            string dynamicTargetDirectory = Path.Combine(dynamicAttemptDirectory, "target");
            string dynamicExecutable = Path.Combine(dynamicTargetDirectory, Path.GetFileName(executable));
            string dynamicCandidate = Path.Combine(dynamicAttemptDirectory,
                Path.GetFileNameWithoutExtension(executable) + "-Captured" + Path.GetExtension(executable));
            CopyDirectory(executableDirectory, dynamicTargetDirectory);
            using var dynamicTimeout = CancellationTokenSource.CreateLinkedTokenSource(token);
            dynamicTimeout.CancelAfter(TimeSpan.FromMinutes(15));
            log("Starting local runtime method acquisition from a complete target-directory copy.");
            RuntimeMethodAcquisitionReport dynamicReport = await RuntimeMethodAcquisitionRunner.RunAsync(
                dynamicCollector, dynamicExecutable, dynamicCandidate, RuntimeMethodCompilationMode.ForceJit,
                log, token: dynamicTimeout.Token);
            dynamicExitCode = dynamicReport.ExitCode;
            dynamicTransitions = dynamicReport.Transitions.Count;
            dynamicAllProtectedRecovered = dynamicReport.RecoveredProtectedMethods;
            dynamicRecovered = dynamicReport.Transitions.Count(transition =>
                transition.BeforeState == "DnGuardPlaceholder" && transition.AfterState == "StaticIL"
                && transition.Type != DnGuardRuntimeType);
            dynamicCandidatePath = dynamicReport.OutputPath;
            await File.WriteAllTextAsync(Path.Combine(dynamicAttemptDirectory, "dynamic_report.json"),
                JsonSerializer.Serialize(dynamicReport, JsonOptions), token);
            if (dynamicReport.OutputPath != null)
            {
                AssemblyInspection dynamicAfter = ManagedAssemblyInspector.Inspect(dynamicReport.OutputPath);
                await File.WriteAllTextAsync(Path.Combine(dynamicAttemptDirectory, "after_inventory.json"),
                    JsonSerializer.Serialize(dynamicAfter, JsonOptions), token);
            }
            if (dynamicExitCode == 0 && dynamicRecovered > 0 && dynamicReport.OutputPath != null)
            {
                dynamicRecoverySource = await runner.DecompileAsync(dynamicReport.OutputPath,
                    Path.Combine(runDirectory, "main-dynamic"), log, token);
                results.Add(dynamicRecoverySource);
            }
            else
                log("Runtime capture produced no non-runtime protected method bodies; candidate retained for diagnostics only.");
        }
        staticComplete = unpackerExitCode == 0 && recovered == protectedMethodCount
            && staticRecoverySource is { Ok: true, Partial: false };
        dynamicComplete = dynamicExitCode == 0 && dynamicAllProtectedRecovered == protectedMethodCount
            && dynamicRecoverySource is { Ok: true, Partial: false };
        allProtectedBodiesRecovered = staticComplete || dynamicComplete;
        var report = new SourceRecoveryReport(runDirectory, allProtectedBodiesRecovered,
            recovered, unpackerExitCode, results)
        {
            DiagnosticScanExitCode = diagnosticScanExitCode,
            StructurallyValidCandidateMethods = candidateMethods,
            DynamicAcquisitionExitCode = dynamicExitCode,
            DynamicallyTransitionedMethods = dynamicTransitions,
            DynamicallyRecoveredProtectedMethods = dynamicRecovered,
            DynamicCandidatePath = dynamicCandidatePath
        };
        await File.WriteAllTextAsync(Path.Combine(runDirectory, ReportName), JsonSerializer.Serialize(report, JsonOptions), token);
        log($"Recovery: static={recovered}, dynamic={dynamicAllProtectedRecovered} protected methods restored; complete={report.AllProtectedBodiesRecovered}; output={runDirectory}");
        return report;
    }

    private static void CopyDirectory(string sourceDirectory, string destinationDirectory)
    {
        string relativePath;
        string destinationPath;
        Directory.CreateDirectory(destinationDirectory);
        foreach (string sourcePath in Directory.EnumerateFiles(sourceDirectory, "*", SearchOption.AllDirectories))
        {
            relativePath = Path.GetRelativePath(sourceDirectory, sourcePath);
            destinationPath = Path.Combine(destinationDirectory, relativePath);
            Directory.CreateDirectory(Path.GetDirectoryName(destinationPath)!);
            File.Copy(sourcePath, destinationPath);
        }
    }
}
