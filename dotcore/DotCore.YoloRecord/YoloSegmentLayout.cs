// PY-REF: pyapps/d3-check/d3utils/yolo_record.py
// PY-REF: pyapps/d3-check/d3utils/yolo_train_flow.py
using System.Diagnostics;
using DotCore.VocAnnotator;
using OpenCvSharp;

namespace DotCore.YoloRecord;

/// <summary>
/// YOLO segment layout and file operations: project_path/segment_id/record/ (raw jpgs or video.avi, direct or in record/*/), segment_id/frames/ (exported for labeling).
/// 1:1 Python pyapps/d3-check/d3utils/yolo_record.py (project/segment helpers, segment_info, compose, merge, delete, open dir).
/// </summary>
public static class YoloSegmentLayout
{
    public const string RecordSubdir = YoloDataLayout.RecordSubdir;
    public const string FramesSubdir = YoloDataLayout.FramesSubdir;
    public const string VideoFileName = "video.avi";
    public const string JpgExtension = ".jpg";
    public const string PngExtension = ".png";
    public const string DefaultProjectName = "default";
    public const string DefaultClientSubdir = "d3_game";
    public const string SegmentIdPrefix = "seg_0_";
    public const string MergePrefixFormat = "seg_{0}_";
    public const string StatusRaw = "raw";
    public const string StatusExported = "exported";
    public const string StatusLabeled = "labeled";

    /// <summary>client_type -> record subdir. 1:1 CLIENT_TYPE_TO_RECORD_SUBDIR.</summary>
    public static readonly IReadOnlyDictionary<string, string> ClientTypeToRecordSubdir = new Dictionary<string, string>
    {
        ["battlenet"] = "battlenet",
        ["d3_game"] = "d3_game",
        ["d4_game"] = "d4_game",
    };

    /// <summary>Segment info. 1:1 segment_info dict (frames_count, has_video, has_frames, status, size_mb).</summary>
    public sealed record SegmentInfo(int FramesCount, bool HasVideo, bool HasFrames, string Status, double SizeMb);

    public static string GetClientSubdir(string? clientType) =>
        clientType != null && ClientTypeToRecordSubdir.TryGetValue(clientType, out var sub) ? sub : DefaultClientSubdir;

    /// <summary>Return and ensure Root/{client subdir}/default.</summary>
    public static string GetDefaultProjectPath(string? clientType)
    {
        var path = YoloDataLayout.GetProjectPath(GetClientSubdir(clientType), DefaultProjectName);
        Directory.CreateDirectory(path);
        return path;
    }

