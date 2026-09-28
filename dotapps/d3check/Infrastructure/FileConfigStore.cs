using System.IO;
using DotApps.d3check.Domain.Interfaces;
using DotCore.Infrastructure;

namespace DotApps.d3check.Infrastructure;

/// <summary>
/// Infrastructure: implements Domain IConfigStore using JSON file and DefaultFileReadWriter.
/// </summary>
public sealed class FileConfigStore : IConfigStore
{
    private readonly IFileReadWriter _file;
    private readonly string _path;
    private readonly object _lock = new();
    private System.Text.Json.Nodes.JsonObject? _root;

    public FileConfigStore(IFileReadWriter file, string path)
    {
        _file = file;
        _path = path;
    }

    public bool Exists() => File.Exists(_path);

    public string? Get(string key)
    {
        lock (_lock)
        {
            EnsureLoaded();
            return _root?[key]?.GetValue<string>();
        }
    }

    public void Set(string key, string value)
    {
        lock (_lock)
        {
            EnsureLoaded();
            if (_root != null)
            {
                _root[key] = value;
                _file.WriteAllText(_path, _root.ToJsonString());
            }
        }
    }

    private void EnsureLoaded()
    {
        if (_root != null) return;
        if (!File.Exists(_path))
        {
            _root = new System.Text.Json.Nodes.JsonObject();
            return;
        }
        var json = _file.ReadAllText(_path);
        _root = string.IsNullOrEmpty(json) ? new System.Text.Json.Nodes.JsonObject() : (System.Text.Json.Nodes.JsonNode.Parse(json) as System.Text.Json.Nodes.JsonObject ?? new System.Text.Json.Nodes.JsonObject());
    }
}
