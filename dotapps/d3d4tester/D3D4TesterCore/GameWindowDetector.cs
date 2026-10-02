// PY-REF: pyapps/d3-check/d3utils/game_window_detector.py
using System.Drawing;
using DotCore.Foundations;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core;

/// <summary>Anchor found in a fullscreen shot: template name, match center, template size.</summary>
public sealed record GameWindowAnchor(string Name, (double X, double Y) Position, (int Width, int Height) Size);

/// <summary>Detected game window: (left, top, right, bottom) in screen pixels plus both anchors.</summary>
public sealed record GameWindowDetection((int Left, int Top, int Right, int Bottom) WindowRect, GameWindowAnchor BottomLeftAnchor, GameWindowAnchor BottomRightAnchor)
{
    public Rectangle ToRectangle() => Rectangle.FromLTRB(WindowRect.Left, WindowRect.Top, WindowRect.Right, WindowRect.Bottom);
}

/// <summary>
/// Locate the game window in a fullscreen screenshot via bottom-left (3 variants) and bottom-right anchor templates.
/// 1:1 Python pyapps/d3-check/d3utils/game_window_detector.py. Use <see cref="Locate"/> as ScreenCaptureOptions.GameWindowLocator.
/// </summary>
public sealed class GameWindowDetector
{
    private static readonly string[] BottomLeftAnchorNames =
    {
        D3TemplateNames.GameAnchorBottomLeft1, D3TemplateNames.GameAnchorBottomLeft2, D3TemplateNames.GameAnchorBottomLeft3,
    };

    private static readonly Lazy<GameWindowDetector> LazyInstance = new(() => new GameWindowDetector());

    private readonly D3ScaledTemplateMatcher _matcher = D3ScaledTemplateMatcher.Instance;

    private GameWindowDetector()
    {
        ColorPrinter.Green("[GameWindowDetector] Initialized");
        ColorPrinter.Blue($"[GameWindowDetector] Found {D3TemplateConfig.GetTemplatesByCategory("game_anchor").Count} anchor templates");
    }

    /// <summary>Singleton. 1:1 get_game_window_detector.</summary>
    public static GameWindowDetector Instance => LazyInstance.Value;

    /// <summary>Locator delegate for screenshot capture: game window rect or null.</summary>
    public static Rectangle? Locate(Bitmap fullscreen) => Instance.DetectGameWindow(fullscreen)?.ToRectangle();

    /// <summary>Detect game window in a fullscreen bitmap. 1:1 detect_game_window.</summary>
    public GameWindowDetection? DetectGameWindow(Bitmap? screenshot)
    {
        ColorPrinter.Blue("\n[Detector] Detecting game window in screenshot...");
        if (screenshot == null)
        {
            ColorPrinter.Red("[Detector] Failed to load screenshot: null");
            return null;
        }
        try
        {
            using var mat = ImageConvert.BitmapToMat(screenshot);
            int screenWidth = mat.Width, screenHeight = mat.Height;
            ColorPrinter.Blue($"[Detector] Screen size: {screenWidth}x{screenHeight}");
            ColorPrinter.Blue("[Detector] Searching for bottom-left anchor...");
            GameWindowAnchor? bottomLeft = null;
            foreach (var name in BottomLeftAnchorNames)
            {
                bottomLeft = FindAnchor(mat, name);
                if (bottomLeft != null) break;
            }
            if (bottomLeft == null)
            {
                ColorPrinter.Yellow("[Detector] Bottom-left anchor not found");
                return null;
            }
            ColorPrinter.Green($"[Detector] Found bottom-left anchor: {bottomLeft.Name} at {bottomLeft.Position}");
            ColorPrinter.Blue("[Detector] Searching for bottom-right anchor...");
            var bottomRight = FindAnchor(mat, D3TemplateNames.GameAnchorBottomRight);
            if (bottomRight == null)
            {
                ColorPrinter.Yellow("[Detector] Bottom-right anchor not found");
                return null;
            }
            ColorPrinter.Green($"[Detector] Found bottom-right anchor: {bottomRight.Name} at {bottomRight.Position}");
            var rect = CalculateWindowRect(bottomLeft, bottomRight, screenWidth, screenHeight);
            ColorPrinter.Green($"[Detector] Game window rect: {rect}");
            return new GameWindowDetection(rect, bottomLeft, bottomRight);
        }
        catch (Exception e)
        {
            ColorPrinter.Red($"[Detector] Error detecting game window: {e.Message}");
            return null;
        }
    }

    private GameWindowAnchor? FindAnchor(Mat screenshot, string anchorName)
    {
        var path = D3TemplateConfig.GetTemplatePath(anchorName);
        if (path == null || !File.Exists(path))
        {
            ColorPrinter.Yellow($"[Detector] Template not found: {anchorName}");
            return null;
        }
        ColorPrinter.Blue($"[Detector] Trying {anchorName}...");
        var result = _matcher.MatchTemplate(screenshot, anchorName);
        if (result.FirstMatch is not { Center: { } c }) return null;
        using var template = ImageConvert.LoadMat(path);
        return new GameWindowAnchor(anchorName, (c.X, c.Y), (template.Width, template.Height));
    }

    /// <summary>Left = BL.x - BL.w, top = 0, right = BR.x + BR.w, bottom = max(BL.y + BL.h, BR.y + BR.h), clamped. 1:1 _calculate_window_rect.</summary>
    private static (int Left, int Top, int Right, int Bottom) CalculateWindowRect(GameWindowAnchor bl, GameWindowAnchor br, int screenWidth, int screenHeight)
    {
        ColorPrinter.Blue($"[Calc] Bottom-left anchor: pos=({bl.Position.X}, {bl.Position.Y}), size=({bl.Size.Width}x{bl.Size.Height})");
        ColorPrinter.Blue($"[Calc] Bottom-right anchor: pos=({br.Position.X}, {br.Position.Y}), size=({br.Size.Width}x{br.Size.Height})");
        int leftBottomX = (int)(bl.Position.X - bl.Size.Width);
        int leftBottomY = (int)(bl.Position.Y + bl.Size.Height);
        int rightBottomX = (int)(br.Position.X + br.Size.Width);
        int rightBottomY = (int)(br.Position.Y + br.Size.Height);
        ColorPrinter.Blue($"[Calc] Offset bottom-left: ({leftBottomX}, {leftBottomY})");
        ColorPrinter.Blue($"[Calc] Offset bottom-right: ({rightBottomX}, {rightBottomY})");
        int left = Math.Max(0, leftBottomX);
        int top = 0;
        int right = Math.Min(screenWidth, rightBottomX);
        int bottom = Math.Min(screenHeight, Math.Max(leftBottomY, rightBottomY));
        ColorPrinter.Blue($"[Calc] Final game window rect: left={left}, top={top}, right={right}, bottom={bottom}");
        ColorPrinter.Blue($"[Calc] Window size: {right - left}x{bottom - top}");
        return (left, top, right, bottom);
    }
}
