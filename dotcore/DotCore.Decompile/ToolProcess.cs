// PY-REF: none (DOT-only)
using System.Diagnostics;

namespace DotCore.Decompile;

/// <summary>Run an external tool, stream stdout/stderr lines to the log callback, return the exit code (-1 when it could not start).</summary>
public static class ToolProcess
{
    public static async Task<int> RunAsync(string fileName, IEnumerable<string> args, Action<string> log, string? workingDir = null,
        IReadOnlyDictionary<string, string>? env = null, CancellationToken token = default)
    {
        var psi = new ProcessStartInfo
        {
            FileName = fileName,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            CreateNoWindow = true,
            WorkingDirectory = workingDir ?? "",
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        if (env != null)
            foreach (var kv in env) psi.Environment[kv.Key] = kv.Value;
        try
        {
            using var p = new Process { StartInfo = psi };
            p.OutputDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) log(e.Data); };
            p.ErrorDataReceived += (_, e) => { if (!string.IsNullOrWhiteSpace(e.Data)) log(e.Data); };
            p.Start();
            p.BeginOutputReadLine();
            p.BeginErrorReadLine();
            try
            {
                await p.WaitForExitAsync(token).ConfigureAwait(false);
                p.WaitForExit();
            }
            catch (OperationCanceledException)
            {
                if (!p.HasExited) p.Kill(entireProcessTree: true);
                await p.WaitForExitAsync(CancellationToken.None).ConfigureAwait(false);
                throw;
            }
            return p.ExitCode;
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            log($"{Path.GetFileName(fileName)}: {ex.Message}");
            return -1;
        }
    }
}
