// PY-REF: none (DOT-only)
using OpenCvSharp;

namespace DotCore.YoloTaskSet;

/// <summary>
/// Bounded LRU of decoded backgrounds shared read-only by parallel render jobs. A leased entry is never disposed;
/// the cache may exceed its capacity while more entries than that are leased.
/// </summary>
internal sealed class SynthesisBackgroundCache : IDisposable
{
    private readonly object _gate = new();
    private readonly int _capacity;
    private readonly int _maxSide;
    private readonly Dictionary<string, Entry> _entries = new(StringComparer.Ordinal);
    private readonly LinkedList<Entry> _lru = new();

    internal sealed class Entry
    {
        public required string Path { get; init; }
        public required Lazy<Mat?> Image { get; init; }
        public LinkedListNode<Entry>? Node { get; set; }
        public int Leases { get; set; }
    }

    public sealed class Lease : IDisposable
    {
        private readonly SynthesisBackgroundCache _owner;
        private readonly Entry _entry;
        private bool _released;

        internal Lease(SynthesisBackgroundCache owner, Entry entry, Mat image)
        {
            _owner = owner;
            _entry = entry;
            Image = image;
        }

        /// <summary>Shared decoded image: read only, never dispose.</summary>
        public Mat Image { get; }

        public void Dispose()
        {
            if (_released) return;
            _released = true;
            _owner.Release(_entry);
        }
    }

    /// <param name="maxSide">Decode downscale bound (0 = full resolution).</param>
    public SynthesisBackgroundCache(int capacity, int maxSide)
    {
        _capacity = Math.Max(1, capacity);
        _maxSide = maxSide;
    }

    /// <summary>Lease of the decoded background, or null when unreadable.</summary>
    public Lease? Acquire(string path)
    {
        Entry entry;
        lock (_gate)
        {
            if (!_entries.TryGetValue(path, out entry!))
            {
                entry = new Entry { Path = path, Image = new Lazy<Mat?>(() => TaskSetImageIo.ReadBgr(path, _maxSide)) };
                _entries[path] = entry;
            }
            else if (entry.Node != null)
            {
                _lru.Remove(entry.Node);
            }
            entry.Node = _lru.AddFirst(entry);
            entry.Leases++;
        }
        var image = entry.Image.Value;
        if (image != null) return new Lease(this, entry, image);
        Release(entry);
        return null;
    }

    private void Release(Entry entry)
    {
        lock (_gate)
        {
            entry.Leases--;
            Trim();
        }
    }

    private void Trim()
    {
        var node = _lru.Last;
        while (_entries.Count > _capacity && node != null)
        {
            var prev = node.Previous;
            var e = node.Value;
            if (e.Leases == 0)
            {
                _lru.Remove(node);
                _entries.Remove(e.Path);
                if (e.Image.IsValueCreated) e.Image.Value?.Dispose();
            }
            node = prev;
        }
    }

    public void Dispose()
    {
        lock (_gate)
        {
            foreach (var e in _entries.Values)
                if (e.Image.IsValueCreated) e.Image.Value?.Dispose();
            _entries.Clear();
            _lru.Clear();
        }
    }
}
