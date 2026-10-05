using System.Diagnostics;
using System.Text;

namespace DotCore.YoloTrain;

/// <summary>Runs a short external command and captures its output (environment probes).</summary>
internal static class ProcessCapture
{
    public sealed record Result(int ExitCode, string StdOut, string StdErr, bool TimedOut, string? StartError);

    public static async Task<Result> RunAsync(string fileName, IEnumerable<string> args, TimeSpan timeout, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = Encoding.UTF8,
            StandardErrorEncoding = Encoding.UTF8,
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        psi.Environment["PYTHONIOENCODING"] = "utf-8";
        Process? process;
        try
        {
            process = Process.Start(psi);
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException or IOException)
        {
            return new Result(-1, "", "", false, ex.Message);
        }
        if (process == null) return new Result(-1, "", "", false, fileName);
        using (process)
        {
            var stdout = process.StandardOutput.ReadToEndAsync(ct);
            var stderr = process.StandardError.ReadToEndAsync(ct);
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            timeoutCts.CancelAfter(timeout);
            try
            {
                await process.WaitForExitAsync(timeoutCts.Token).ConfigureAwait(false);
            }
            catch (OperationCanceledException)
            {
                try { process.Kill(entireProcessTree: true); } catch (InvalidOperationException) { }
                ct.ThrowIfCancellationRequested();
                return new Result(-1, "", "", true, null);
            }
            return new Result(process.ExitCode, await stdout.ConfigureAwait(false), await stderr.ConfigureAwait(false), false, null);
        }
    }

    /// <summary>Full path of an executable found on PATH (Windows also tries PATHEXT), or null.</summary>
    public static string? FindOnPath(string name) => FindAllOnPath(name).FirstOrDefault();

    /// <summary>Every distinct PATH hit of an executable, in PATH order.</summary>
    public static IReadOnlyList<string> FindAllOnPath(string name)
    {
        if (Path.IsPathRooted(name)) return File.Exists(name) ? new[] { name } : Array.Empty<string>();
        var hits = new List<string>();
        var exts = OperatingSystem.IsWindows()
            ? (Environment.GetEnvironmentVariable("PATHEXT") ?? ".EXE;.CMD;.BAT").Split(';', StringSplitOptions.RemoveEmptyEntries).Prepend("")
            : new[] { "" };
        foreach (var dir in (Environment.GetEnvironmentVariable("PATH") ?? "").Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
        {
            foreach (var ext in exts)
            {
                try
                {
                    var candidate = Path.Combine(dir.Trim(), name + ext.ToLowerInvariant());
                    if (File.Exists(candidate))
                    {
                        var full = Path.GetFullPath(candidate);
                        if (!hits.Contains(full, OperatingSystem.IsWindows() ? StringComparer.OrdinalIgnoreCase : StringComparer.Ordinal)) hits.Add(full);
                        break;
                    }
                }
                catch (ArgumentException) { }
            }
        }
        return hits;
    }
}
