// PY-REF: none (DOT-only)
using System.Text.Json.Nodes;
using OpenCvSharp;

namespace DotCore.YoloDetect;

/// <summary>How the model was trained: Relative = objects scaled with the whole frame; Native = objects at screen pixel size.</summary>
public enum YoloScaleMode { Relative, Native }

/// <summary>Execution provider request; anything unavailable falls back to CPU without error.</summary>
public enum YoloExecutionProvider { Cpu, Auto, Cuda, DirectML }

/// <summary>Detector session settings. IntraOpThreads 0 = runtime default; WarmUp runs one blank inference at load.</summary>
public sealed record YoloDetectorOptions(
    YoloExecutionProvider Provider = YoloExecutionProvider.Cpu,
    int IntraOpThreads = 0,
    bool WarmUp = true,
    int DeviceId = 0)
{
    public static YoloDetectorOptions Default { get; } = new();

    /// <summary>Parses a config value ("cpu", "auto", "cuda", "directml"); unknown or empty = Cpu.</summary>
    public static YoloExecutionProvider ParseProvider(string? value) =>
        Enum.TryParse(value, true, out YoloExecutionProvider provider) ? provider : YoloExecutionProvider.Cpu;
}

/// <summary>
/// Inference contract of a trained model (design §11). Tile size 0 = model input size; TileOverlap &lt; 0 = a quarter of the
/// smaller tile side (should be at least 2 x the largest object side). Roi is in image pixels: a negative X / Y is an
/// offset from the right / bottom edge, Width / Height &lt;= 0 extends to the edge (bottom 48 px band = (0, -48, 0, 48)).
/// </summary>
public sealed record YoloInferenceProfile(
    YoloScaleMode ScaleMode = YoloScaleMode.Relative,
    int TileWidth = 0,
    int TileHeight = 0,
    int TileOverlap = -1,
    Rect? Roi = null,
    float Confidence = 0.35f,
    float Iou = 0.45f)
{
    private const string KeyScaleMode = "scale_mode";
    private const string KeyWindowWidth = "window_width";
    private const string KeyWindowHeight = "window_height";
    private const string KeyTileOverlap = "tile_overlap";
    private const string KeyRoiHint = "roi_hint";
    private const string KeyAnchor = "anchor";
    private const string KeyBandPixels = "band_pixels";
    private const string KeyRect = "rect";
    private const string KeyX = "x";
    private const string KeyY = "y";
    private const string KeyWidth = "width";
    private const string KeyHeight = "height";
    private const string AnchorBottom = "bottom";
    private const string AnchorTop = "top";
    private const string AnchorLeft = "left";
    private const string AnchorRight = "right";
    private const string AnchorRect = "rect";

    public static YoloInferenceProfile Default { get; } = new();

    /// <summary>Parses a manifest / run-info scale mode name ("native", "relative"); unknown or empty = Relative.</summary>
    public static YoloScaleMode ParseScaleMode(string? value) =>
        Enum.TryParse(value, true, out YoloScaleMode mode) ? mode : YoloScaleMode.Relative;

    /// <summary>
    /// Maps the synthesis manifest / run_info "inference" object (scale_mode, window_width, window_height, tile_overlap,
    /// roi_hint {anchor bottom|top|left|right|rect, band_pixels, rect {x, y, width, height}}); null = Default.
    /// Thresholds come from the caller (with-expression).
    /// </summary>
    public static YoloInferenceProfile FromInference(JsonObject? inference)
    {
        if (inference == null) return Default;
        return new YoloInferenceProfile(
            ParseScaleMode(ReadString(inference, KeyScaleMode)),
            Math.Max(0, ReadInt(inference, KeyWindowWidth) ?? 0),
            Math.Max(0, ReadInt(inference, KeyWindowHeight) ?? 0),
            ReadInt(inference, KeyTileOverlap) is int ov && ov > 0 ? ov : -1,
            ReadRoiHint(inference[KeyRoiHint] as JsonObject));
    }

    /// <summary>Roi resolved against an image size and clipped to it; null when no Roi is set or it is empty after clipping.</summary>
    public Rect? ResolveRoi(int imageWidth, int imageHeight) => ResolveRegion(Roi, imageWidth, imageHeight);

    public static Rect? ResolveRegion(Rect? roi, int imageWidth, int imageHeight)
    {
        if (roi is not { } r) return null;
        int x = r.X < 0 ? imageWidth + r.X : r.X;
        int y = r.Y < 0 ? imageHeight + r.Y : r.Y;
        int w = r.Width <= 0 ? imageWidth - x : r.Width;
        int h = r.Height <= 0 ? imageHeight - y : r.Height;
        var clipped = new Rect(x, y, w, h).Intersect(new Rect(0, 0, imageWidth, imageHeight));
        return clipped.Width > 0 && clipped.Height > 0 ? clipped : null;
    }

    private static Rect? ReadRoiHint(JsonObject? hint)
    {
        if (hint == null) return null;
        int band = Math.Max(1, ReadInt(hint, KeyBandPixels) ?? 1);
        switch (ReadString(hint, KeyAnchor)?.ToLowerInvariant())
        {
            case AnchorBottom: return new Rect(0, -band, 0, band);
            case AnchorTop: return new Rect(0, 0, 0, band);
            case AnchorLeft: return new Rect(0, 0, band, 0);
            case AnchorRight: return new Rect(-band, 0, band, 0);
            case AnchorRect:
                if (hint[KeyRect] is not JsonObject rect) return null;
                int w = ReadInt(rect, KeyWidth) ?? 0, h = ReadInt(rect, KeyHeight) ?? 0;
                return w > 0 && h > 0 ? new Rect(ReadInt(rect, KeyX) ?? 0, ReadInt(rect, KeyY) ?? 0, w, h) : null;
            default: return null;
        }
    }

    private static string? ReadString(JsonObject o, string key) =>
        o[key] is JsonValue v && v.TryGetValue(out string? s) ? s : null;

    private static int? ReadInt(JsonObject o, string key)
    {
        if (o[key] is not JsonValue v) return null;
        if (v.TryGetValue(out int i)) return i;
        if (v.TryGetValue(out double d)) return (int)Math.Round(d);
        return v.TryGetValue(out string? s) && int.TryParse(s, out int p) ? p : null;
    }
}
