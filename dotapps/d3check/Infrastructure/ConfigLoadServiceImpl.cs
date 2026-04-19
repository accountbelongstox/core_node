using DotApps.d3check.ApplicationServices.Interfaces;
using DotApps.d3check.Domain.Interfaces;

namespace DotApps.d3check.Infrastructure;

/// <summary>
/// Infrastructure: implements Application IConfigLoadService using Domain IConfigStore.
/// </summary>
public sealed class ConfigLoadServiceImpl : IConfigLoadService
{
    private readonly IConfigStore _store;

    public ConfigLoadServiceImpl(IConfigStore store)
    {
        _store = store;
    }

    public void Load()
    {
        if (!_store.Exists())
            return;
        // Store may lazy-load on first Get; no-op here if file-backed.
    }

    public string? GetValue(string key) => _store.Get(key);
}
