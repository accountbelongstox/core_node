// PY-REF: pyapps/d3-check/controller/d4func/region_detector.py
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Region crop with PIL crop semantics (area outside the source stays black) and image save helpers for D4 debug output.
/// 1:1 Python pycore ImageCrop.crop_region as used by d4func/region_detector.py.
/// </summary>
internal static class D4ImageCrop
{
    /// <summary>Crop (x1,y1)-(x2,y2) into a new BGR Mat; null when the rect is empty. Caller disposes.</summary>
    public static Mat? Crop(Mat source, (int X, int Y) start, (int X, int Y) end)
    {
        int w = end.X - start.X;
        int h = end.Y - start.Y;
        if (source == null || source.Empty() || w <= 0 || h <= 0) return null;
        var result = new Mat(h, w, source.Type(), Scalar.All(0));
        var src = new Rect(0, 0, source.Width, source.Height);
        var want = new Rect(start.X, start.Y, w, h);
        var inter = src & want;
        if (inter.Width > 0 && inter.Height > 0)
        {
            using var from = new Mat(source, inter);
            using var to = new Mat(result, new Rect(inter.X - want.X, inter.Y - want.Y, inter.Width, inter.Height));
            from.CopyTo(to);
        }
        return result;
    }

    /// <summary>Crop clamped to the image bounds (numpy slicing semantics); null when empty. Caller disposes.</summary>
    public static Mat? CropClamped(Mat source, (int X, int Y) start, (int X, int Y) end)
    {
        if (source == null || source.Empty()) return null;
        int x1 = Math.Clamp(start.X, 0, source.Width);
        int y1 = Math.Clamp(start.Y, 0, source.Height);
        int x2 = Math.Clamp(end.X, x1, source.Width);
        int y2 = Math.Clamp(end.Y, y1, source.Height);
        if (x2 <= x1 || y2 <= y1) return null;
        using var view = new Mat(source, new Rect(x1, y1, x2 - x1, y2 - y1));
        return view.Clone();
    }

    /// <summary>Timestamped file path in a directory (created on demand).</summary>
    public static string TimestampedPath(string dir, string prefix, string? timestamp = null)
    {
        Directory.CreateDirectory(dir);
        var ts = timestamp ?? DateTime.Now.ToString(D4Constants.TimestampFormat);
        return Path.Combine(dir, prefix + ts + D4Constants.ImageExtension);
    }

    /// <summary>Save a Mat; returns the path or null on failure.</summary>
    public static string? Save(Mat image, string path, string logPrefix)
    {
        if (ImageConvert.SaveMat(image, path)) return path;
        ColorPrinter.Yellow($"{logPrefix} Failed to save image: {path}");
        return null;
    }
}
