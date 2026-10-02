// PY-REF: pyapps/d3-check/d4utils/d4_team_health_detector.py
using DotCore.Foundations;
using DotCore.Utils.ImageColor;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Team health bars in the "Team Count" region: row scan for group 1 (same map, red) left-to-right, else group 2
/// (different map, dark) right-to-left; ±25 per channel, ≥20 pixels per row, then jump 40 rows.
/// 1:1 Python pyapps/d3-check/d4utils/d4_team_health_detector.py (vectorized with per-row mask counts; same result).
/// </summary>
public sealed class D4TeamHealthDetector
{
    private const string LogPrefix = "[D4TeamHealthDetector]";
    private const string ScanMethod = "40px_jump_after_detection";

    private static readonly Scalar White = new(255, 255, 255);

    private static readonly Lazy<D4TeamHealthDetector> LazyInstance = new(() =>
    {
        var d = new D4TeamHealthDetector();
        ColorPrinter.Green("[Global] Team health detector initialized");
        return d;
    });

    private D4TeamHealthDetector()
    {
        ColorPrinter.Blue($"{LogPrefix} Initialized");
    }

    public static D4TeamHealthDetector Instance => LazyInstance.Value;

    public static string ScanMethodName => ScanMethod;

    /// <summary>Detect team health bars in a game window image (BGR) and store the result. 1:1 detect_team_health.</summary>
    public D4TeamHealthResult DetectTeamHealth(D4InterfaceData data, Mat gameWindowBgr, bool debug)
    {
        ColorPrinter.Blue($"{LogPrefix} Starting team health detection...");
        if (gameWindowBgr == null || gameWindowBgr.Empty())
            return D4TeamHealthResult.Fail("No game window image");
        int width = gameWindowBgr.Width;
        int height = gameWindowBgr.Height;
        bool windowed = data.IsWindowedMode();
        var start = D4StandardCoords.Scale(D4StandardCoords.TeamCount.Start, (width, height), windowed);
        var end = D4StandardCoords.Scale(D4StandardCoords.TeamCount.End, (width, height), windowed);
        ColorPrinter.Green($"{LogPrefix} Team count region: {start} -> {end}");
        int x1 = Math.Clamp(start.X, 0, width), y1 = Math.Clamp(start.Y, 0, height);
        int x2 = Math.Clamp(end.X, 0, width), y2 = Math.Clamp(end.Y, 0, height);
        if (x1 >= x2 || y1 >= y2)
        {
            ColorPrinter.Yellow($"{LogPrefix} Invalid region coordinates");
            return D4TeamHealthResult.Fail("Invalid region coordinates");
        }

        using var view = new Mat(gameWindowBgr, new Rect(x1, y1, x2 - x1, y2 - y1));
        using var region = ImageConvert.ToBgr(view);
        ColorPrinter.Green($"{LogPrefix} Extracted region size: {region.Height}x{region.Width}");
        var result = ScanHealthBars(region, (x1, y1));
        if (debug)
        {
            using var annotated = CreateAnnotatedImage(region, result);
            var path = D4ImageCrop.Save(annotated, D4ImageCrop.TimestampedPath(D4Constants.AnnotatedDir, D4Constants.TeamHealthDebugPrefix), LogPrefix);
            if (path != null)
            {
                ColorPrinter.Green($"{LogPrefix} Annotated image saved: {path}");
                result = result with { DebugImagePath = path };
            }
        }
        data.TeamHealth = result;
        data.TeamHealthDetectionTimestamp = DateTime.Now;
        ColorPrinter.Green($"{LogPrefix} Team health detection completed");
        return result;
    }

    /// <summary>Row scan with a 40-row jump after each detection. 1:1 _scan_health_bars + _calculate_absolute_offsets.</summary>
    public static D4TeamHealthResult ScanHealthBars(Mat regionBgr, (int X, int Y) regionOffset)
    {
        int width = regionBgr.Width;
        int height = regionBgr.Height;
        int tol = D4Constants.TeamHealthToleranceAbs;
        using var mask1 = BgrColorMatch.InRangeAnyMask(regionBgr, D4Constants.TeamHealthGroup1Colors, tol);
        using var mask2 = BgrColorMatch.InRangeAnyMask(regionBgr, D4Constants.TeamHealthGroup2Colors, tol);
        var members = new List<D4TeamMember>();
        int row = 0;
        while (row < height)
        {
            var member = TryRow(regionBgr, mask1, row, D4TeamHealthGroup.SameMap, D4ScanDirection.LeftToRight, members.Count + 1, regionOffset)
                         ?? TryRow(regionBgr, mask2, row, D4TeamHealthGroup.DifferentMap, D4ScanDirection.RightToLeft, members.Count + 1, regionOffset);
            if (member != null)
            {
                members.Add(member);
                row += D4Constants.TeamHealthRowJump;
            }
            else
            {
                row += 1;
            }
        }
        int g1 = members.Count(m => m.Group == D4TeamHealthGroup.SameMap);
        int g2 = members.Count(m => m.Group == D4TeamHealthGroup.DifferentMap);
        int local = members.Count(m => m.IsLocalMap);
        return new D4TeamHealthResult(members.Count, g1, g2, local, members.Count - local, members, DateTime.Now, (width, height));
    }

