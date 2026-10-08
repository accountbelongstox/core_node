// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
using System.IO;
using System.Text.Json;
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotCore.Common;
using DotCore.Foundations;
using DotCore.UIInspect;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Debug output locations (cache, tmp, docs) and the UI-Automation JSON export used by the debug buttons.
/// 1:1 Python providor CACHE_DIR / constants TMP_DIR and timers/one_shot_tasks.py _do_window_ui_analyze(_by_hwnd) + _compute_docs_battlenet_json_path.
/// </summary>
public static class BnUiDebugPaths
{
    public const string CacheDirName = D3PathConstants.CacheDirName;
    public const string DocsDirName = "docs";
    public const string PytoolsDirName = D3PathConstants.PytoolsDirName;
    public const string TmpDirName = D3PathConstants.TmpDirName;
    private const string JsonExtension = ".json";
    private const string LogPrefix = "[RosbotPanel]";
    private const string ControlsProperty = "controls";
    private const string AutomationIdProperty = "automation_id";
    private const string NameProperty = "name";
    private const string TypeProperty = "type";
    private const char FieldSeparator = '\u001f';
    private const char RowSeparator = '\u001e';

    /// <summary>Python CACHE_DIR = {user data}/.cache.</summary>
    public static string CacheDirectory => Path.Combine(ConfigPaths.CurrentUserDataPath, CacheDirName);

    /// <summary>Python TMP_DIR = {core_node data}/pytools/tmp.</summary>
    public static string TmpDirectory => Path.Combine(AppPaths.GetUserDataDirectory(), PytoolsDirName, TmpDirName);

    /// <summary>App project docs folder when running from the source tree, else LocalAppData/{app}/docs. Created on demand.</summary>
    public static string GetDocsDirectory()
    {
        string? projectDir = FindProjectDirectory();
        string dir = projectDir != null
            ? Path.Combine(projectDir, DocsDirName)
            : Path.Combine(ConfigPaths.LocalAppDataDir, DocsDirName);
        Directory.CreateDirectory(dir);
        return dir;
    }

    /// <summary>
    /// Run a UIA window analysis into CACHE_DIR/cacheSubdir, copy the JSON to docs as {basename}_N.json (reusing a file with identical controls),
    /// log the result and open the output folder. 1:1 Python _do_window_ui_analyze / _do_window_ui_analyze_by_hwnd.
    /// </summary>
    public static void RunAnalysisAndExport(Func<WindowAnalysisResult> analyze, string cacheSubdir, string docsBasename, string logLabel, string errorNotFound)
    {
        var outputDir = Path.Combine(CacheDirectory, cacheSubdir);
        Directory.CreateDirectory(outputDir);
        WindowAnalyzer.Instance.DebugDir = outputDir;
        var result = analyze();
        if (!result.Success)
        {
            ColorPrinter.Red($"{LogPrefix} {logLabel}: {result.Error ?? errorNotFound}");
            return;
        }
        string jsonPath = result.JsonPath ?? "";
        int controlCount = result.Document?.Controls.Count ?? 0;
        string outDir = !string.IsNullOrEmpty(jsonPath) ? Path.GetDirectoryName(jsonPath) ?? outputDir : outputDir;
        string? docsJsonPath = null;
        string? copyMessage = null;
        if (!string.IsNullOrEmpty(jsonPath))
        {
            try
            {
                (docsJsonPath, copyMessage) = ResolveIndexedDocsJsonPath(GetDocsDirectory(), jsonPath, docsBasename);
                File.Copy(jsonPath, docsJsonPath, overwrite: true);
                ColorPrinter.Green($"{LogPrefix} {copyMessage}");
                ColorPrinter.Green($"{LogPrefix} Docs: {docsJsonPath}");
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                docsJsonPath = null;
                copyMessage = null;
                ColorPrinter.Yellow($"{LogPrefix} Copy to docs failed: {ex.Message}");
            }
        }
        ColorPrinter.Blue($"{LogPrefix} {logLabel}: {jsonPath}");
        ColorPrinter.Blue($"{LogPrefix} {controlCount} controls");
        if (docsJsonPath != null) ColorPrinter.Blue($"{LogPrefix} Docs copy: {docsJsonPath}");
        if (copyMessage != null) ColorPrinter.Blue($"{LogPrefix} {copyMessage}");
        ShellOpen.OpenDir(outDir);
    }

    /// <summary>
    /// docs/{basename}_N.json: the existing file whose controls (automation_id, name, type; order-insensitive) equal the new ones, else the next index.
    /// 1:1 Python _compute_docs_battlenet_json_path.
    /// </summary>
    public static (string Path, string Message) ResolveIndexedDocsJsonPath(string docsDir, string newJsonPath, string basename)
    {
        string newNorm = NormalizeControls(newJsonPath) ?? "";
        var pattern = new Regex("^" + Regex.Escape(basename) + @"_(\d+)\.json$");
        var existing = new List<(int Index, string Path)>();
        foreach (var file in Directory.EnumerateFiles(docsDir, "*" + JsonExtension))
        {
            var m = pattern.Match(Path.GetFileName(file));
            if (m.Success && int.TryParse(m.Groups[1].Value, out int idx)) existing.Add((idx, file));
        }
        foreach (var (_, file) in existing.OrderBy(e => e.Index))
            if (NormalizeControls(file) == newNorm)
                return (file, $"Content identical to existing {Path.GetFileName(file)}, overwrote it.");
        int next = existing.Count > 0 ? existing.Max(e => e.Index) + 1 : 1;
        string target = Path.Combine(docsDir, $"{basename}_{next}{JsonExtension}");
        return (target, $"Saved as {Path.GetFileName(target)}.");
    }

    /// <summary>Sorted (automation_id, name, type) rows of the "controls" array; null when the file is unreadable. 1:1 Python _normalize_controls_for_compare.</summary>
    private static string? NormalizeControls(string jsonPath)
    {
        try
        {
            using var doc = JsonDocument.Parse(File.ReadAllText(jsonPath));
            if (doc.RootElement.ValueKind != JsonValueKind.Object || !doc.RootElement.TryGetProperty(ControlsProperty, out var controls)
                || controls.ValueKind != JsonValueKind.Array)
                return "";
            var rows = controls.EnumerateArray()
                .Select(c => string.Join(FieldSeparator, Field(c, AutomationIdProperty), Field(c, NameProperty), Field(c, TypeProperty)))
                .OrderBy(r => r, StringComparer.Ordinal);
            return string.Join(RowSeparator, rows);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or JsonException)
        {
            return null;
        }
    }

    private static string Field(JsonElement control, string name) =>
        control.ValueKind == JsonValueKind.Object && control.TryGetProperty(name, out var v) && v.ValueKind == JsonValueKind.String
            ? (v.GetString() ?? "").Trim()
            : "";

    private static string? FindProjectDirectory() => SourcePaths.AppSourceDir;
}
