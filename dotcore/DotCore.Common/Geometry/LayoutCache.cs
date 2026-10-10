// PY-REF: none (DOT-only)
using System.Collections.Concurrent;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DotCore.Common.Geometry;

/// <summary>
/// Screen positions learned once (template hits, OCR'd labels, icons), kept in reference units of a <see cref="ReferenceFrame"/> so
/// they hold for every window size; a position may be stored relative to an anchor found at run time (a dialog that may move, see
/// <see cref="RefRect.RelativeTo"/>). Keys are free text, by convention "area/sub/.../name". Thread-safe. Persisted as an indented
/// JSON file with sorted keys (diff-friendly, can be versioned with the code); a file measured on another frame is ignored.
/// </summary>
public sealed class LayoutCache
{
    /// <summary>Default tolerance (reference units) under which a re-learned position counts as unchanged.</summary>
    public const double DefaultTolerance = 2.0;
    private const int Decimals = 2;
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };

    private readonly ConcurrentDictionary<string, RefRect> _entries = new(StringComparer.Ordinal);
    private int _dirty;

    private LayoutCache(string path, ReferenceFrame frame)
    {
        FilePath = path;
        Frame = frame;
    }

    public string FilePath { get; }

    public ReferenceFrame Frame { get; }

    public int Count => _entries.Count;

    /// <summary>Why the file was not read (null when read or absent); the cache then starts empty and Save rewrites the file.</summary>
    public string? LoadError { get; private set; }

    /// <summary>Empty cache that is never read from disk (Save still writes FilePath).</summary>
    public static LayoutCache Empty(string path, ReferenceFrame frame) => new(path, frame);

    public static LayoutCache Load(string path, ReferenceFrame frame)
    {
        var cache = new LayoutCache(path, frame);
        try
        {
            if (!File.Exists(path)) return cache;
            var file = JsonSerializer.Deserialize<LayoutFile>(File.ReadAllText(path), JsonOptions);
            if (file?.Reference is not [var w, var h] || w != frame.Width || h != frame.Height || file.Mode != frame.Mode.ToString())
            {
                cache.LoadError = $"measured on another reference frame than {frame.Width}x{frame.Height} {frame.Mode}";
                return cache;
            }
            foreach (var (key, v) in file.Positions ?? new SortedDictionary<string, double[]>(StringComparer.Ordinal))
                if (v is [var x, var y, var rw, var rh]) cache._entries[key] = new RefRect(x, y, rw, rh);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            cache.LoadError = ex.Message;
        }
        return cache;
    }

    public bool TryGet(string key, out RefRect rect) => _entries.TryGetValue(key, out rect);

    public bool Contains(string key) => _entries.ContainsKey(key);

    /// <summary>Entries whose key starts with the prefix.</summary>
    public IReadOnlyList<KeyValuePair<string, RefRect>> WithPrefix(string prefix) =>
        _entries.Where(kv => kv.Key.StartsWith(prefix, StringComparison.Ordinal)).OrderBy(kv => kv.Key, StringComparer.Ordinal).ToList();

    /// <summary>Store a position; true when it is new or moved by more than the tolerance (then the file is due for saving).</summary>
    public bool Learn(string key, RefRect rect, double tolerance = DefaultTolerance)
    {
        bool changed = false;
        _entries.AddOrUpdate(key, _ => { changed = true; return rect; }, (_, old) =>
        {
            changed = !old.IsNear(rect, tolerance);
            return changed ? rect : old;
        });
        if (changed) Interlocked.Exchange(ref _dirty, 1);
        return changed;
    }

    public bool Forget(string key)
    {
        if (!_entries.TryRemove(key, out _)) return false;
        Interlocked.Exchange(ref _dirty, 1);
        return true;
    }

    /// <summary>Write the file when something changed (atomic replace); false when there was nothing to write. IO errors propagate.</summary>
    public bool Save()
    {
        if (Interlocked.Exchange(ref _dirty, 0) == 0) return false;
        var positions = new SortedDictionary<string, double[]>(StringComparer.Ordinal);
        foreach (var (key, r) in _entries)
            positions[key] = new[] { Math.Round(r.X, Decimals), Math.Round(r.Y, Decimals), Math.Round(r.Width, Decimals), Math.Round(r.Height, Decimals) };
        var file = new LayoutFile { Reference = new[] { Frame.Width, Frame.Height }, Mode = Frame.Mode.ToString(), Positions = positions };
        try
        {
            if (Path.GetDirectoryName(FilePath) is { Length: > 0 } dir) Directory.CreateDirectory(dir);
            string temp = FilePath + ".tmp";
            File.WriteAllText(temp, JsonSerializer.Serialize(file, JsonOptions) + Environment.NewLine);
            File.Move(temp, FilePath, true);
            return true;
        }
        catch
        {
            Interlocked.Exchange(ref _dirty, 1);
            throw;
        }
    }

    private sealed class LayoutFile
    {
        [JsonPropertyName("reference")] public double[]? Reference { get; set; }
        [JsonPropertyName("mode")] public string? Mode { get; set; }
        [JsonPropertyName("positions")] public SortedDictionary<string, double[]>? Positions { get; set; }
    }
}
