using System.Text.Json;
using System.Text.Json.Nodes;

namespace DotCore.YoloRecord;

/// <summary>
/// GameAISDK record_cfg.json fields (Debug, FrameFPS, OutputAsVideo, LogTimestamp, FrameWidth, FrameHeight, RecordHttpPort).
/// 1:1 Python pyapps/d3-check/d3utils/yolo_record.py DEFAULT_RECORD_CONFIG / load_record_config / save_record_config.
/// </summary>
public sealed class YoloRecordConfig
{
    public const string FileName = "record_cfg.json";
    public const int DefaultHttpPort = 52808;
    public const int DefaultFrameFps = 10;
    public const int DefaultFrameWidth = 640;
    public const int DefaultFrameHeight = 360;
    public const int MinFrameFps = 1;
    public const int MaxFrameFps = 60;
    public const int MinFrameWidth = 160;
    public const int MaxFrameWidth = 3840;
    public const int MinFrameHeight = 90;
    public const int MaxFrameHeight = 2160;
    public const int MinHttpPort = 1024;
    public const int MaxHttpPort = 65535;

    public const string KeyDebug = "Debug";
    public const string KeyFrameFps = "FrameFPS";
    public const string KeyOutputAsVideo = "OutputAsVideo";
    public const string KeyLogTimestamp = "LogTimestamp";
    public const string KeyFrameWidth = "FrameWidth";
    public const string KeyFrameHeight = "FrameHeight";
    public const string KeyRecordHttpPort = "RecordHttpPort";

    public bool Debug { get; set; } = true;
    public int FrameFps { get; set; } = DefaultFrameFps;
    public bool OutputAsVideo { get; set; }
    public bool LogTimestamp { get; set; }
    public int FrameWidth { get; set; } = DefaultFrameWidth;
    public int FrameHeight { get; set; } = DefaultFrameHeight;
    public int RecordHttpPort { get; set; } = DefaultHttpPort;

    /// <summary>Port clamped to defaults when outside 1024..65535 (Python _on_yolo_record_start).</summary>
    public int EffectiveHttpPort => RecordHttpPort < MinHttpPort || RecordHttpPort > MaxHttpPort ? DefaultHttpPort : RecordHttpPort;

    /// <summary>Load: defaults overlaid with known keys from file; invalid file returns defaults.</summary>
    public static YoloRecordConfig Load(string path)
    {
        var cfg = new YoloRecordConfig();
        if (string.IsNullOrWhiteSpace(path) || !File.Exists(path))
            return cfg;
        try
        {
            if (JsonNode.Parse(File.ReadAllText(path)) is not JsonObject obj)
                return cfg;
            cfg.Debug = ReadBool(obj, KeyDebug, cfg.Debug);
            cfg.FrameFps = ReadInt(obj, KeyFrameFps, cfg.FrameFps);
            cfg.OutputAsVideo = ReadBool(obj, KeyOutputAsVideo, cfg.OutputAsVideo);
            cfg.LogTimestamp = ReadBool(obj, KeyLogTimestamp, cfg.LogTimestamp);
            cfg.FrameWidth = ReadInt(obj, KeyFrameWidth, cfg.FrameWidth);
            cfg.FrameHeight = ReadInt(obj, KeyFrameHeight, cfg.FrameHeight);
            cfg.RecordHttpPort = ReadInt(obj, KeyRecordHttpPort, cfg.RecordHttpPort);
        }
        catch (Exception ex) when (ex is IOException or JsonException or InvalidOperationException or FormatException)
        {
        }
        return cfg;
    }

    /// <summary>Save all seven keys. Returns (ok, error).</summary>
    public (bool Ok, string Error) Save(string path)
    {
        try
        {
            var dir = Path.GetDirectoryName(path);
            if (!string.IsNullOrEmpty(dir))
                Directory.CreateDirectory(dir);
            var obj = new JsonObject
            {
                [KeyDebug] = Debug,
                [KeyFrameFps] = FrameFps,
                [KeyOutputAsVideo] = OutputAsVideo,
                [KeyLogTimestamp] = LogTimestamp,
                [KeyFrameWidth] = FrameWidth,
                [KeyFrameHeight] = FrameHeight,
                [KeyRecordHttpPort] = RecordHttpPort,
            };
            var json = obj.ToJsonString(new JsonSerializerOptions { WriteIndented = true });
            File.WriteAllText(path, json);
            return (true, "");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    private static int ReadInt(JsonObject obj, string key, int fallback)
    {
        var node = obj[key];
        if (node is not JsonValue v) return fallback;
        if (v.TryGetValue<int>(out var i)) return i;
        if (v.TryGetValue<double>(out var d)) return (int)d;
        if (v.TryGetValue<string>(out var s) && int.TryParse(s.Trim(), out var p)) return p;
        return fallback;
    }

    private static bool ReadBool(JsonObject obj, string key, bool fallback)
    {
        var node = obj[key];
        if (node is not JsonValue v) return fallback;
        if (v.TryGetValue<bool>(out var b)) return b;
        if (v.TryGetValue<int>(out var i)) return i != 0;
        return fallback;
    }
}
