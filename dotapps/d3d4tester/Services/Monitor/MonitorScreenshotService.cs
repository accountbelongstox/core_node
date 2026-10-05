// PY-REF: none (DOT-only)
using System.Drawing;
using System.Drawing.Imaging;
using System.Globalization;
using System.IO;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Monitor;
using DotCore.ScreenCapture;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// D3 client-area screenshots as JPEG "&lt;label&gt;-yyyy-MM-dd-HH_mm_ss.jpg" with keep-newest-N trimming (RBAssist TAKESCREENSHOT2 +
/// TRIMSCREENSHOTCOUNT). The custom crop "x,y,w,h" applies to periodic shots only, as in RBAssist.
/// </summary>
public static class MonitorScreenshotService
{
    private const string FileTimestampFormat = "yyyy-MM-dd-HH_mm_ss";
    private const string FileExtension = ".jpg";
    private const string FileSearchSuffix = "-*.jpg";

    /// <summary>Screenshot for a kind (periodic, death, fail, error) when that kind is enabled; trims to its keep count.</summary>
    public static void CaptureKind(string kind)
    {
        if (!MonitorSettings.ScreenshotEnabled(kind)) return;
        bool crop = kind == MonitorScreenshotKinds.Periodic && MonitorSettings.GetBool(ConfigKeys.MonitorScreenshotCropCustom);
        string? path = Capture(kind, MonitorSettings.ScreenshotDir(kind), crop);
        if (path != null) Trim(MonitorSettings.ScreenshotDir(kind), kind, MonitorSettings.ScreenshotKeep(kind));
    }

    /// <summary>Capture the D3 client area into dir with label; returns the file path or null.</summary>
    public static string? Capture(string label, string dir, bool applyCustomCrop = false)
    {
        var window = D3Manager.Instance.FindFirstWindow();
        if (window == null)
        {
            MonitorLog.Warn("Screenshot skipped: D3 window not found");
            return null;
        }
        var client = WindowInputHelper.GetWindowClientRectScreen(window.Hwnd);
        if (client is not { } r || r.Right <= r.Left || r.Bottom <= r.Top)
        {
            MonitorLog.Warn("Screenshot skipped: D3 client area not available");
            return null;
        }
        try
        {
            using Bitmap? full = ScreenCaptureService.GetScreenshotProvider().CaptureRegionBitBlt(r.Left, r.Top, r.Right - r.Left, r.Bottom - r.Top);
            if (full == null) return null;
            Rectangle? crop = applyCustomCrop ? ParseCrop(MonitorSettings.GetString(ConfigKeys.MonitorScreenshotCrop, MonitorSettings.CropDefault), full.Size) : null;
            using Bitmap image = crop is { } c ? ScreenCaptureService.CropBitmap(full, c) : (Bitmap)full.Clone();
            Directory.CreateDirectory(dir);
            string safeLabel = string.Concat(label.Where(ch => !Path.GetInvalidFileNameChars().Contains(ch)));
            string file = Path.Combine(dir, $"{safeLabel}-{DateTime.Now.ToString(FileTimestampFormat, CultureInfo.InvariantCulture)}{FileExtension}");
            image.Save(file, ImageFormat.Jpeg);
            MonitorLog.Info($"Screenshot saved: {file}");
            return file;
        }
        catch (Exception ex)
        {
            MonitorLog.Warn($"Screenshot failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>"x,y,w,h" with w,h &gt; 0 clipped to the image; null for "0,0,0,0" or invalid input.</summary>
    public static Rectangle? ParseCrop(string text, Size size)
    {
        var v = D3PixelProbes.ParseThresholds(text, 0, 0, 0, 0);
        if (v[2] <= 0 || v[3] <= 0) return null;
        var rect = Rectangle.Intersect(new Rectangle(v[0], v[1], v[2], v[3]), new Rectangle(Point.Empty, size));
        return rect.Width > 0 && rect.Height > 0 ? rect : null;
    }

    /// <summary>Keep the newest keep files "&lt;label&gt;-*.jpg" in dir (0 = keep all). Only files this service names are touched.</summary>
    public static void Trim(string dir, string label, int keep)
    {
        if (keep <= 0 || !Directory.Exists(dir)) return;
        var files = Directory.GetFiles(dir, label + FileSearchSuffix).OrderBy(f => f, StringComparer.Ordinal).ToList();
        foreach (var old in files.Take(Math.Max(0, files.Count - keep)))
        {
            try { File.Delete(old); }
            catch (Exception ex) { MonitorLog.Warn($"Screenshot trim failed for {old}: {ex.Message}"); }
        }
    }
}
