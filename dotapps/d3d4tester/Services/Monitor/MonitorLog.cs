// PY-REF: none (DOT-only)
using System.Globalization;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>Monitor log (RBAssist WRITELOG): every line goes to ColorPrinter (day log file) and to a bounded buffer the Monitor page shows.</summary>
public static class MonitorLog
{
    public const string Tag = "[Monitor]";
    private const int MaxLines = 500;
    private const string TimeFormat = "HH:mm:ss";
    private static readonly object Lock = new();
    private static readonly LinkedList<string> Lines = new();

    /// <summary>Raised with each new formatted line (any thread).</summary>
    public static event Action<string>? LineAdded;

    public static void Info(string text) => Write(text, warn: false);

    public static void Warn(string text) => Write(text, warn: true);

    public static IReadOnlyList<string> Snapshot()
    {
        lock (Lock) return Lines.ToList();
    }

    public static void Clear()
    {
        lock (Lock) Lines.Clear();
    }

    private static void Write(string text, bool warn)
    {
        if (warn) ColorPrinter.Yellow($"{Tag} {text}");
        else ColorPrinter.Blue($"{Tag} {text}");
        string line = $"{DateTime.Now.ToString(TimeFormat, CultureInfo.InvariantCulture)} {text}";
        lock (Lock)
        {
            Lines.AddLast(line);
            while (Lines.Count > MaxLines) Lines.RemoveFirst();
        }
        try { LineAdded?.Invoke(line); }
        catch (Exception ex) { ColorPrinter.Gray($"{Tag} log listener: {ex.Message}"); }
    }
}