    private static D4TeamMember? TryRow(Mat region, Mat mask, int row, D4TeamHealthGroup group, D4ScanDirection direction, int memberIndex, (int X, int Y) offset)
    {
        using var maskRow = mask.Row(row);
        int count = Cv2.CountNonZero(maskRow);
        if (count < D4Constants.TeamHealthMinPixelsPerRow) return null;
        int width = mask.Width;
        int firstCol = -1;
        if (direction == D4ScanDirection.LeftToRight)
        {
            for (int x = 0; x < width && firstCol < 0; x++)
                if (mask.At<byte>(row, x) != 0) firstCol = x;
        }
        else
        {
            for (int x = width - 1; x >= 0 && firstCol < 0; x--)
                if (mask.At<byte>(row, x) != 0) firstCol = x;
        }
        (byte, byte, byte)? first = null;
        if (firstCol >= 0)
        {
            var px = region.At<Vec3b>(row, firstCol);
            first = (px.Item0, px.Item1, px.Item2);
        }
        return new D4TeamMember(
            memberIndex, row, count, width, count * 100.0 / width, first, group,
            group == D4TeamHealthGroup.SameMap, direction,
            new D4HpScreenOffset(0, row, offset.X, offset.Y + row));
    }

    /// <summary>Per-row pixel counts plus member boxes and summary. Caller disposes. 1:1 _create_annotated_image.</summary>
    private static Mat CreateAnnotatedImage(Mat region, D4TeamHealthResult result)
    {
        var image = region.Clone();
        int width = region.Width;
        var detectedRows = result.TeamMembers.Select(m => m.RowIndex).ToHashSet();
        var allColors = D4Constants.TeamHealthGroup1Colors.Concat(D4Constants.TeamHealthGroup2Colors).ToList();
        var rowCounts = BgrColorMatch.CountMatchingPixelsPerRow(region, allColors, D4Constants.TeamHealthToleranceAbs);
        var green = ImageAnnotate.GetAnnotationColor("green");
        var yellow = ImageAnnotate.GetAnnotationColor("yellow");
        var gray = ImageAnnotate.GetAnnotationColor("gray");
        var darkGray = ImageAnnotate.GetAnnotationColor("dark_gray");
        var red = ImageAnnotate.GetAnnotationColor("red");
        var blue = ImageAnnotate.GetAnnotationColor("blue");
        for (int y = 0; y < rowCounts.Length; y++)
        {
            int matching = rowCounts[y];
            Scalar color = detectedRows.Contains(y)
                ? (matching >= D4Constants.TeamHealthMinPixelsPerRow ? green : yellow)
                : (matching > 0 ? gray : darkGray);
            ImageAnnotate.DrawLine(image, new Point(0, y), new Point(width, y), color, 1);
            ImageAnnotate.DrawText(image, $"R{y}: {matching}/{width} ({matching * 100.0 / width:F1}%)", new Point(0, y - 2), color, 0.25, 1);
        }
        foreach (var m in result.TeamMembers)
        {
            var color = m.Group == D4TeamHealthGroup.SameMap ? green : red;
            int g = (int)m.Group;
            ImageAnnotate.DrawRectangle(image, new Point(0, m.RowIndex), new Point(width, m.RowIndex + 1), color, 2);
            ImageAnnotate.DrawText(image, $"M{m.MemberIndex} G{g} ({m.MatchingPixels}px)", new Point(0, m.RowIndex - 25), White, 0.4, 1, color);
            var groupLabel = m.Group == D4TeamHealthGroup.SameMap ? "Same Map" : "Different Map";
            var local = m.IsLocalMap ? "Local" : "Non-Local";
            var dir = m.ScanDirection == D4ScanDirection.LeftToRight ? "left_to_right" : "right_to_left";
            ImageAnnotate.DrawText(image, $"{groupLabel} ({local}) {dir}", new Point(0, m.RowIndex + 15), White, 0.3, 1, color);
            ImageAnnotate.DrawText(image, $"HP:({m.HpScreenOffset.AbsoluteX},{m.HpScreenOffset.AbsoluteY})", new Point(0, m.RowIndex + 30), White, 0.25, 1, color);
        }
        ImageAnnotate.DrawText(image, $"Team: {result.TotalMembers} total (G1:{result.Group1Members}, G2:{result.Group2Members})", new Point(0, 15), White, 0.5, 1, green);
        ImageAnnotate.DrawText(image, $"Map: Local:{result.LocalMapMembers}, Non-Local:{result.NonLocalMapMembers}", new Point(0, 35), White, 0.5, 1, blue);
        return image;
    }
}
