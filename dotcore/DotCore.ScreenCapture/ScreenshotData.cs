using System.Drawing;

namespace DotCore.ScreenCapture;

/// <summary>
/// Screenshot data container. Aligned with PY ScreenshotData; used by Share/Gen and for saving.
/// Bitmaps are owned by Provider lifecycle when shared; caller must Dispose if used standalone.
/// </summary>
public sealed class ScreenshotData
{
    /// <summary>Full screen image (null when only game window was captured).</summary>
    public Bitmap? FullscreenImage { get; init; }

    /// <summary>Game window cropped image (null if not captured).</summary>
    public Bitmap? GameWindowImage { get; init; }

    /// <summary>Game window screen rectangle (Left, Top, Right, Bottom), or null.</summary>
    public Rectangle? GameWindowRect { get; init; }

    /// <summary>Window offset from screen (OffsetX, OffsetY).</summary>
    public (int X, int Y) WindowOffset { get; init; }

    /// <summary>Full screen size (Width, Height).</summary>
    public (int Width, int Height) FullscreenSize { get; init; }

    /// <summary>Game window size (Width, Height), or null.</summary>
    public (int Width, int Height)? GameWindowSize { get; init; }

    /// <summary>Timestamp string for filenames etc.</summary>
    public string Timestamp { get; init; } = "";

    /// <summary>Save to disk. Returns (FullscreenPath, GameWindowPath); null for unsaved.</summary>
    /// <param name="outputDir">Output directory; uses current directory if null.</param>
    /// <param name="prefix">Filename prefix; default <see cref="ScreenCaptureConstants.DefaultScreenshotPrefix"/>.</param>
    public (string? FullscreenPath, string? GameWindowPath) Save(string? outputDir = null, string prefix = ScreenCaptureConstants.DefaultScreenshotPrefix)
    {
        var dir = string.IsNullOrWhiteSpace(outputDir) ? Directory.GetCurrentDirectory() : outputDir;
        Directory.CreateDirectory(dir);
        string? fullPath = null;
        string? gamePath = null;
        if (FullscreenImage != null)
        {
            fullPath = Path.Combine(dir, $"{prefix}_fullscreen_{Timestamp}.{ScreenCaptureConstants.DefaultImageExtension}");
            ScreenCaptureService.SaveToFile(FullscreenImage, fullPath);
        }
        if (GameWindowImage != null)
        {
            gamePath = Path.Combine(dir, $"{prefix}_game_{Timestamp}.{ScreenCaptureConstants.DefaultImageExtension}");
            ScreenCaptureService.SaveToFile(GameWindowImage, gamePath);
        }
        return (fullPath, gamePath);
    }
}
