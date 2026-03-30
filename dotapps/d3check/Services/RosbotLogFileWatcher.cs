using System.IO;
using System.Text;
using DotCore.Foundations;

namespace DotApps.d3check.Services;

/// <summary>
/// Watchdog-driven tail of logs.txt: enqueue complete lines to <see cref="RosbotLogLineBridge"/>.
/// 1:1 Python threads/log_monitor_thread (watch + poll fallback).
/// </summary>
public sealed class RosbotLogFileWatcher : IDisposable
{
    private readonly object _sync = new();
    private FileSystemWatcher? _watcher;
    private System.Timers.Timer? _pollTimer;
    private string? _path;
    private long _lastPosition;
    private DateTime _lastWriteUtc;
    private string _pendingPartial = "";
    private bool _initialized;
    private bool _disposed;

    public void Start(string filePath)
    {
        lock (_sync)
        {
            StopUnsafe();
            _path = filePath;
            if (string.IsNullOrWhiteSpace(_path))
                return;
            string? dir = Path.GetDirectoryName(Path.GetFullPath(_path));
            if (string.IsNullOrEmpty(dir) || !Directory.Exists(dir))
            {
                ColorPrinter.Gray($"[LogMonitor] Logs directory missing: {dir}");
                return;
            }

            if (File.Exists(_path))
                ApplyPathUnsafe(_path);
            else
                ColorPrinter.Blue($"[LogMonitor] Log file not found yet (will tail when created): {_path}");

            try
            {
                _watcher = new FileSystemWatcher(dir)
                {
                    Filter = Path.GetFileName(_path),
                    NotifyFilter = NotifyFilters.LastWrite | NotifyFilters.Size | NotifyFilters.FileName,
                    EnableRaisingEvents = true
                };
                _watcher.Changed += OnWatcherEvent;
                _watcher.Created += OnWatcherEvent;
            }
            catch (Exception ex)
            {
                ColorPrinter.Gray($"[LogMonitor] FileSystemWatcher failed: {ex.Message}");
            }
            _pollTimer = new System.Timers.Timer(2000);
            _pollTimer.Elapsed += (_, _) => PollMtime();
            _pollTimer.AutoReset = true;
            _pollTimer.Start();
        }
    }

    public void Stop()
    {
        lock (_sync)
            StopUnsafe();
    }

    private void StopUnsafe()
    {
        _pollTimer?.Stop();
        _pollTimer?.Dispose();
        _pollTimer = null;
        if (_watcher != null)
        {
            try
            {
                _watcher.EnableRaisingEvents = false;
                _watcher.Changed -= OnWatcherEvent;
                _watcher.Created -= OnWatcherEvent;
                _watcher.Dispose();
            }
            catch { /* ignore */ }
            _watcher = null;
        }
        _path = null;
        _initialized = false;
        _lastPosition = 0;
        _pendingPartial = "";
    }

    private void OnWatcherEvent(object sender, FileSystemEventArgs e)
    {
        try
        {
            lock (_sync)
                ReadNewLinesUnsafe();
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray($"[LogMonitor] read error: {ex.Message}");
        }
    }

    private void PollMtime()
    {
        lock (_sync)
        {
            if (string.IsNullOrEmpty(_path)) return;
            if (!_initialized)
            {
                if (File.Exists(_path))
                    ApplyPathUnsafe(_path);
                return;
            }
            if (!File.Exists(_path)) return;
            try
            {
                var t = File.GetLastWriteTimeUtc(_path);
                if (t > _lastWriteUtc)
                    ReadNewLinesUnsafe();
            }
            catch { /* ignore */ }
        }
    }

    private void ApplyPathUnsafe(string filePath)
    {
        if (!File.Exists(filePath))
            return;
        _path = filePath;
        long len = new FileInfo(filePath).Length;
        _lastPosition = len;
        _lastWriteUtc = File.GetLastWriteTimeUtc(filePath);
        _pendingPartial = "";
        _initialized = true;
        ColorPrinter.Blue($"[LogMonitor] init path={filePath} (tail from EOF)");
    }

    private void ReadNewLinesUnsafe()
    {
        if (string.IsNullOrEmpty(_path))
            return;
        if (!_initialized)
        {
            if (!File.Exists(_path)) return;
            ApplyPathUnsafe(_path);
            return;
        }
        if (!File.Exists(_path))
            return;

        long size = new FileInfo(_path).Length;
        long pos = _lastPosition;
        if (size < pos)
            pos = 0;

        string newContent;
        try
        {
            using var fs = new FileStream(_path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            fs.Seek(pos, SeekOrigin.Begin);
            using var reader = new StreamReader(fs, Encoding.UTF8, true);
            newContent = reader.ReadToEnd();
            _lastPosition = fs.Position;
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray($"[LogMonitor] open/read failed: {ex.Message}");
            return;
        }

        try
        {
            _lastWriteUtc = File.GetLastWriteTimeUtc(_path);
        }
        catch { /* ignore */ }

        if (string.IsNullOrEmpty(newContent))
            return;

        var combined = _pendingPartial + newContent;
        int lastNl = combined.LastIndexOf('\n');
        if (lastNl < 0)
        {
            _pendingPartial = combined;
            return;
        }

        string emitPart = combined.Substring(0, lastNl + 1);
        _pendingPartial = combined.Substring(lastNl + 1);

        var lines = emitPart.Split('\n');
        foreach (var raw in lines)
        {
            var line = raw.TrimEnd('\r');
            if (!string.IsNullOrWhiteSpace(line))
                RosbotLogLineBridge.Enqueue(line);
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        Stop();
    }
}
