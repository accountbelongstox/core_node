// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.ApplicationServices.Interfaces;

/// <summary>
/// Application use-case: load and read app config. Depends on Domain (IConfigStore).
/// </summary>
public interface IConfigLoadService
{
    void Load();
    string? GetValue(string key);
}
