namespace DotApps.d3check.Domain.Interfaces;

/// <summary>
/// Domain abstraction for persistent key-value config. No UI or file implementation details.
/// </summary>
public interface IConfigStore
{
    bool Exists();
    string? Get(string key);
    void Set(string key, string value);
}
