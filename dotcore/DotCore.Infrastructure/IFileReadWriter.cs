namespace DotCore.Infrastructure;

/// <summary>
/// Abstraction for reading and writing text files (e.g. config). Implementations in app or Infrastructure extensions.
/// </summary>
public interface IFileReadWriter
{
    /// <summary>
    /// Reads all text from the file at the given path. Returns null if file does not exist.
    /// </summary>
    string? ReadAllText(string filePath);

    /// <summary>
    /// Writes all text to the file at the given path. Overwrites if exists.
    /// </summary>
    void WriteAllText(string filePath, string content);
}
