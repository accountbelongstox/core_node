using System.Diagnostics;
using System.IO;

namespace DotCore.VocAnnotator;

/// <summary>
/// Launches the VocAnnotator app (dotapps/VocAnnotator) as a separate process.
/// Logic 1:1 with Python flow3_open_label_tool / _launch_voc_annotator_subprocess:
/// host app (e.g. d3check) calls Launch(imagesDir, projectPath) to open the annotator for labeling.
/// </summary>
public static class VocAnnotatorLauncher
{
    /// <summary>
    /// Tries to locate VocAnnotator.exe. Searches: hintAppBaseDir sibling VocAnnotator output, then PATH.
    /// </summary>
    public static string? ResolveVocAnnotatorExe(string? hintAppBaseDir = null)
    {
        var baseDir = string.IsNullOrWhiteSpace(hintAppBaseDir) ? AppContext.BaseDirectory : hintAppBaseDir;
        if (string.IsNullOrWhiteSpace(baseDir) || !Directory.Exists(baseDir))
            baseDir = Directory.GetCurrentDirectory();

        var candidates = new List<string>();
        try
        {
            var dir = new DirectoryInfo(baseDir);
            // From d3check/bin/Debug/net8.0-windows/ -> go up to repo, then dotapps/VocAnnotator/bin/...
            for (var i = 0; i < 5 && dir != null; i++, dir = dir.Parent)
            {
                var sibling = Path.Combine(dir.FullName, "VocAnnotator", "bin", "Debug", "net8.0-windows", "VocAnnotator.exe");
                if (File.Exists(sibling))
                    return Path.GetFullPath(sibling);
                var release = Path.Combine(dir.FullName, "VocAnnotator", "bin", "Release", "net8.0-windows", "VocAnnotator.exe");
                if (File.Exists(release))
                    return Path.GetFullPath(release);
            }
        }
        catch { /* ignore */ }

        var pathEnv = Environment.GetEnvironmentVariable("PATH");
        if (!string.IsNullOrWhiteSpace(pathEnv))
        {
            foreach (var part in pathEnv.Split(Path.PathSeparator, StringSplitOptions.RemoveEmptyEntries))
            {
                var exe = Path.Combine(part.Trim(), "VocAnnotator.exe");
                if (File.Exists(exe))
                    return Path.GetFullPath(exe);
            }
        }

        return null;
    }

    /// <summary>
    /// Launch VocAnnotator app. If imagesDir is set, pass as first argument so the app opens that folder.
    /// If projectPath is set, pass as --project-path so the app can load project_config from project_path/annotator_config.json.
    /// </summary>
    /// <param name="imagesDir">Optional images directory to open (frames or project dir).</param>
    /// <param name="projectPath">Optional project path (annotator_config.json parent).</param>
    /// <param name="hintAppBaseDir">Optional base dir of the calling app (e.g. AppContext.BaseDirectory) to resolve VocAnnotator.exe.</param>
    /// <returns>(true, "") on success; (false, message) on failure.</returns>
    public static (bool Success, string Message) Launch(
        string? imagesDir = null,
        string? projectPath = null,
        string? hintAppBaseDir = null)
    {
        var exe = ResolveVocAnnotatorExe(hintAppBaseDir);
        if (string.IsNullOrEmpty(exe) || !File.Exists(exe))
            return (false, "VocAnnotator.exe not found. Build dotapps/VocAnnotator or add to PATH.");

        var args = new List<string>();
        if (!string.IsNullOrWhiteSpace(imagesDir) && Directory.Exists(imagesDir))
            args.Add(imagesDir.Trim());
        if (!string.IsNullOrWhiteSpace(projectPath) && Directory.Exists(projectPath))
        {
            args.Add("--project-path");
            args.Add(projectPath.Trim());
        }

        var startInfo = new ProcessStartInfo
        {
            FileName = exe,
            ArgumentList = { },
            UseShellExecute = false,
            CreateNoWindow = false,
            WorkingDirectory = Path.GetDirectoryName(exe) ?? ""
        };
        foreach (var a in args)
            startInfo.ArgumentList.Add(a);

        try
        {
            Process.Start(startInfo);
            return (true, "");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }
}