    /// <summary>True if path is exactly Root/{client_type}/{project_name}.</summary>
    public static bool IsValidProjectPath(string? path)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        var (ct, name) = YoloDataLayout.ParseProjectPathToClientProject(path);
        if (string.IsNullOrEmpty(ct) || string.IsNullOrEmpty(name)) return false;
        var expected = YoloDataLayout.GetProjectPath(ct, name);
        return PathEquals(Path.GetFullPath(path), expected);
    }

    /// <summary>Segment id like seg_0_20250221_120000.</summary>
    public static string MakeSegmentId() => SegmentIdPrefix + DateTime.Now.ToString("yyyyMMdd_HHmmss");

    public static string GetRecordOutputSubdir(string? projectPath) =>
        string.IsNullOrWhiteSpace(projectPath) ? "" : YoloDataLayout.TrimSeparators(Path.GetFullPath(projectPath));

    /// <summary>Segments (direct subdirs) sorted newest first by name.</summary>
    public static List<(string SegmentId, string SegmentPath)> ListSegments(string? projectPath)
    {
        var list = new List<(string, string)>();
        if (string.IsNullOrWhiteSpace(projectPath) || !Directory.Exists(projectPath))
            return list;
        try
        {
            var proj = YoloDataLayout.TrimSeparators(Path.GetFullPath(projectPath));
            foreach (var name in Directory.EnumerateDirectories(proj).Select(Path.GetFileName).OrderByDescending(n => n, StringComparer.Ordinal))
                list.Add((name!, Path.Combine(proj, name!)));
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        return list;
    }

    public static string? GetLatestSegmentDir(string? projectPath)
    {
        var segments = ListSegments(projectPath);
        return segments.Count > 0 ? segments[0].SegmentPath : null;
    }

    /// <summary>Total bytes under path (recursive); 0 when invalid.</summary>
    public static long GetDirectorySize(string? path)
    {
        if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path)) return 0;
        long total = 0;
        try
        {
            foreach (var f in Directory.EnumerateFiles(path, "*", SearchOption.AllDirectories))
            {
                try { total += new FileInfo(f).Length; } catch (IOException) { }
            }
        }
        catch (IOException) { }
        catch (UnauthorizedAccessException) { }
        return total;
    }

    /// <summary>record/video.avi, else newest record/*/video.avi.</summary>
    public static string? RecordVideoPath(string? segmentPath)
    {
        if (string.IsNullOrWhiteSpace(segmentPath) || !Directory.Exists(segmentPath)) return null;
        var rec = Path.Combine(segmentPath, RecordSubdir);
        var direct = Path.Combine(rec, VideoFileName);
        if (File.Exists(direct)) return direct;
        if (!Directory.Exists(rec)) return null;
        try
        {
            return Directory.EnumerateDirectories(rec)
                .Select(d => Path.Combine(d, VideoFileName))
                .Where(File.Exists)
                .OrderByDescending(File.GetLastWriteTimeUtc)
                .FirstOrDefault();
        }
        catch (IOException) { return null; }
    }

    /// <summary>.jpg files directly under record/, then in record/* subdirs newest first.</summary>
    public static List<string> RecordJpgs(string? segmentPath)
    {
        var result = new List<string>();
        if (string.IsNullOrWhiteSpace(segmentPath) || !Directory.Exists(segmentPath)) return result;
        var rec = Path.Combine(segmentPath, RecordSubdir);
        if (!Directory.Exists(rec)) return result;
        try
        {
            result.AddRange(Directory.EnumerateFiles(rec).Where(IsJpg));
            foreach (var sub in Directory.EnumerateDirectories(rec).OrderByDescending(Directory.GetLastWriteTimeUtc))
                result.AddRange(Directory.EnumerateFiles(sub).Where(IsJpg));
        }
        catch (IOException) { }
        return result;
    }

    /// <summary>True if frames/ has at least one .xml or .txt label.</summary>
    public static bool SegmentHasLabeled(string? segmentPath)
    {
        if (string.IsNullOrWhiteSpace(segmentPath) || !Directory.Exists(segmentPath)) return false;
        var framesDir = Path.Combine(segmentPath, FramesSubdir);
        if (!Directory.Exists(framesDir)) return false;
        try
        {
            return Directory.EnumerateFiles(framesDir).Any(f => HasExt(f, ".xml") || HasExt(f, ".txt"));
        }
        catch (IOException) { return false; }
    }

    public static SegmentInfo GetSegmentInfo(string? segmentPath)
    {
        var empty = new SegmentInfo(0, false, false, StatusRaw, 0);
        if (string.IsNullOrWhiteSpace(segmentPath) || !Directory.Exists(segmentPath)) return empty;
        try
        {
            var hasVideo = RecordVideoPath(segmentPath) != null;
            var framesDir = Path.Combine(segmentPath, FramesSubdir);
            var hasFrames = Directory.Exists(framesDir);
            var count = hasFrames ? Directory.EnumerateFiles(framesDir).Count(f => HasExt(f, JpgExtension) || HasExt(f, PngExtension)) : 0;
            if (count == 0 && !hasVideo)
                count = RecordJpgs(segmentPath).Count;
            var status = SegmentHasLabeled(segmentPath) ? StatusLabeled : (hasFrames && count > 0 ? StatusExported : StatusRaw);
            var sizeMb = Math.Round(GetDirectorySize(segmentPath) / (1024.0 * 1024.0), 1);
            return new SegmentInfo(count, hasVideo, hasFrames, status, sizeMb);
        }
        catch (IOException)
        {
            return empty;
        }
    }

    /// <summary>Export record (video or jpgs) to segment/outputSubdir as frame_XXXXXX{imageExt}, keeping every skipFrames-th frame.</summary>
    public static (bool Ok, string Message, string? FramesDir) ComposeSegmentToFrames(string? segmentDir, string outputSubdir = FramesSubdir, int skipFrames = 1, string imageExt = PngExtension)
    {
        if (string.IsNullOrWhiteSpace(segmentDir) || !Directory.Exists(segmentDir))
            return (false, "segment_dir not found", null);
        segmentDir = Path.GetFullPath(segmentDir);
        var step = Math.Max(1, skipFrames);
        var outDir = Path.Combine(segmentDir, outputSubdir);
        try
        {
            var videoPath = RecordVideoPath(segmentDir);
            if (videoPath != null)
            {
                Directory.CreateDirectory(outDir);
                using var cap = new VideoCapture(videoPath);
                using var frame = new Mat();
                int idx = 0, written = 0;
                while (cap.Read(frame) && !frame.Empty())
                {
                    if (idx % step == 0)
                    {
                        Cv2.ImWrite(Path.Combine(outDir, FrameName(written, imageExt)), frame);
                        written++;
                    }
                    idx++;
                }
                return (true, $"extracted {written} frames", outDir);
            }
            var jpgs = RecordJpgs(segmentDir);
            if (jpgs.Count > 0)
            {
                jpgs.Sort(StringComparer.Ordinal);
                Directory.CreateDirectory(outDir);
                int written = 0;
                for (var i = 0; i < jpgs.Count; i++)
                {
                    if (i % step != 0) continue;
                    File.Copy(jpgs[i], Path.Combine(outDir, FrameName(written, imageExt)), true);
                    written++;
                }
                return (true, $"copied {written} frames", outDir);
            }
            return (false, "no video.avi or .jpg in segment record/", null);
        }
        catch (Exception ex)
        {
            return (false, ex.Message, null);
        }
    }

    /// <summary>After stop: compose latest segment. Returns (segmentDir, framesDir or null).</summary>
    public static (string? SegmentDir, string? FramesDir) ContinueToLabeling(string? projectPath, string outputSubdir = FramesSubdir, int skipFrames = 1)
    {
        var segmentDir = GetLatestSegmentDir(projectPath);
        if (segmentDir == null) return (null, null);
        var (ok, _, framesDir) = ComposeSegmentToFrames(segmentDir, outputSubdir, skipFrames);
        return (segmentDir, ok ? framesDir : null);
    }

    /// <summary>Step 2: export latest segment to frames. 1:1 flow2_export_frames.</summary>
    public static (bool Ok, string Message, string? FramesDir) ExportLatestSegmentFrames(string? projectPath, int skipFrames = 1)
    {
        var segmentDir = GetLatestSegmentDir(projectPath);
        if (segmentDir == null) return (false, "no_segment", null);
        return ComposeSegmentToFrames(segmentDir, FramesSubdir, skipFrames);
    }

    /// <summary>Delete a segment dir; only allowed under the YOLO data root.</summary>
    public static (bool Ok, string Message) DeleteSegment(string? segmentPath)
    {
        if (string.IsNullOrWhiteSpace(segmentPath) || !Directory.Exists(segmentPath))
            return (false, "segment path not found or not a directory");
        var full = Path.GetFullPath(segmentPath);
        if (!YoloDataLayout.IsUnder(full, YoloDataLayout.Root))
            return (false, "path is not under YOLO_DATA_ROOT (safety)");
        try
        {
            Directory.Delete(full, true);
            return (true, "");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>Compose each segment to frames, then copy all frames into targetDir with prefix seg_{i}_.</summary>
    public static (bool Ok, string Message, string? MergedDir) MergeSegmentsToFolder(IReadOnlyList<string> segmentPaths, string? targetDir, int skipFrames = 1, string imageExt = PngExtension)
    {
        if (segmentPaths == null || segmentPaths.Count == 0 || string.IsNullOrWhiteSpace(targetDir))
            return (false, "no segments or target dir", null);
        targetDir = Path.GetFullPath(targetDir);
        try
        {
            Directory.CreateDirectory(targetDir);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return (false, ex.Message, null);
        }
        int total = 0;
        for (var i = 0; i < segmentPaths.Count; i++)
        {
            var seg = segmentPaths[i];
            if (string.IsNullOrWhiteSpace(seg) || !Directory.Exists(seg)) continue;
            var (ok, _, framesDir) = ComposeSegmentToFrames(seg, FramesSubdir, skipFrames, imageExt);
            if (!ok || framesDir == null || !Directory.Exists(framesDir)) continue;
            var prefix = string.Format(MergePrefixFormat, i);
            foreach (var f in Directory.EnumerateFiles(framesDir).Where(f => HasExt(f, JpgExtension) || HasExt(f, PngExtension)))
            {
                try
                {
                    File.Copy(f, Path.Combine(targetDir, prefix + Path.GetFileName(f)), true);
                    total++;
                }
                catch (IOException) { }
            }
        }
        if (total == 0) return (false, "no frames exported", null);
        return (true, $"merged {total} frames", targetDir);
    }

    /// <summary>Open project dir (or its latest segment) in the file manager.</summary>
    public static bool OpenRecordDirectory(string? path, bool openLatestSegment = true)
    {
        if (string.IsNullOrWhiteSpace(path)) return false;
        var full = YoloDataLayout.TrimSeparators(Path.GetFullPath(path));
        var target = full;
        if (openLatestSegment && Directory.Exists(full))
            target = GetLatestSegmentDir(full) ?? full;
        return OpenDir(target);
    }

    /// <summary>Open an existing directory in the system file manager. 1:1 pycore system_launcher.open_dir.</summary>
    public static bool OpenDir(string? dir)
    {
        if (string.IsNullOrWhiteSpace(dir) || !Directory.Exists(dir)) return false;
        try
        {
            Process.Start(new ProcessStartInfo { FileName = dir, UseShellExecute = true });
            return true;
        }
        catch (Exception ex) when (ex is System.ComponentModel.Win32Exception or InvalidOperationException)
        {
            return false;
        }
    }

    private static string FrameName(int index, string ext) => $"frame_{index:D6}{ext}";

    private static bool IsJpg(string f) => HasExt(f, JpgExtension);

    private static bool HasExt(string f, string ext) => string.Equals(Path.GetExtension(f), ext, StringComparison.OrdinalIgnoreCase);

    private static bool PathEquals(string a, string b) =>
        string.Equals(YoloDataLayout.TrimSeparators(a), YoloDataLayout.TrimSeparators(b), OperatingSystem.IsWindows() ? StringComparison.OrdinalIgnoreCase : StringComparison.Ordinal);
}
