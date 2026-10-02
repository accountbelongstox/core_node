// PY-REF: pyapps/d3-check/share/game_interface_data.py
using System.Collections.Concurrent;
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Bag;

/// <summary>
/// BGR color references for bag separator / quality detection (hardcoded with optional image override, cached).
/// 1:1 Python pyapps/d3-check/share/game_interface_data.py SEPARATOR_*, HARDCODED_INTERFERENCE_COLORS, _load_colors_from_image,
/// get_interference_colors, get_yellow_quality_colors, QUALITY_COLOR_IMAGES, HARDCODED_COLOR_REFS, get_quality_color_set, get_color_references.
/// </summary>
public static class BagColorReferences
{
    public const double SeparatorColorTolerance = 0.02;
    public const double SeparatorScanHeightPercent = 0.20;
    public const double SeparatorScanWidthPercent = 0.80;

    public const string KeyBlue = "blue";
    public const string KeyYellow = "yellow";
    public const string KeyDarkGold1Slot = "dark_gold_1slot";
    public const string KeyDarkGold2Slot = "dark_gold_2slot";
    public const string KeyGreen = "green";
    public const string KeyBlack = "black";
    private const string YellowCacheKey = "yellow";
    private const string QualityCachePrefix = "quality_";

    private static readonly ConcurrentDictionary<string, IReadOnlySet<(byte B, byte G, byte R)>> ColorCache = new();

    /// <summary>Interference colors excluded by exact match (BGR).</summary>
    public static readonly IReadOnlySet<(byte B, byte G, byte R)> HardcodedInterferenceColors = new HashSet<(byte, byte, byte)>
    {
        (0x09, 0x10, 0x11), (0x08, 0x0d, 0x0d), (0x01, 0x05, 0x09), (0x00, 0x04, 0x08), (0x00, 0x05, 0x09), (0x04, 0x10, 0x1c),
    };

    /// <summary>Template name -> color key for image-based color sets (all disabled in Python).</summary>
    private static readonly IReadOnlyDictionary<string, string> QualityColorImages = new Dictionary<string, string>();

    private static readonly (byte, byte, byte)[] DarkGold =
    {
        (0x08, 0x1e, 0x31), (0x46, 0x4f, 0x5c), (0x1d, 0x44, 0x6c), (0x0a, 0x26, 0x46), (0x17, 0x3b, 0x62), (0x2a, 0x67, 0x99),
        (0x0b, 0x27, 0x47), (0x35, 0x62, 0x9c), (0x00, 0x71, 0xe2), (0x03, 0x4b, 0x92), (0x0c, 0x46, 0x7b),
    };

    /// <summary>Hardcoded BGR references per color key.</summary>
    public static readonly IReadOnlyDictionary<string, (byte B, byte G, byte R)[]> HardcodedColorRefs = new Dictionary<string, (byte, byte, byte)[]>
    {
        [KeyBlue] = new (byte, byte, byte)[] { (0x48, 0x29, 0x1d), (0x65, 0x37, 0x25), (0x3f, 0x22, 0x15) },
        [KeyYellow] = new (byte, byte, byte)[]
        {
            (0x13, 0x51, 0x63), (0x10, 0xfd, 0xfa), (0x5f, 0x98, 0x9e), (0x06, 0x32, 0x43), (0x07, 0x6c, 0x75), (0x0a, 0x1b, 0x24),
            (0x4b, 0x63, 0x6b), (0x07, 0x76, 0x80), (0x06, 0x56, 0x5d), (0x0d, 0x7d, 0x83), (0x03, 0x25, 0x2b), (0x50, 0x7a, 0x8a),
            (0x09, 0x5f, 0x71), (0x56, 0x7c, 0x85), (0x0d, 0x2f, 0x3c),
        },
        [KeyDarkGold1Slot] = DarkGold,
        [KeyDarkGold2Slot] = DarkGold,
        ["dark_gold_1slot_bak"] = new (byte, byte, byte)[] { (0x0c, 0x29, 0x44), (0x12, 0x3d, 0x62), (0x11, 0x37, 0x5d), (0x0d, 0x2b, 0x48), (0x10, 0x34, 0x53), (0x0e, 0x35, 0x52) },
        ["dark_gold_2slot_bak"] = new (byte, byte, byte)[] { (0x08, 0x14, 0x1d), (0x11, 0x2c, 0x5f), (0x07, 0x10, 0x1b), (0x0e, 0x2d, 0x56), (0x10, 0x34, 0x53), (0x0e, 0x35, 0x52) },
        [KeyGreen] = new (byte, byte, byte)[]
        {
            (0x08, 0x24, 0x11), (0x15, 0x65, 0x2c), (0x09, 0x45, 0x21), (0x17, 0x6c, 0x32), (0x00, 0xfa, 0x00), (0x05, 0x5f, 0x10),
            (0x08, 0x22, 0x11), (0x09, 0x3f, 0x1a), (0x30, 0x77, 0x49), (0x0b, 0x63, 0x18), (0x08, 0x23, 0x10), (0x08, 0x27, 0x13),
            (0x19, 0x74, 0x32), (0x00, 0x9c, 0x05), (0x01, 0xc6, 0x03), (0x15, 0x70, 0x2e), (0x1d, 0xa7, 0x30),
        },
        [KeyBlack] = new (byte, byte, byte)[] { (0x17, 0x6c, 0x32) },
    };

