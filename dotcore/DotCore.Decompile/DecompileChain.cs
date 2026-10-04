// PY-REF: none (DOT-only)
using System.Text.Json;

namespace DotCore.Decompile;

public sealed record DecompileChainReport(IReadOnlyDictionary<string, bool> Tools, IReadOnlyList<DecompileResult> Results)
{
    public bool Passed => Tools.Values.All(value => value) && Results.Count > 0 && Results.All(result => result.Ok && !result.Partial);
}

public static class DecompileChain
{
    public const string ReportFileName = "chain_report.json";

    public static async Task<DecompileChainReport> RunAsync(DecompileTools tools, IEnumerable<string> targets,
        string outputRoot, Action<string> log, CancellationToken token = default)
    {
        var results = new List<DecompileResult>();
        var runner = new DecompileRunner(tools);
        var checks = await tools.VerifyAsync(log, token).ConfigureAwait(false);
        var runRoot = Path.Combine(Path.GetFullPath(outputRoot), Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(runRoot);
        foreach (var target in targets.Distinct(StringComparer.OrdinalIgnoreCase))
        {
            token.ThrowIfCancellationRequested();
            try
            {
                results.Add(await runner.DecompileAsync(target,
                    Path.Combine(runRoot, Path.GetFileNameWithoutExtension(target)), log, token).ConfigureAwait(false));
                log($"CHECK {Path.GetFileName(target)}: {(results[^1].Partial ? "PARTIAL" : results[^1].Ok ? "PASS" : "FAIL")} {results[^1].Summary}");
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                results.Add(new DecompileResult(false, BinaryKind.Missing, runRoot, 0, ex.Message));
                log($"CHECK {Path.GetFileName(target)}: FAIL {ex.Message}");
            }
        }
        var report = new DecompileChainReport(checks, results);
        await File.WriteAllTextAsync(Path.Combine(runRoot, ReportFileName),
            JsonSerializer.Serialize(report, new JsonSerializerOptions { WriteIndented = true }), token).ConfigureAwait(false);
        log($"CHAIN {(report.Passed ? "PASS" : "INCOMPLETE")}: {Path.Combine(runRoot, ReportFileName)}");
        return report;
    }
}
