// PY-REF: none (DOT-only)
using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>
/// HTTP GET helpers for public data files: GetStringAsync for live content, GetCachedAsync for large files kept on disk for maxAge
/// (atomic replace; when the download fails a stale cached copy is used, so tools keep working offline).
/// </summary>
public static class HttpFileCache
{
    private const string LogTag = "[HttpFileCache]";
    private const string UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) core_node";
    private const string TempSuffix = ".tmp";
    private static readonly HttpClient Client = CreateClient();

    public static Task<string> GetStringAsync(string url, CancellationToken ct = default) => Client.GetStringAsync(url, ct);

    /// <summary>Local path of url's content cached at cachePath; null when nothing could be downloaded and no cache exists.</summary>
    public static async Task<string?> GetCachedAsync(string url, string cachePath, TimeSpan maxAge, CancellationToken ct = default)
    {
        bool cached = File.Exists(cachePath);
        if (cached && DateTime.UtcNow - File.GetLastWriteTimeUtc(cachePath) < maxAge) return cachePath;
        try
        {
            Directory.CreateDirectory(Path.GetDirectoryName(Path.GetFullPath(cachePath))!);
            byte[] data = await Client.GetByteArrayAsync(url, ct).ConfigureAwait(false);
            string temp = cachePath + TempSuffix;
            await File.WriteAllBytesAsync(temp, data, ct).ConfigureAwait(false);
            File.Move(temp, cachePath, true);
            return cachePath;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or IOException)
        {
            ColorPrinter.Yellow($"{LogTag} {url} not downloaded ({ex.Message}){(cached ? ", using the cached copy" : "")}");
            return cached ? cachePath : null;
        }
    }

    private static HttpClient CreateClient()
    {
        var client = new HttpClient { Timeout = TimeSpan.FromSeconds(60) };
        client.DefaultRequestHeaders.UserAgent.ParseAdd(UserAgent);
        return client;
    }
}
