using System.Collections.Generic;
using System.Diagnostics;
using System.Globalization;
using System.IO;

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
    private const string FileLogDateFormat = "yyyyMMdd";
    private const string FileLogLineTimeFormat = "yyyy-MM-dd HH:mm:ss.fff";
    private const string FileLogExtension = ".log";
    private static string? _fileLogDirectory;
    private static string _fileLogPrefix = "";

    /// <summary>
    /// Also append every line to a daily file "&lt;directory&gt;/&lt;prefix&gt;_yyyyMMdd.log" (timestamp + level), so events stay
    /// traceable after the fact (UI log tabs only exist while open). Files older than keepDays are deleted.
    /// </summary>
    public static void EnableFileLog(string directory, string filePrefix, int keepDays = 7)
    {
        try
        {
            Directory.CreateDirectory(directory);
            foreach (var old in Directory.EnumerateFiles(directory, filePrefix + "_*" + FileLogExtension))
                if (File.GetLastWriteTime(old) < DateTime.Now.AddDays(-keepDays)) File.Delete(old);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            Trace.WriteLine($"[ColorPrinter] file log disabled: {ex.Message}");
            return;
        }
        lock (Lock)
        {
            _fileLogDirectory = directory;
            _fileLogPrefix = filePrefix;
        }
    }

    private static void AppendFileLog(string message, string? logLevel)
    {
        lock (Lock)
        {
            if (_fileLogDirectory == null) return;
            var now = DateTime.Now;
            string path = Path.Combine(_fileLogDirectory, _fileLogPrefix + "_" + now.ToString(FileLogDateFormat, CultureInfo.InvariantCulture) + FileLogExtension);
            try
            {
                File.AppendAllText(path, $"{now.ToString(FileLogLineTimeFormat, CultureInfo.InvariantCulture)} [{logLevel ?? "INFO"}] {message}{Environment.NewLine}");
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                // a locked or full disk must never break logging callers
            }
        }
    }

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
        AppendFileLog(message, logLevel);
        NotifyCallbacks(message, colorType, logLevel);
    }

    /// <summary>Writes \r + message truncated to console width + padding, then notifies callbacks (gray stays gray, others white, DEBUG). 1:1 Python ColorPrint._write_refresh.</summary>
    private static void WriteRefresh(string message, string colorType)
    {
        message ??= "";
        try
        {
            if (!Console.IsOutputRedirected)
            {
                int width = Math.Max(1, Console.WindowWidth);
                string plain = message.Length <= width ? message : message[..(width - 1)];
                Console.Write("\r" + plain + new string(' ', Math.Max(0, width - plain.Length)));
                Console.Out.Flush();
            }
        }
        catch
        {
            // no console attached
        }
        NotifyCallbacks(message, colorType == "gray" ? "gray" : "white", "DEBUG");
    }

    public static void Green(string message)   { Write(message, "green", "SUCCESS"); }
    public static void Red(string message)     { Write(message, "red", "ERROR"); }
    public static void Yellow(string message)  { Write(message, "yellow", "WARNING"); }
    public static void Blue(string message)    { Write(message, "blue", "INFO"); }
    public static void Gray(string message)    { Write(message, "gray", "DEBUG"); }
    public static void White(string message)   { Write(message, "white", "INFO"); }
    public static void Cyan(string message)    { Write(message, "cyan", "INFO"); }
    public static void Debug(string message)   { Write(message, "gray", "DEBUG"); }

    /// <summary>Gray text on the same console line (overwrite previous content). No newline. 1:1 Python ColorPrint.gray_refresh.</summary>
    public static void GrayRefresh(string message) { WriteRefresh(message, "gray"); }

    /// <summary>Same-line (overwrite) output in the given color type. 1:1 Python ColorPrint.refresh_line.</summary>
    public static void RefreshLine(string message, string colorType = "gray") { WriteRefresh(message, colorType); }

    public static void Info(string message)    => Blue(message);
    public static void Warn(string message)    => Yellow(message);
    public static void Error(string message)   => Red(message);
    public static void Success(string message) => Green(message);
}
