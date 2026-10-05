// PY-REF: none (DOT-only)
using DotCore.Foundations;

namespace DotCore.YoloDetect;

/// <summary>A session in the host. Idle = no lease holds it (kept for reuse up to MaxIdle).</summary>
public sealed record YoloLoadedModel(string ModelPath, DateTime ModelWriteUtc, YoloDetectorOptions Options, string ExecutionProvider,
    int References, bool Idle);

/// <summary>A reference to a shared detector; Dispose releases it (the detector itself must not be disposed by the holder).</summary>
public sealed class YoloModelLease : IDisposable
{
    private readonly YoloModelHost _host;
    private readonly object _entry;
    private int _released;

    internal YoloModelLease(YoloModelHost host, object entry, YoloOnnxDetector detector, DateTime modelWriteUtc)
    {
        _host = host;
        _entry = entry;
        Detector = detector;
        ModelWriteUtc = modelWriteUtc;
    }

    public YoloOnnxDetector Detector { get; }

    public string ModelPath => Detector.ModelPath;

    public DateTime ModelWriteUtc { get; }

    /// <summary>True when the model file was replaced (re-export) after this session loaded it; acquire again to reload.</summary>
    public bool IsStale => YoloModelHost.WriteTimeUtc(ModelPath) != ModelWriteUtc;

    public void Dispose()
    {
        if (Interlocked.Exchange(ref _released, 1) == 0) _host.Release(_entry);
    }
}

/// <summary>
/// Single runtime owner of YOLO ONNX sessions (one per model file + write time + options), shared by navigation,
/// auto-label and the model tester. It never chooses a model: callers pass a path or a resolver (e.g. the model registry).
/// </summary>
public sealed class YoloModelHost : IDisposable
{
    private const string LogTag = "[YoloModelHost]";
    private static readonly StringComparison PathComparison =
        OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal;

    private sealed class Entry
    {
        public required string Path;
        public required DateTime WriteUtc;
        public required YoloDetectorOptions Options;
        public required Lazy<YoloOnnxDetector> Detector;
        public int References;
        public long LastReleased;
    }

    private readonly object _gate = new();
    private readonly List<Entry> _entries = new();
    private long _releaseCounter;
    private bool _disposed;

    public static YoloModelHost Shared { get; } = new();

    /// <summary>Options for acquisitions that pass none (set once from config at startup).</summary>
    public YoloDetectorOptions DefaultOptions { get; set; } = YoloDetectorOptions.Default;

    /// <summary>Unreferenced sessions kept loaded for quick reuse; older idle ones are disposed.</summary>
    public int MaxIdle { get; set; } = 1;

    /// <summary>Raised after a session is loaded or unloaded (any thread).</summary>
    public event EventHandler? Changed;

    public IReadOnlyList<YoloLoadedModel> Loaded
    {
        get
        {
            lock (_gate)
            {
                return _entries
                    .Where(e => e.Detector.IsValueCreated)
                    .Select(e => new YoloLoadedModel(e.Path, e.WriteUtc, e.Options, e.Detector.Value.ExecutionProvider, e.References, e.References == 0))
                    .ToList();
            }
        }
    }

    /// <summary>Shared detector for the model file; loads it on first use. Throws FileNotFoundException when missing.</summary>
    public YoloModelLease Acquire(string modelPath, YoloDetectorOptions? options = null)
    {
        string path = Path.GetFullPath(modelPath);
        if (!File.Exists(path)) throw new FileNotFoundException(null, path);
        var opts = options ?? DefaultOptions;
        DateTime writeUtc = WriteTimeUtc(path);
        Entry entry;
        lock (_gate)
        {
            ObjectDisposedException.ThrowIf(_disposed, this);
            entry = _entries.FirstOrDefault(e => string.Equals(e.Path, path, PathComparison) && e.WriteUtc == writeUtc && e.Options == opts)
                ?? AddEntry(path, writeUtc, opts);
            entry.References++;
        }

        YoloOnnxDetector detector;
        try
        {
            detector = entry.Detector.Value;
        }
        catch
        {
            lock (_gate)
            {
                entry.References--;
                _entries.Remove(entry);
            }
            throw;
        }
        UnloadStale(path, writeUtc);
        return new YoloModelLease(this, entry, detector, writeUtc);
    }

    /// <summary>Acquire the path a resolver returns (e.g. the registry's current model for a consumer); null when it has none.</summary>
    public YoloModelLease? TryAcquire(Func<string?> resolveModelPath, YoloDetectorOptions? options = null)
    {
        string? path = resolveModelPath();
        return string.IsNullOrWhiteSpace(path) || !File.Exists(path) ? null : Acquire(path, options);
    }

    /// <summary>Disposes every idle session.</summary>
    public void Trim()
    {
        List<Entry> removed;
        lock (_gate)
        {
            removed = _entries.Where(e => e.References == 0).ToList();
            foreach (var e in removed) _entries.Remove(e);
        }
        DisposeEntries(removed);
    }

    public void Dispose()
    {
        List<Entry> all;
        lock (_gate)
        {
            _disposed = true;
            all = _entries.ToList();
            _entries.Clear();
        }
        DisposeEntries(all);
    }

    internal static DateTime WriteTimeUtc(string path) => File.Exists(path) ? File.GetLastWriteTimeUtc(path) : DateTime.MinValue;

    internal void Release(object token)
    {
        var entry = (Entry)token;
        var removed = new List<Entry>();
        lock (_gate)
        {
            entry.References--;
            if (entry.References > 0) return;
            entry.LastReleased = ++_releaseCounter;
            if (_disposed || WriteTimeUtc(entry.Path) != entry.WriteUtc) removed.Add(entry);
            var idle = _entries.Where(e => e.References == 0 && !removed.Contains(e)).OrderByDescending(e => e.LastReleased).ToList();
            removed.AddRange(idle.Skip(Math.Max(0, MaxIdle)));
            foreach (var e in removed) _entries.Remove(e);
        }
        DisposeEntries(removed);
    }

    private Entry AddEntry(string path, DateTime writeUtc, YoloDetectorOptions opts)
    {
        var entry = new Entry
        {
            Path = path,
            WriteUtc = writeUtc,
            Options = opts,
            Detector = new Lazy<YoloOnnxDetector>(() => LoadDetector(path, opts), LazyThreadSafetyMode.ExecutionAndPublication),
        };
        _entries.Add(entry);
        return entry;
    }

    private YoloOnnxDetector LoadDetector(string path, YoloDetectorOptions opts)
    {
        var detector = new YoloOnnxDetector(path, opts);
        ColorPrinter.Blue($"{LogTag} Shared session {Path.GetFileName(path)} ep={detector.ExecutionProvider}");
        Changed?.Invoke(this, EventArgs.Empty);
        return detector;
    }

    /// <summary>Unreferenced sessions of an older version of the same file.</summary>
    private void UnloadStale(string path, DateTime currentWriteUtc)
    {
        List<Entry> removed;
        lock (_gate)
        {
            removed = _entries
                .Where(e => e.References == 0 && string.Equals(e.Path, path, PathComparison) && e.WriteUtc != currentWriteUtc)
                .ToList();
            foreach (var e in removed) _entries.Remove(e);
        }
        DisposeEntries(removed);
    }

    private void DisposeEntries(List<Entry> entries)
    {
        if (entries.Count == 0) return;
        foreach (var e in entries.Where(e => e.Detector.IsValueCreated)) e.Detector.Value.Dispose();
        Changed?.Invoke(this, EventArgs.Empty);
    }
}
