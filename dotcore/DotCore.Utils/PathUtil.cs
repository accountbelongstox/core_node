using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>
/// Path utilities: combine, normalize, ensure directory exists. Uses DotCore.Common for path conventions where needed.
/// </summary>
public static class PathUtil
{
    /// <summary>
    /// Combines path segments and returns full path (normalized). Throws if any segment is null or invalid.
    /// </summary>
    public static string CombineFull(params string[] segments)
    {
        Guard.NotNull(segments);
        if (segments.Length == 0)
            throw new ArgumentException("At least one segment required.", nameof(segments));
        string combined = Path.Combine(segments);
        return Path.GetFullPath(combined);
    }

    /// <summary>
    /// Ensures the directory exists; creates it if necessary. Returns the directory path.
    /// </summary>
    public static string EnsureDirectoryExists(string directoryPath)
    {
        Guard.NotNullOrWhiteSpace(directoryPath);
        string full = Path.GetFullPath(directoryPath);
        if (!Directory.Exists(full))
            Directory.CreateDirectory(full);
        return full;
    }
}
