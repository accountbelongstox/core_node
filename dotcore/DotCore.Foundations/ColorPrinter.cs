using System.Collections.Generic;
using System.Diagnostics;

namespace DotCore.Foundations;

/// <summary>
/// Colored/log-level print with callback registration. Logic 1:1 with Python pyfoundations color_print.ColorPrint.
/// Public library: no references to UI or app libraries. Only provides RegisterCallback/UnregisterCallback/ClearAllCallbacks.
/// Sub-apps (e.g. d3check) register a callback in their UI (e.g. LogPanel OnLoaded) to route output to the Log tab; unregister in OnUnloaded.
/// All dot log-style output should use ColorPrinter (Green, Red, Blue, etc.) so it is both traced and delivered to registered callbacks.
/// </summary>
public static class ColorPrinter
{
    /// <summary>Callback: (message, colorType, logLevel). colorType: green, red, yellow, blue, gray, white, cyan. logLevel: SUCCESS, ERROR, WARNING, DEBUG, INFO.</summary>
    public delegate void LogCallback(string message, string colorType, string? logLevel);

    private static readonly object Lock = new();
    private static readonly List<LogCallback> Callbacks = new();

    /// <summary>Register a callback for all ColorPrinter output. Same instance must be passed to UnregisterCallback.</summary>
    public static void RegisterCallback(LogCallback callback)
    {
        if (callback == null) return;
        lock (Lock)
        {
            if (!Callbacks.Contains(callback))
                Callbacks.Add(callback);
        }
    }

    /// <summary>Unregister a previously registered callback.</summary>
    public static void UnregisterCallback(LogCallback callback)
    {
        if (callback == null) return;
        lock (Lock)
            Callbacks.Remove(callback);
    }

    /// <summary>Remove all registered callbacks.</summary>
    public static void ClearAllCallbacks()
    {
        lock (Lock)
            Callbacks.Clear();
    }

    /// <summary>Number of registered callbacks.</summary>
    public static int CallbackCount
    {
        get { lock (Lock) return Callbacks.Count; }
    }

    private static void NotifyCallbacks(string message, string colorType, string? logLevel)
    {
        LogCallback[] copy;
        lock (Lock)
        {
            if (Callbacks.Count == 0) return;
            copy = Callbacks.ToArray();
        }
        foreach (var cb in copy)
        {
            try { cb(message, colorType, logLevel); }
            catch { /* ignore */ }
        }
    }

    private static void Write(string message, string colorType, string? logLevel)
    {
        Trace.WriteLine(message);
        NotifyCallbacks(message, colorType, logLevel);
    }

    public static void Green(string message)   { Write(message, "green", "SUCCESS"); }
    public static void Red(string message)     { Write(message, "red", "ERROR"); }
    public static void Yellow(string message)  { Write(message, "yellow", "WARNING"); }
    public static void Blue(string message)    { Write(message, "blue", "INFO"); }
    public static void Gray(string message)    { Write(message, "gray", "DEBUG"); }
    public static void White(string message)   { Write(message, "white", "INFO"); }
    public static void Cyan(string message)    { Write(message, "cyan", "INFO"); }
    public static void Debug(string message)   { Write(message, "gray", "DEBUG"); }

    public static void Info(string message)    => Blue(message);
    public static void Warn(string message)    => Yellow(message);
    public static void Error(string message)   => Red(message);
    public static void Success(string message) => Green(message);
}
