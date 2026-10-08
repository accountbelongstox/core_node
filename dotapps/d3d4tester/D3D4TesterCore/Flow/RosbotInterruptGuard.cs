// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// ROSBOT leaves the game ("Abnormal situation, exit game") when its pause / stop key arrives while it is starting a task ("Running:
/// &lt;task&gt;" not yet followed by task progress). Before such a key, WaitSafe reads the tail of ROSBOT's logs.txt directly (the app's
/// log watcher lags seconds behind) and waits while the newest task line is a start younger than StartWindowSec.
/// </summary>
public static class RosbotInterruptGuard
{
    private const string LogTag = "[RosbotGuard]";
    private const int TailBytes = 16384;
    private const int StartWindowSec = 20;
    private const int PollMs = 500;
    private const string TimestampFormat = "yyyy-MM-dd HH:mm:ss,fff";

    /// <summary>Lines that start a task: the interrupt-sensitive phase.</summary>
    private static readonly string[] StartMarkers = { "Running: ", "Start a loop", "Botting !" };

    /// <summary>Lines that show the task (or the town loop) under way: an interrupt is handled cleanly.</summary>
    private static readonly string[] ProgressMarkers = { "Vendor loop", "Open Rift Success", "Objective ", "Dead", "CancelRequested => True" };

    /// <summary>Set by the app: path of ROSBOT's logs.txt.</summary>
    public static Func<string?>? LogPathProvider { get; set; }

    /// <summary>Wait until ROSBOT is not starting a task (true), or false after maxWaitMs / when cancelled.</summary>
    public static bool WaitSafe(string actor, int maxWaitMs, Func<bool>? cancel = null)
    {
        var waited = System.Diagnostics.Stopwatch.StartNew();
        bool logged = false;
        while (StartingTask() is { } line)
        {
            if (waited.ElapsedMilliseconds >= maxWaitMs || cancel?.Invoke() == true)
            {
                ColorPrinter.Yellow($"{LogTag} {actor}: ROSBOT still starting a task after {waited.ElapsedMilliseconds / 1000}s ({line})");
                return false;
            }
            if (!logged) ColorPrinter.Yellow($"{LogTag} {actor}: ROSBOT is starting a task ({line}), key held back so it does not leave the game");
            logged = true;
            Thread.Sleep(PollMs);
        }
        if (logged) ColorPrinter.Green($"{LogTag} {actor}: task under way after {waited.ElapsedMilliseconds / 1000.0:0.0}s, key may be sent");
        return true;
    }

    /// <summary>The newest task-start line when it is fresh and nothing showed progress since, else null.</summary>
    private static string? StartingTask()
    {
        string? path = LogPathProvider?.Invoke();
        if (string.IsNullOrEmpty(path) || !File.Exists(path)) return null;
        string[] lines;
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            long start = Math.Max(0, stream.Length - TailBytes);
            stream.Seek(start, SeekOrigin.Begin);
            using var reader = new StreamReader(stream, Encoding.UTF8);
            lines = reader.ReadToEnd().Split('\n');
        }
        catch (IOException)
        {
            return null;
        }
        for (int i = lines.Length - 1; i >= 0; i--)
        {
            string line = lines[i].TrimEnd('\r');
            if (line.Length < TimestampFormat.Length || !DateTime.TryParseExact(line[..TimestampFormat.Length], TimestampFormat,
                    CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out var at))
                continue;
            if (ProgressMarkers.Any(m => line.Contains(m, StringComparison.Ordinal))) return null;
            if (StartMarkers.Any(m => line.Contains(m, StringComparison.Ordinal)))
                return (DateTime.Now - at).TotalSeconds < StartWindowSec ? line[TimestampFormat.Length..].Trim() : null;
        }
        return null;
    }
}
