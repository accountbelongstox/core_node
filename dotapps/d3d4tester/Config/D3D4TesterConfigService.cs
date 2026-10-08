// PY-REF: pyapps/d3-check/providor/providor_index.py
using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;
using DotCore.Infrastructure;

namespace DotApps.d3d4tester.Config;

/// <summary>
/// D3D4Tester app config: in-memory get/set + background write. File I/O never runs on UI thread during normal flow.
/// Contract: SetValueAsync = update memory + queue write (Task.Run(SaveWorker)); FlushPendingSave = write on current thread (use only on app exit).
/// </summary>
public sealed class D3D4TesterConfigService
{
    private readonly IFileReadWriter _file = new DefaultFileReadWriter();
    private readonly JsonKeyPathConfig _config;
    private readonly object _loadLock = new();
    private bool _initialized;
    private int _saveScheduled;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public const string DefaultConfigResourceName = "d3d4tester.default_config.json";

    public static D3D4TesterConfigService Instance { get; } = new();

    private D3D4TesterConfigService()
    {
        _config = new JsonKeyPathConfig(_file, ConfigPaths.ConfigUserPath);
    }

    /// <summary>Load config from file (or create from default and merge template). Call once at startup.</summary>
    public void Load(bool forceReload = false)
    {
        lock (_loadLock)
        {
            if (_initialized && !forceReload) return;
        ColorPrinter.Gray($"[Config] Load path={ConfigPaths.ConfigUserPath} exists={File.Exists(ConfigPaths.ConfigUserPath)}");
            EnsureUserDataDir();
            if (!File.Exists(ConfigPaths.ConfigUserPath))
            {
                ColorPrinter.Gray("[Config] Load: no file, writing default.");
                WriteDefaultConfigFile();
            }
            else
            {
                string? json = _file.ReadAllText(ConfigPaths.ConfigUserPath);
                if (!string.IsNullOrWhiteSpace(json))
                {
                    try
                    {
                        var obj = JsonNode.Parse(json) as JsonObject ?? new JsonObject();
                        bool migrated = MigrateLegacySchema(obj);
                        bool merged = MergeTemplateIntoConfig(GetDefaultTemplate(), obj);
                        if (migrated || merged)
                        {
                            _file.WriteAllText(ConfigPaths.ConfigUserPath, obj.ToJsonString(_jsonOptions));
                            ColorPrinter.Gray($"[Config] Load: migrated={migrated} merged={merged}, wrote back.");
                        }
                    }
                    catch (Exception ex) { ColorPrinter.Yellow("[Config] Load merge/write: " + ex.Message); }
                }
            }
            bool loaded = _config.Load();
        ColorPrinter.Gray($"[Config] Load _config.Load()={loaded}.");
            _initialized = true;
        }
    }

    /// <summary>Get value by dot path; returns default if missing. Thread-safe.</summary>
    public T? GetValueSafe<T>(string keyPath, T? defaultValue = default) => _config.GetValueSafe(keyPath, defaultValue);

    /// <summary>Gets raw JSON string at key path (for debugging or custom deserialization). Returns null if path missing.</summary>
    public string? GetRawText(string keyPath) => _config.GetRawText(keyPath);

    /// <summary>Set value by dot path (no save). Thread-safe.</summary>
    public bool SetValueSafe(string keyPath, object? value)
    {
        _config.SetValue(keyPath, value);
        return true;
    }

    /// <summary>Set value and queue one background save. Safe to call from UI; write runs on thread pool.</summary>
    public void SetValueAsync(string keyPath, object? value)
    {
        ColorPrinter.Gray($"[Config] SetValueAsync keyPath={keyPath} valueType={value?.GetType().Name ?? "null"}");
        _config.SetValue(keyPath, value);
        QueueSave();
    }

    /// <summary>Mark save pending and ensure background SaveWorker is running (one coalesced write).</summary>
    public void QueueSave()
    {
        _config.QueueSave();
        if (Interlocked.CompareExchange(ref _saveScheduled, 1, 0) != 0) return;
        Task.Run(SaveWorker);
    }

    /// <summary>Save config to file now.</summary>
    public void Save()
    {
        _config.Save();
    }

    /// <summary>If a save was queued, write to file on current thread. Do not call from UI during normal flow; use only on app exit so pending config is persisted.</summary>
    public void FlushPendingSave()
    {
        bool hadPending = _config.IsSavePending;
        _config.FlushPendingSave();
        if (hadPending)
            ColorPrinter.Gray($"[Config] FlushPendingSave done, path={ConfigPaths.ConfigUserPath}");
    }

