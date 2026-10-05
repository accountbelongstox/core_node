// PY-REF: none (DOT-only)
using System.IO;
using System.Windows.Media.Imaging;
using DotCore.VocAnnotatorUI;
using DotCore.YoloTaskSet;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>
/// Bounded thumbnail decoder for task-set resources: at most DecodeConcurrency decodes run at once, results are cached by
/// path + size + mtime (LRU, MaxEntries), and videos get their first frame.
/// </summary>
public sealed class TaskSetThumbnailCache
{
    public const int ThumbDecodeWidth = 96;
    private const int DecodeConcurrency = 4;
    private const int MaxEntries = 4000;

    private readonly SemaphoreSlim _gate = new(DecodeConcurrency, DecodeConcurrency);
    private readonly Dictionary<string, LinkedListNode<(string Key, BitmapSource? Image)>> _map = new(StringComparer.OrdinalIgnoreCase);
    private readonly LinkedList<(string Key, BitmapSource? Image)> _lru = new();
    private readonly object _sync = new();

    public static TaskSetThumbnailCache Shared { get; } = new();

    /// <summary>Thumbnail of an image or the first frame of a video; null when unreadable. Safe to call from the UI thread.</summary>
    public async Task<BitmapSource?> GetAsync(string path, bool isVideo, int decodeWidth = ThumbDecodeWidth)
    {
        var key = CacheKey(path, decodeWidth);
        if (key == null) return null;
        if (TryGet(key, out var cached)) return cached;
        await _gate.WaitAsync().ConfigureAwait(false);
        try
        {
            if (TryGet(key, out cached)) return cached;
            var image = await Task.Run(() => Decode(path, isVideo, decodeWidth)).ConfigureAwait(false);
            Put(key, image);
            return image;
        }
        finally
        {
            _gate.Release();
        }
    }

    private static BitmapSource? Decode(string path, bool isVideo, int decodeWidth)
    {
        if (!isVideo) return BitmapDecode.TryFromFile(path, decodeWidth);
        try
        {
            return VariantExtractor.LoadFramePng(path, 0) is { } png ? BitmapDecode.FromBytes(png, decodeWidth) : null;
        }
        catch (Exception ex) when (TaskSetUiErrors.IsHandled(ex))
        {
            return null;
        }
    }

    private static string? CacheKey(string path, int decodeWidth)
    {
        try
        {
            var info = new FileInfo(path);
            if (!info.Exists) return null;
            return string.Join("|", info.FullName, info.Length, info.LastWriteTimeUtc.Ticks, decodeWidth);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or ArgumentException or NotSupportedException)
        {
            return null;
        }
    }

    private bool TryGet(string key, out BitmapSource? image)
    {
        lock (_sync)
        {
            if (_map.TryGetValue(key, out var node))
            {
                _lru.Remove(node);
                _lru.AddFirst(node);
                image = node.Value.Image;
                return true;
            }
        }
        image = null;
        return false;
    }

    private void Put(string key, BitmapSource? image)
    {
        lock (_sync)
        {
            if (_map.ContainsKey(key)) return;
            _map[key] = _lru.AddFirst((key, image));
            while (_lru.Count > MaxEntries && _lru.Last is { } last)
            {
                _map.Remove(last.Value.Key);
                _lru.RemoveLast();
            }
        }
    }
}
