using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;

namespace DotCore.YoloRecord;

/// <summary>
/// YOLO segment layout: segment_path/record/ (raw frames), segment_path/frames/ (exported for labeling).
/// Matches UI YOLO project data structure and GameAISDK/Python bridge segment layout.
/// </summary>
public static class YoloSegmentLayout
{
    public const string RecordSubdir = "record";
    public const string FramesSubdir = "frames";

    /// <summary>List segments in project (subdirs of projectPath). Returns (segmentId, segmentPath) ordered descending by path.</summary>
    public static List<(string SegmentId, string SegmentPath)> ListSegments(string projectPath)
    {
        var list = new List<(string, string)>();
        if (string.IsNullOrWhiteSpace(projectPath) || !Directory.Exists(projectPath))
            return list;
        var dirs = Directory.EnumerateDirectories(projectPath).OrderByDescending(d => d).ToList();
        foreach (var d in dirs)
        {
            string segmentId = Path.GetFileName(d) ?? "";
            list.Add((segmentId, d));
        }
        return list;
    }

    /// <summary>Get segment info from disk: frame count (record or frames), status (raw/exported/empty/missing), size MB.</summary>
    public static (int Frames, string Status, double SizeMb) GetSegmentInfo(string segmentPath)
    {
        if (string.IsNullOrWhiteSpace(segmentPath) || !Directory.Exists(segmentPath))
            return (0, "missing", 0);
        string recordDir = Path.Combine(segmentPath, RecordSubdir);
        string framesDir = Path.Combine(segmentPath, FramesSubdir);
        int count = 0;
        if (Directory.Exists(recordDir))
            count = Directory.EnumerateFiles(recordDir).Count();
        if (count == 0 && Directory.Exists(framesDir))
            count = Directory.EnumerateFiles(framesDir).Count();
        string status = count > 0 ? "raw" : "empty";
        if (Directory.Exists(framesDir) && Directory.EnumerateFiles(framesDir).Any())
            status = "exported";
        long bytes = 0;
        foreach (var f in Directory.EnumerateFiles(segmentPath, "*", SearchOption.AllDirectories))
        {
            try { bytes += new FileInfo(f).Length; } catch { }
        }
        double mb = bytes / (1024.0 * 1024.0);
        return (count, status, mb);
    }

    /// <summary>Export segment: copy record/ to frames/.</summary>
    public static (bool Success, string? Error) ExportSegment(string segmentPath)
    {
        if (string.IsNullOrWhiteSpace(segmentPath) || !Directory.Exists(segmentPath))
            return (false, "segment_path required and must be an existing directory");
        string recordDir = Path.Combine(segmentPath, RecordSubdir);
        string framesDir = Path.Combine(segmentPath, FramesSubdir);
        if (!Directory.Exists(recordDir))
            return (false, "record dir not found");
        try
        {
            if (!Directory.Exists(framesDir))
                Directory.CreateDirectory(framesDir);
            foreach (var f in Directory.EnumerateFiles(recordDir))
            {
                string dest = Path.Combine(framesDir, Path.GetFileName(f));
                File.Copy(f, dest, true);
            }
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>Delete segment directory.</summary>
    public static (bool Success, string? Error) DeleteSegment(string segmentPath)
    {
        if (string.IsNullOrWhiteSpace(segmentPath))
            return (false, "segment_path required");
        try
        {
            if (Directory.Exists(segmentPath))
                Directory.Delete(segmentPath, true);
            return (true, null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