    /// <summary>
    /// Runs on thread pool; coalesced writes until nothing is pending. Only path that does file I/O during normal operation.
    /// After clearing the flag it re-checks pending saves, so a QueueSave that saw the flag still set is never lost.
    /// </summary>
    private void SaveWorker()
    {
        bool failed = false;
        do
        {
            try
            {
                while (_config.IsSavePending)
                {
                    _config.FlushPendingSave();
                    ConfigOptionsProvider.Reload();
                }
            }
            catch (Exception ex)
            {
                failed = true;
                ColorPrinter.Yellow("[Config] Save failed: " + ex.Message);
            }
            finally
            {
                Interlocked.Exchange(ref _saveScheduled, 0);
            }
        }
        while (!failed && _config.IsSavePending && Interlocked.CompareExchange(ref _saveScheduled, 1, 0) == 0);
    }

    private static void EnsureUserDataDir()
    {
        var dir = ConfigPaths.CurrentUserDataPath;
        if (!Directory.Exists(dir))
            Directory.CreateDirectory(dir);
    }

    private void WriteDefaultConfigFile()
    {
        var template = GetDefaultTemplate();
        EnsureUserDataDir();
        _file.WriteAllText(ConfigPaths.ConfigUserPath, template.ToJsonString(_jsonOptions));
    }

    /// <summary>
    /// Default config shipped inside the app (Config/default_config.json, embedded): written as the user config on first run and
    /// merged into it (missing keys only) on every start, so the user config is the single source and code holds no defaults.
    /// </summary>
    private static JsonObject GetDefaultTemplate()
    {
        using var stream = typeof(D3D4TesterConfigService).Assembly.GetManifestResourceStream(DefaultConfigResourceName)
            ?? throw new InvalidOperationException($"Embedded default config missing: {DefaultConfigResourceName}");
        return JsonNode.Parse(stream) as JsonObject ?? new JsonObject();
    }

    /// <summary>
    /// One-time schema fix for files written by older C# builds: auxiliary feature bool -> {enabled: bool};
    /// bag_offset string "t,l,b,r" -> {top,left,bottom,right} ints. Keeps the Python d3-check schema.
    /// </summary>
    private static bool MigrateLegacySchema(JsonObject config)
    {
        bool modified = false;
        foreach (var sectionPath in ConfigKeys.AuxiliaryFeatureSections)
        {
            var parts = sectionPath.Split('.');
            if (GetObjectAtPath(config, parts[..^1]) is not JsonObject parent) continue;
            if (parent[parts[^1]] is JsonValue v && v.TryGetValue<bool>(out var enabled))
            {
                parent[parts[^1]] = new JsonObject { [ConfigKeys.AuxiliaryFeatureEnabledField] = enabled };
                modified = true;
            }
        }
        var bagParts = ConfigKeys.UiAnalysisBagOffset.Split('.');
        if (GetObjectAtPath(config, bagParts[..^1]) is JsonObject uiAnalysis
            && uiAnalysis[bagParts[^1]] is JsonValue bagValue && bagValue.TryGetValue<string>(out var raw))
        {
            var (t, l, b, r) = OffsetInputHelper.BagOffset.Parse(raw);
            uiAnalysis[bagParts[^1]] = new JsonObject { ["top"] = t, ["left"] = l, ["bottom"] = b, ["right"] = r };
            modified = true;
        }
        if (modified)
            ColorPrinter.Yellow("[Config] Migrated legacy auxiliary_config/bag_offset schema to Python dict schema.");
        return modified;
    }

    private static JsonObject? GetObjectAtPath(JsonObject root, string[] parts)
    {
        JsonObject? current = root;
        foreach (var part in parts)
        {
            current = current?[part] as JsonObject;
            if (current == null) return null;
        }
        return current;
    }

    private static bool MergeTemplateIntoConfig(JsonObject template, JsonObject config)
    {
        bool modified = false;
        foreach (var kv in template)
        {
            var key = kv.Key;
            var templateVal = kv.Value;
            if (!config.ContainsKey(key))
            {
                config[key] = templateVal == null ? null : JsonNode.Parse(templateVal.ToJsonString());
                modified = true;
            }
            else if (templateVal is JsonObject tObj && config[key] is JsonObject cObj)
            {
                if (MergeTemplateIntoConfig(tObj, cObj)) modified = true;
            }
        }
        return modified;
    }
}