    /// <summary>Unique BGR colors of a template image; empty when missing. 1:1 _load_colors_from_image.</summary>
    public static IReadOnlySet<(byte B, byte G, byte R)> LoadColorsFromImage(string templateName)
    {
        var set = new HashSet<(byte, byte, byte)>();
        var path = D3TemplateConfig.GetTemplatePath(templateName);
        if (path == null || !File.Exists(path)) return set;
        try
        {
            using var img = ImageConvert.LoadMat(path, ImreadModes.Color);
            if (img.Empty()) return set;
            var idx = img.GetGenericIndexer<Vec3b>();
            for (int y = 0; y < img.Height; y++)
                for (int x = 0; x < img.Width; x++)
                {
                    var p = idx[y, x];
                    set.Add((p.Item0, p.Item1, p.Item2));
                }
            ColorPrinter.Gray($"[ColorLoad] {templateName}: Total pixels={img.Width * img.Height}, Unique colors={set.Count}, After set dedup={set.Count}");
        }
        catch (Exception e)
        {
            ColorPrinter.Yellow($"Warning: Failed to load colors from {templateName}: {e.Message}");
        }
        return set;
    }

    /// <summary>1:1 get_interference_colors.</summary>
    public static IReadOnlySet<(byte B, byte G, byte R)> GetInterferenceColors() => HardcodedInterferenceColors;

    /// <summary>Yellow colors from quality_yellow_colors image (cached). 1:1 get_yellow_quality_colors.</summary>
    public static IReadOnlySet<(byte B, byte G, byte R)> GetYellowQualityColors() =>
        ColorCache.GetOrAdd(YellowCacheKey, _ => LoadColorsFromImage(D3TemplateNames.QualityYellowColors));

    /// <summary>Color set for a key: image first (if mapped), else hardcoded, else empty. 1:1 get_quality_color_set.</summary>
    public static IReadOnlySet<(byte B, byte G, byte R)> GetQualityColorSet(string colorKey) =>
        ColorCache.GetOrAdd(QualityCachePrefix + colorKey, _ =>
        {
            foreach (var (templateName, mappedKey) in QualityColorImages)
            {
                if (mappedKey != colorKey) continue;
                var fromImage = LoadColorsFromImage(templateName);
                if (fromImage.Count > 0) return fromImage;
            }
            return HardcodedColorRefs.TryGetValue(colorKey, out var refs) ? new HashSet<(byte, byte, byte)>(refs) : new HashSet<(byte, byte, byte)>();
        });

    /// <summary>All quality color references. 1:1 get_color_references.</summary>
    public static IReadOnlyDictionary<string, IReadOnlySet<(byte B, byte G, byte R)>> GetColorReferences() => new Dictionary<string, IReadOnlySet<(byte B, byte G, byte R)>>
    {
        [KeyBlue] = GetQualityColorSet(KeyBlue),
        [KeyYellow] = GetQualityColorSet(KeyYellow),
        [KeyDarkGold1Slot] = GetQualityColorSet(KeyDarkGold1Slot),
        [KeyDarkGold2Slot] = GetQualityColorSet(KeyDarkGold2Slot),
        [KeyGreen] = GetQualityColorSet(KeyGreen),
        [KeyBlack] = GetQualityColorSet(KeyBlack),
    };
}
