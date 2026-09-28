using System;
using System.Text.Json;
using System.Text.Json.Nodes;
using DotCore.Foundations;

namespace DotCore.Infrastructure;

/// <summary>
/// Config store: load/save JSON file, get/set value by key path (e.g. "ui_settings.window_geometry").
/// Logic 1:1 with Python config: load from file, safe get with default, set by path, optional queue save.
/// Thread-safe for get/set; uses lock. Save is synchronous; call QueueSave() to defer write (single pending save).
/// </summary>
public sealed class JsonKeyPathConfig
{
    private readonly IFileReadWriter _file;
    private readonly string _filePath;
    private readonly object _lock = new();
    private JsonObject? _root;
    private bool _savePending;

    public JsonKeyPathConfig(IFileReadWriter file, string filePath)
    {
        _file = Guard.NotNull(file);
        _filePath = Guard.NotNullOrWhiteSpace(filePath);
    }

    /// <summary>
    /// Loads config from file. If file does not exist or is invalid, starts with empty object. Returns true if file was read.
    /// </summary>
    public bool Load()
    {
        lock (_lock)
        {
            string? text = _file.ReadAllText(_filePath);
            if (string.IsNullOrWhiteSpace(text))
            {
                _root = new JsonObject();
                return false;
            }
            try
            {
                JsonNode? node = JsonSerializer.Deserialize<JsonNode>(text);
                _root = node?.AsObject() ?? new JsonObject();
                return true;
            }
            catch
            {
                _root = new JsonObject();
                return false;
            }
        }
    }

    /// <summary>
    /// Gets value by key path (e.g. "ui_settings.window_geometry"). Returns default if path missing or invalid.
    /// </summary>
    public T? GetValueSafe<T>(string keyPath, T? defaultValue = default)
    {
        lock (_lock)
        {
            EnsureRoot();
            JsonNode? node = GetNodeByPath(_root!, keyPath);
            if (node is null)
                return defaultValue;
            try
            {
                return node.GetValue<T>();
            }
            catch
            {
                return defaultValue;
            }
        }
    }

    /// <summary>
    /// Gets string by key path. Returns default if missing.
    /// </summary>
    public string? GetStringSafe(string keyPath, string? defaultValue = null)
    {
        return GetValueSafe<string>(keyPath, defaultValue);
    }

    /// <summary>
    /// Gets raw JSON string at key path (for debugging or custom deserialization). Returns null if path missing.
    /// </summary>
    public string? GetRawText(string keyPath)
    {
        lock (_lock)
        {
            EnsureRoot();
            JsonNode? node = GetNodeByPath(_root!, keyPath);
            return node?.ToJsonString();
        }
    }

    /// <summary>
    /// Sets value at key path. Creates nested objects as needed. Thread-safe.
    /// </summary>
    public void SetValue(string keyPath, object? value)
    {
        lock (_lock)
        {
            EnsureRoot();
            SetNodeByPath(_root!, keyPath, value);
            if (keyPath.Contains("credentials", StringComparison.OrdinalIgnoreCase))
                ColorPrinter.Gray($"[JsonKeyPathConfig] SetValue keyPath={keyPath}");
        }
    }

    /// <summary>
    /// Writes config to file immediately. Thread-safe.
    /// </summary>
    public void Save()
    {
        lock (_lock)
            SaveCore();
    }

    /// <summary>
    /// Marks save as pending. Call Save() or FlushPendingSave() to write. Logic 1:1 with Python queue_config_save (single coalesced write).
    /// </summary>
    public void QueueSave()
    {
        lock (_lock) { _savePending = true; }
    }

    /// <summary>
    /// If save was queued, writes to file now. Call from any thread; never holds lock across I/O. (No re-entrant lock: uses SaveCore inside lock.)
    /// </summary>
    public void FlushPendingSave()
    {
        lock (_lock)
        {
            if (!_savePending) return;
            SaveCore();
        }
    }

    /// <summary>
    /// Single place that writes _root to file. Must be called only while holding _lock. Clears _savePending.
    /// </summary>
    private void SaveCore()
    {
        EnsureRoot();
        string json = JsonSerializer.Serialize(_root, new JsonSerializerOptions { WriteIndented = true });
        _file.WriteAllText(_filePath, json);
        _savePending = false;
        ColorPrinter.Gray($"[JsonKeyPathConfig] Save path={_filePath} size={json.Length}");
    }

    public bool IsSavePending
    {
        get { lock (_lock) { return _savePending; } }
    }

    private void EnsureRoot()
    {
        _root ??= new JsonObject();
    }

    private static JsonNode? GetNodeByPath(JsonObject root, string keyPath)
    {
        string[] segments = keyPath.Split('.');
        JsonNode? current = root;
        foreach (string seg in segments)
        {
            if (string.IsNullOrEmpty(seg)) continue;
            if (current is JsonObject obj && obj.TryGetPropertyValue(seg, out JsonNode? next))
                current = next;
            else
                return null;
        }
        return current;
    }

    private static readonly JsonSerializerOptions SetValueOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = false
    };

    private static void SetNodeByPath(JsonObject root, string keyPath, object? value)
    {
        string[] segments = keyPath.Split('.');
        if (segments.Length == 0) return;
        JsonObject current = root;
        for (int i = 0; i < segments.Length - 1; i++)
        {
            string seg = segments[i];
            if (string.IsNullOrEmpty(seg)) continue;
            if (!current.TryGetPropertyValue(seg, out JsonNode? next) || next is not JsonObject nextObj)
            {
                nextObj = new JsonObject();
                current[seg] = nextObj;
            }
            current = nextObj;
        }
        string last = segments[^1];
        if (string.IsNullOrEmpty(last)) return;
        JsonNode? node = value is null ? null : JsonSerializer.SerializeToNode(value, SetValueOptions);
        current[last] = node;
    }
}
