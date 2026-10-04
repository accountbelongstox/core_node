// PY-REF: none (DOT-only)
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotCore.Decompile;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Decompile tab back end: toolchain under &lt;data&gt;/tools, output under &lt;data&gt;/decompiled.
/// ROSBOT = main exe (de4dot + ILSpy) + every managed plugin DLL + settings_fields.md (all [SettingsField] names = RoS-BoT.ini keys);
/// RBAssist = compiled AutoIt (autoit-ripper); any other file by kind.
/// </summary>
public static class DecompileService
{
    private const string ToolsDirName = "tools";
    private const string OutputDirName = "decompiled";
    private const string RosbotOutName = "rosbot";
    private const string RbAssistOutName = "rbassist";
    private const string FilesOutName = "files";
    private const string PluginsOutName = "plugins";
    private const string SettingsReportName = "settings_fields.md";
    private const string RbAssistExePattern = "RBAssist*.exe";
    private const int RbAssistSearchDepth = 3;
    private static readonly Regex SettingsField = new(
        @"\[SettingsField\(Name = ""(?<name>[^""]*)""(?:, Desc = ""(?<desc>[^""]*)"")?(?:, Category = ""(?<cat>[^""]*)"")?",
        RegexOptions.Compiled);

    public static string ToolsRoot => Path.Combine(ConfigPaths.CurrentUserDataPath, ToolsDirName);

    public static string OutputRoot => Path.Combine(ConfigPaths.CurrentUserDataPath, OutputDirName);

    public static DecompileTools Tools { get; } = new(ToolsRoot);

    public static Task<bool> InstallToolsAsync(Action<string> log, CancellationToken token = default) => Tools.InstallAllAsync(log, token);

    public static Task<SourceRecoveryReport> RecoverSourcesAsync(Action<string> log, CancellationToken token = default)
    {
        string rosDir = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        string executable = RosbotConstants.RosbotExePatterns.SelectMany(pattern => Directory.EnumerateFiles(rosDir, pattern)).First();
        string toolPath = Path.Combine(AppContext.BaseDirectory, "tools", "compatibility", RosbotSourceRecovery.ToolFileName);
        string dynamicCollector = Path.Combine(AppContext.BaseDirectory, "tools", "dynamic", RosbotSourceRecovery.DynamicCollectorFileName);
        return RosbotSourceRecovery.RunAsync(executable, OutputRoot, Tools, toolPath, dynamicCollector, log, token);
    }

    public static Task<DecompileChainReport> TestChainAsync(string? rbAssistPath, Action<string> log, CancellationToken token = default)
    {
        var targets = new List<string>();
        var rosDir = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        var pluginsDir = Path.Combine(rosDir, RosbotPluginConstants.PluginsDirName);
        var assist = string.IsNullOrWhiteSpace(rbAssistPath) ? FindRbAssist() : rbAssistPath.Trim();
        if (Directory.Exists(rosDir))
            targets.AddRange(RosbotConstants.RosbotExePatterns.SelectMany(pattern => Directory.EnumerateFiles(rosDir, pattern)));
        if (!targets.Any())
        {
            log("CHECK ROSBOT: FAIL configured executable not found");
            targets.Add(Path.Combine(rosDir, RosbotOutName + ".exe"));
        }
        if (Directory.Exists(pluginsDir))
            targets.AddRange(Directory.EnumerateFiles(pluginsDir, "*.dll", SearchOption.AllDirectories)
                .Where(path => BinaryInspector.Inspect(path).Kind == BinaryKind.Managed));
        targets.Add(assist ?? Path.Combine(rosDir, RbAssistOutName + ".exe"));
        return DecompileChain.RunAsync(Tools, targets, Path.Combine(OutputRoot, "chain"), log, token);
    }

