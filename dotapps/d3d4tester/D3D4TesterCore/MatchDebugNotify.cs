using System.Collections.Concurrent;
using System.Drawing;
using DotCore.TemplateMatcher;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core;

/// <summary>One template-match debug entry (title, log line, optional annotated image owned by the entry).</summary>
public sealed record MatchDebugEntry(string Title, string Log, Bitmap? Image);

/// <summary>
/// In-memory template-match debug queue for a debug UI. 1:1 Python share/template_match_debug.py (no disk).
/// </summary>
public static class MatchDebugQueue
{
    private static readonly ConcurrentQueue<MatchDebugEntry> Queue = new();
    private static readonly List<MatchDebugEntry> Entries = new();
    private static readonly object EntriesLock = new();
    private static volatile bool _uiActive;

    /// <summary>Set by the debug window when opened/closed. 1:1 set_debug_ui_active.</summary>
    public static void SetDebugUiActive(bool active) => _uiActive = active;

    /// <summary>1:1 is_debug_ui_active.</summary>
    public static bool IsDebugUiActive() => _uiActive;

    /// <summary>Append one entry. 1:1 push.</summary>
    public static void Push(string title, string logLine, Bitmap? image = null)
    {
        var entry = new MatchDebugEntry(title, logLine, image);
        Queue.Enqueue(entry);
        lock (EntriesLock) Entries.Add(entry);
    }

    /// <summary>Non-blocking pop of queued entries. 1:1 pop_all.</summary>
    public static IReadOnlyList<MatchDebugEntry> PopAll()
    {
        var output = new List<MatchDebugEntry>();
        while (Queue.TryDequeue(out var e)) output.Add(e);
        return output;
    }

    /// <summary>All accumulated entries. 1:1 get_entries.</summary>
    public static IReadOnlyList<MatchDebugEntry> GetEntries()
    {
        lock (EntriesLock) return Entries.ToList();
    }

    /// <summary>Clear queue and entries and mark the UI inactive. 1:1 clear.</summary>
    public static void Clear()
    {
        while (Queue.TryDequeue(out _)) { }
        lock (EntriesLock)
        {
            foreach (var e in Entries) e.Image?.Dispose();
            Entries.Clear();
        }
        _uiActive = false;
    }
}

/// <summary>
/// After-match hook: when the debug UI is active, build an annotated match image and push it to <see cref="MatchDebugQueue"/>.
/// 1:1 Python pyapps/d3-check/d3utils/match_debug_notify.py.
/// </summary>
public static class MatchDebugNotify
{
    private const int FirstLineY = 24;
    private const int LineHeight = 22;
    private const int TextX = 10;
    private const int TemplateMaxSide = 120;
    private const double FontScale = 0.55;
    private const double SmallFontScale = 0.5;

    private static readonly Scalar White = new(255, 255, 255);
    private static readonly Scalar LightGray = new(200, 200, 200);
    private static readonly Scalar Cyan = new(255, 255, 0);

    /// <summary>On-after-match callback for scaled matchers. 1:1 notify_match.</summary>
    public static void NotifyMatch(AfterMatchContext ctx)
    {
        if (!MatchDebugQueue.IsDebugUiActive()) return;
        var r = ctx.Result;
        string err = r.Error ?? "";
        string logLine = r.TotalMatches > 0
            ? $"{ctx.TemplateName}: {r.TotalMatches} match(es)"
            : $"{ctx.TemplateName}: 0 matches" + (err.Length > 0 ? $" ({err})" : "");
        var image = BuildAnnotatedMatchImage(ctx) ?? ToBitmap(ctx.Target);
        MatchDebugQueue.Push(ctx.TemplateName, logLine, image);
    }

    /// <summary>Hook for matchers outside D3ScaledTemplateMatcher (e.g. D4 minimap): push a log line and optional image when the debug UI is active.</summary>
    public static void Notify(string title, string logLine, Mat? image = null)
    {
        if (!MatchDebugQueue.IsDebugUiActive()) return;
        MatchDebugQueue.Push(title, logLine, ToBitmap(image));
    }

    private static Bitmap? BuildAnnotatedMatchImage(AfterMatchContext ctx)
    {
        if (ctx.Target == null || ctx.Target.Empty()) return null;
        try
        {
            using var canvas = ImageConvert.ToBgr(ctx.Target);
            int w = canvas.Width, h = canvas.Height;
            int lineY = FirstLineY;
            ImageAnnotate.DrawText(canvas, $"Mode: {ctx.MatchMethod.ToName()}", new OpenCvSharp.Point(TextX, lineY), White, FontScale, 1, new Scalar(80, 80, 80));
            lineY += LineHeight;
            ImageAnnotate.DrawText(canvas, $"Threshold: {ctx.ExpectedThreshold:F2}", new OpenCvSharp.Point(TextX, lineY), White, FontScale, 1, new Scalar(60, 60, 80));
            lineY += LineHeight;
            int total = ctx.Result.TotalMatches;
            string scoreText = total > 0 && ctx.FirstMatch != null
                ? $"Score: {ctx.FirstMatch.NumMatches} inliers (ratio {ctx.FirstMatch.MatchThreshold:F2})"
                : "Score: FAIL";
            ImageAnnotate.DrawText(canvas, scoreText, new OpenCvSharp.Point(TextX, lineY), White, FontScale, 1, total == 0 ? new Scalar(80, 60, 60) : new Scalar(60, 80, 60));
            lineY += LineHeight;
            string err = ctx.Result.Error ?? "";
            string resultText = total > 0 ? $"Result: {total} match(es)" : "Result: 0 matches" + (err.Length > 0 ? $" ({err})" : "");
            ImageAnnotate.DrawText(canvas, resultText, new OpenCvSharp.Point(TextX, lineY), White, FontScale, 1, total > 0 ? new Scalar(0, 100, 0) : new Scalar(0, 0, 100));
            lineY += LineHeight;
            ImageAnnotate.DrawText(canvas, $"Template: {ctx.TemplateName}", new OpenCvSharp.Point(TextX, lineY), LightGray, SmallFontScale, 1, new Scalar(50, 50, 50));
            lineY += LineHeight;
            if (ctx.Template != null && !ctx.Template.Empty())
            {
                using var tplBgr = ImageConvert.ToBgr(ctx.Template);
                int th = tplBgr.Height, tw = tplBgr.Width;
                Mat small = tplBgr;
                Mat? resized = null;
                if (Math.Max(th, tw) > TemplateMaxSide)
                {
                    double ratio = TemplateMaxSide / (double)Math.Max(th, tw);
                    resized = tplBgr.Resize(new OpenCvSharp.Size((int)(tw * ratio), (int)(th * ratio)), 0, 0, InterpolationFlags.Area);
                    small = resized;
                }
                int tx = Math.Max(10, w - small.Width - 10);
                int ty = lineY + 4;
                if (ty + small.Height <= h && tx + small.Width <= w)
                {
                    ImageAnnotate.DrawImage(canvas, small, new OpenCvSharp.Point(tx, ty));
                    ImageAnnotate.DrawText(canvas, "Template img", new OpenCvSharp.Point(tx, ty - 2), Cyan, SmallFontScale, 1, new Scalar(60, 60, 60));
                }
                resized?.Dispose();
            }
            return ImageConvert.MatToBitmap(canvas);
        }
        catch
        {
            return null;
        }
    }

    private static Bitmap? ToBitmap(Mat? target)
    {
        if (target == null || target.Empty()) return null;
        try
        {
            using var bgr = ImageConvert.ToBgr(target);
            return ImageConvert.MatToBitmap(bgr);
        }
        catch
        {
            return null;
        }
    }
}
