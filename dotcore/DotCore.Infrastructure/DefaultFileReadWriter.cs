namespace DotCore.Infrastructure;

/// <summary>
/// Default implementation of <see cref="IFileReadWriter"/> using BCL File APIs.
/// </summary>
public sealed class DefaultFileReadWriter : IFileReadWriter
{
    public string? ReadAllText(string filePath)
    {
        if (!File.Exists(filePath))
            return null;
        return File.ReadAllText(filePath);
    }

    public void WriteAllText(string filePath, string content)
    {
        string? dir = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
            Directory.CreateDirectory(dir);
        File.WriteAllText(filePath, content);
    }
}