    public static async Task<IReadOnlyList<DecompileResult>> DecompileRosbotAsync(Action<string> log, CancellationToken token = default)
    {
        var results = new List<DecompileResult>();
        var rosDir = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        var exe = Directory.Exists(rosDir)
            ? RosbotConstants.RosbotExePatterns.SelectMany(p => Directory.EnumerateFiles(rosDir, p)).FirstOrDefault()
            : null;
        if (exe == null)
        {
            log($"ROSBOT exe not found in '{rosDir}' (set the ROSBOT directory on the Rosbot tab or use Scan)");
            return results;
        }
        var runner = new DecompileRunner(Tools);
        string outRoot = Path.Combine(OutputRoot, RosbotOutName);
        results.Add(await runner.DecompileAsync(exe, Path.Combine(outRoot, Path.GetFileNameWithoutExtension(exe)), log, token));

        string pluginsDir = Path.Combine(rosDir, RosbotPluginConstants.PluginsDirName);
        if (Directory.Exists(pluginsDir))
        {
            foreach (var dll in Directory.EnumerateFiles(pluginsDir, "*.dll", SearchOption.AllDirectories))
            {
                if (BinaryInspector.Inspect(dll).Kind != BinaryKind.Managed) continue;
                results.Add(await runner.DecompileAsync(dll, Path.Combine(outRoot, PluginsOutName, Path.GetFileNameWithoutExtension(dll)), log, token));
            }
        }
        WriteSettingsReport(outRoot, results.Where(result => result.Ok).Select(result => result.OutputDir), log);
        return results;
    }

    public static async Task<DecompileResult?> DecompileRbAssistAsync(string? path, Action<string> log, CancellationToken token = default)
    {
        path = string.IsNullOrWhiteSpace(path) ? FindRbAssist() : path.Trim();
        if (path == null || !File.Exists(path))
        {
            log("RBAssist exe not found (choose it with Browse)");
            return null;
        }
        ConfigBinding.SetValue(ConfigKeys.ToolsRbAssistPath, path);
        var runner = new DecompileRunner(Tools);
        return await runner.DecompileAsync(path, Path.Combine(OutputRoot, RbAssistOutName, Path.GetFileNameWithoutExtension(path)), log, token);
    }

    public static Task<DecompileResult> DecompileFileAsync(string path, Action<string> log, CancellationToken token = default) =>
        new DecompileRunner(Tools).DecompileAsync(path, Path.Combine(OutputRoot, FilesOutName, Path.GetFileNameWithoutExtension(path)), log, token);

    public static Task<DecompileResult> ExportIlAsync(string path, Action<string> log, CancellationToken token = default) =>
        new DecompileRunner(Tools).ExportIlAsync(path, Path.Combine(OutputRoot, "il", Path.GetFileNameWithoutExtension(path)), log, token);

    /// <summary>Configured path, else the first RBAssist*.exe near the ROSBOT directory (its parent and grandparent, 3 levels deep).</summary>
    public static string? FindRbAssist()
    {
        var configured = ConfigBinding.GetValue(ConfigKeys.ToolsRbAssistPath, "") ?? "";
        if (File.Exists(configured)) return configured;
        var rosDir = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        if (string.IsNullOrEmpty(rosDir)) return null;
        var parent = Directory.GetParent(rosDir);
        foreach (var root in new[] { parent, parent?.Parent })
        {
            if (root == null || !root.Exists) continue;
            var hit = Directory.EnumerateFiles(root.FullName, RbAssistExePattern, new EnumerationOptions { RecurseSubdirectories = true, MaxRecursionDepth = RbAssistSearchDepth, IgnoreInaccessible = true }).FirstOrDefault();
            if (hit != null) return hit;
        }
        return null;
    }

    /// <summary>Markdown table of every ROSBOT [SettingsField] (Name = the RoS-BoT.ini key) found in the decompiled sources.</summary>
    private static void WriteSettingsReport(string outRoot, IEnumerable<string> sourceDirectories, Action<string> log)
    {
        if (!Directory.Exists(outRoot)) return;
        var sb = new StringBuilder("| Name | Category | Description | Source |\n|---|---|---|---|\n");
        int count = 0;
        foreach (var file in sourceDirectories.SelectMany(directory => Directory.EnumerateFiles(directory, "*.cs", SearchOption.AllDirectories)))
        {
            foreach (Match m in SettingsField.Matches(File.ReadAllText(file)))
            {
                sb.Append($"| {m.Groups["name"].Value} | {m.Groups["cat"].Value} | {m.Groups["desc"].Value.Replace("|", "/")} | {Path.GetFileName(file)} |\n");
                count++;
            }
        }
        if (count == 0) return;
        var path = Path.Combine(outRoot, SettingsReportName);
        File.WriteAllText(path, sb.ToString());
        log($"ROSBOT settings: {count} fields -> {path}");
    }
}
