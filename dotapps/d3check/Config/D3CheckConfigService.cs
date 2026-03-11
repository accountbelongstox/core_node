using System;
using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;
using DotApps.d3check.Constants;
using DotCore.Foundations;
using DotCore.Infrastructure;

namespace DotApps.d3check.Config;

/// <summary>
/// D3Check app config: in-memory get/set + background write. File I/O never runs on UI thread during normal flow.
/// Contract: SetValueAsync = update memory + queue write (Task.Run(SaveWorker)); FlushPendingSave = write on current thread (use only on app exit).
/// </summary>
public sealed class D3CheckConfigService
{
    private readonly IFileReadWriter _file = new DefaultFileReadWriter();
    private readonly JsonKeyPathConfig _config;
    private readonly object _loadLock = new();
    private bool _initialized;
    private volatile bool _saveScheduled;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = true,
        Encoder = System.Text.Encodings.Web.JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    public static D3CheckConfigService Instance { get; } = new();

    private D3CheckConfigService()
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
                        bool merged = MergeTemplateIntoConfig(GetDefaultTemplate(), obj);
                        if (merged)
                        {
                            _file.WriteAllText(ConfigPaths.ConfigUserPath, obj.ToJsonString(_jsonOptions));
                            ColorPrinter.Gray("[Config] Load: merged template, wrote back.");
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
        if (_saveScheduled) return;
        _saveScheduled = true;
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

    /// <summary>Runs on thread pool; performs one coalesced write. Only path that does file I/O during normal operation.</summary>
    private void SaveWorker()
    {
        try
        {
            _config.FlushPendingSave();
            ConfigOptionsProvider.Reload();
        }
        finally
        {
            _saveScheduled = false;
        }
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

    private static JsonObject GetDefaultTemplate()
    {
        var o = new JsonObject
        {
            ["ui_settings"] = new JsonObject
            {
                ["window_geometry"] = AppConstants.DefaultWindowGeometry,
                ["app_icon"] = "",
                ["current_language"] = "en",
                ["skip_taskbar_win32_fix"] = false
            },
            ["macro_configs"] = new JsonObject
            {
                ["current_skill_config"] = "config1",
                ["skill_configs"] = new JsonObject
                {
                    ["config1"] = new JsonObject { ["skills"] = new JsonObject() },
                    ["config2"] = new JsonObject { ["skills"] = new JsonObject() },
                    ["config3"] = new JsonObject { ["skills"] = new JsonObject() },
                    ["config4"] = new JsonObject { ["skills"] = new JsonObject() }
                },
                ["auxiliary_config"] = new JsonObject
                {
                    ["macro_start_hotkey"] = "F2",
                    ["assistant_hotkey"] = "F3",
                    ["animation_speed"] = "Medium",
                    ["game_language"] = "English",
                    ["smart_pause"] = false
                }
            },
            ["ui_analysis"] = new JsonObject { ["bag_offset"] = "" },
            ["ros_settings"] = new JsonObject { ["ros_directory"] = "", ["auto_enable_latest_ros"] = true, ["battlenet_region_cache"] = "" },
            ["battlenet"] = new JsonObject { ["battlenet_path"] = "", ["timeout_restart"] = true },
            ["battlenet_asia_credentials"] = new JsonObject { ["email"] = "", ["password"] = "" },
            ["battlenet_cn_credentials"] = new JsonObject { ["email"] = "", ["password"] = "" },
            ["d3"] = new JsonObject { ["d3_path"] = "" },
            ["rosbot"] = new JsonObject
            {
                ["pickup_blood_shards"] = false,
                ["prevent_stuck"] = false,
                ["blue_portal_priority"] = false,
                ["smart_echo"] = false,
                ["smart_echo_wait_seconds"] = 15,
                ["startup"] = false,
                ["firstborn_blue_gate_reuse"] = false,
                ["test_mode"] = false,
                ["test_timeout_minutes"] = 30,
                ["timeout_minutes"] = 8
            },
            ["anti_stuck"] = new JsonObject { ["enabled"] = true },
            ["log_settings"] = new JsonObject
            {
                ["show_debug_logs"] = true,
                ["auto_scroll"] = true,
                ["log_level"] = "INFO"
            },
            ["coord_calibration"] = new JsonObject
            {
                ["client_type"] = AppConstants.ClientTypeBattlenet,
                ["yolo_data_root"] = "",
                ["yolo_current_project"] = "",
                ["yolo_project_list"] = new JsonArray()
            }
        };
        return o;
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
