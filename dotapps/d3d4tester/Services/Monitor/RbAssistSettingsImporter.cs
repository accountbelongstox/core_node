// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Monitor;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>Result of an RBAssist settings import.</summary>
public sealed record RbAssistImportResult(int Settings, int Triggers, int SkippedTriggers);

/// <summary>
/// Imports RBAssistSettings.ini (UTF-16, next to the RBAssist exe) into the app config: options that already exist in the app are written
/// to their existing keys (startup shortcut, log-timeout switch and minutes), the rest to monitor.*; paths are only filled when empty;
/// [Triggers] rows are appended (notification credentials fill empty channel settings).
/// </summary>
public static class RbAssistSettingsImporter
{
    public const string SettingsFileName = "RBAssistSettings.ini";
    private const string CheckedValue = "1";
    private const string RosbotExeName = "RoS-BoT.exe";

    /// <summary>RBAssist General/comboServer (国服 = China, 外服 = global) -> battlenet.region (selects the D3CN / D3 launch product).</summary>
    private static readonly Dictionary<string, string> ServerRegions = new(StringComparer.Ordinal)
    {
        ["国服"] = BattlenetConstants.RegionCn,
        ["外服"] = BattlenetConstants.RegionAsia,
    };

    private static readonly Dictionary<string, string> PriorityNames = new(StringComparer.Ordinal)
    {
        ["实时"] = ProcessTuning.PriorityRealtime, ["高"] = ProcessTuning.PriorityHigh, ["高于普通"] = ProcessTuning.PriorityAboveNormal,
        ["普通"] = ProcessTuning.PriorityNormal, ["低于普通"] = ProcessTuning.PriorityBelowNormal, ["低"] = ProcessTuning.PriorityLow,
        ["Realtime"] = ProcessTuning.PriorityRealtime, ["High"] = ProcessTuning.PriorityHigh, ["Above Normal"] = ProcessTuning.PriorityAboveNormal,
        ["Normal"] = ProcessTuning.PriorityNormal, ["Below Normal"] = ProcessTuning.PriorityBelowNormal, ["Low"] = ProcessTuning.PriorityLow
    };

    private static readonly (string Kind, string Prefix)[] ScreenshotKinds =
    {
        (MonitorScreenshotKinds.Periodic, "screenshotPeriodic"), (MonitorScreenshotKinds.Death, "screenshotDeath"),
        (MonitorScreenshotKinds.Fail, "screenshotFail"), (MonitorScreenshotKinds.Error, "screenshotError")
    };

    /// <summary>RBAssistSettings.ini next to the configured RBAssist exe (tools.rbassist_path), or null.</summary>
    public static string? FindDefaultSettingsFile()
    {
        string exe = ConfigBinding.GetValue(ConfigKeys.ToolsRbAssistPath, "") ?? "";
        string? dir = exe.Length > 0 ? Path.GetDirectoryName(exe) : null;
        string? path = dir != null ? Path.Combine(dir, SettingsFileName) : null;
        return path != null && File.Exists(path) ? path : null;
    }

    public static RbAssistImportResult Import(string iniPath)
    {
        var ini = ReadIni(iniPath);
        int settings = 0;
        void Set(string key, object value)
        {
            ConfigBinding.SetValue(key, value);
            settings++;
        }
        string Get(string section, string key) => ini.TryGetValue(section, out var s) && s.TryGetValue(key, out var v) ? v : "";
        bool Has(string section, string key) => ini.TryGetValue(section, out var s) && s.ContainsKey(key);
        void SetBool(string section, string key, string target)
        {
            if (Has(section, key)) Set(target, Get(section, key) == CheckedValue);
        }
        void SetInt(string section, string key, string target, int min, int max)
        {
            if (int.TryParse(Get(section, key), NumberStyles.Integer, CultureInfo.InvariantCulture, out int v)) Set(target, Math.Clamp(v, min, max));
        }
        void SetText(string section, string key, string target)
        {
            if (Has(section, key)) Set(target, Get(section, key));
        }

        const string general = "General", advanced = "Advanced", crash = "CrashRecovery", shots = "Screenshots";
        SetBool(general, "startWithWindows", ConfigKeys.RosbotStartup);
        SetBool(general, "startMonitoring", ConfigKeys.MonitorAutoStartOnLaunch);
        SetBool(general, "checkboxminD3", ConfigKeys.MonitorD3ShrinkOnStart);
        SetInt(general, "mind3w", ConfigKeys.MonitorD3ShrinkWidth, MonitorSettings.D3ShrinkMinWidth, int.MaxValue);
        SetInt(general, "mind3h", ConfigKeys.MonitorD3ShrinkHeight, MonitorSettings.D3ShrinkMinHeight, int.MaxValue);
        string botPath = Get(general, "botPath");
        if (botPath.EndsWith(RosbotExeName, StringComparison.OrdinalIgnoreCase) && (ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "").Length == 0)
            Set(ConfigKeys.RosSettingsRosDirectory, Path.GetDirectoryName(botPath) ?? "");
        if (ServerRegions.TryGetValue(Get(general, "comboServer"), out var region)) Set(ConfigKeys.BattlenetRegion, region);
        string bnPath = Get(general, "btlntPath");
        if (bnPath.Length > 0 && (ConfigBinding.GetValue(ConfigKeys.BattlenetPath, "") ?? "").Length == 0)
            Set(ConfigKeys.BattlenetPath, bnPath);
        SetText(general, "portal_id", ConfigKeys.MonitorProbePortalKeys);
        SetText(general, "urshi", ConfigKeys.MonitorProbeUrshi);
        SetText(general, "finishill", ConfigKeys.MonitorProbeFinishIllusion);
        SetText(general, "findill", ConfigKeys.MonitorProbeFindIllusion);
        SetInt(general, "fight", ConfigKeys.MonitorProbeFight, 0, int.MaxValue);
        SetInt(general, "tp", ConfigKeys.MonitorProbeTownPortal, 0, int.MaxValue);

        SetBool(advanced, "showAdvanced", ConfigKeys.MonitorTuningEnabled);
        if (PriorityNames.TryGetValue(Get(advanced, "D3processPriority"), out var d3Priority)) Set(ConfigKeys.MonitorTuningD3Priority, d3Priority);
        if (PriorityNames.TryGetValue(Get(advanced, "RBprocessPriority"), out var rbPriority)) Set(ConfigKeys.MonitorTuningRosbotPriority, rbPriority);
        string d3Cpus = CpuList(ini, advanced, "D3CPU"), rbCpus = CpuList(ini, advanced, "RBCPU");
        if (d3Cpus.Length > 0) Set(ConfigKeys.MonitorTuningD3Cpus, d3Cpus);
        if (rbCpus.Length > 0) Set(ConfigKeys.MonitorTuningRosbotCpus, rbCpus);

        SetBool(crash, "restartOnError", ConfigKeys.MonitorRestartOnErrorPopup);
        SetBool(crash, "restartOnlogs", ConfigKeys.BattlenetTimeoutRestart);
        SetInt(crash, "restartOnlogsTime", ConfigKeys.RosbotTimeoutMinutes, RosbotConstants.RosbotLogTimeoutMinutesMin, RosbotConstants.RosbotLogTimeoutMinutesMax);
        if (Has(crash, "StrictMode"))
            Set(ConfigKeys.MonitorLogTimeoutMode, Get(crash, "StrictMode") == CheckedValue ? MonitorLogTimeoutModes.Either : MonitorLogTimeoutModes.Both);
        SetBool(crash, "restartbt", ConfigKeys.MonitorRestartBattlenetOnRestart);
        SetBool(crash, "d3Memory", ConfigKeys.MonitorD3MemoryRestart);
        SetInt(crash, "d3MemoryAmt", ConfigKeys.MonitorD3MemoryLimitMb, 1, int.MaxValue);
        if (Get(crash, "pushplus") == CheckedValue)
        {
            Set(ConfigKeys.MonitorNotifyOnRestart, true);
            Set(ConfigKeys.MonitorNotifyRestartChannel, MonitorNotifyChannels.PushPlus);
        }
        string ppToken = Get(crash, "pptoken");
        if (ppToken.Length > 0)
        {
            MonitorSettings.SetSecret(ConfigKeys.MonitorNotifyPushPlusToken, ppToken);
            settings++;
        }

        foreach (var (kind, prefix) in ScreenshotKinds)
        {
            SetBool(shots, prefix, ConfigKeys.MonitorScreenshotKey(kind, ConfigKeys.MonitorScreenshotEnabledSuffix));
            SetInt(shots, prefix + "Keep", ConfigKeys.MonitorScreenshotKey(kind, ConfigKeys.MonitorScreenshotKeepSuffix), 0, int.MaxValue);
            SetText(shots, prefix + "Path", ConfigKeys.MonitorScreenshotKey(kind, ConfigKeys.MonitorScreenshotDirSuffix));
        }
        SetInt(shots, "screenshotPeriodicTime", ConfigKeys.MonitorScreenshotPeriodicMinutes, 1, int.MaxValue);
        SetText(shots, "screenshotCropCoords", ConfigKeys.MonitorScreenshotCrop);
        if (Has(shots, "screenshotCrop")) Set(ConfigKeys.MonitorScreenshotCropCustom, Get(shots, "screenshotCrop") != CheckedValue);

        var (added, skipped) = ImportTriggers(ini.TryGetValue("Triggers", out var rows) ? rows.Values : Array.Empty<string>());
        MonitorLog.Info($"RBAssist import from {iniPath}: settings={settings} triggers={added} skipped={skipped}");
        return new RbAssistImportResult(settings, added, skipped);
    }

    /// <summary>Append trigger rows (RBAssist strings or our JSON); returns (added, skipped).</summary>
    public static (int Added, int Skipped) ImportTriggers(IEnumerable<string> rows)
    {
        var engine = TriggerEngine.Instance;
        var list = engine.Triggers.ToList();
        int added = 0, skipped = 0;
        foreach (var raw in rows)
        {
            string row = raw.Trim();
            if (row.Length == 0) continue;
            ImportedChannelCredentials? credentials = null;
            var def = row.StartsWith('{') ? TriggerDefinition.FromJson(row) : RbAssistTriggerImport.Parse(row, out credentials);
            if (def == null || !MonitorEvents.All.Contains(def.Event) || !MonitorActions.All.Contains(def.Action))
            {
                skipped++;
                MonitorLog.Warn($"Trigger skipped (unsupported): {row}");
                continue;
            }
            if (credentials != null) MergeCredentials(credentials);
            list.Add(def);
            added++;
        }
        if (added > 0) engine.Save(list);
        return (added, skipped);
    }

    private static void MergeCredentials(ImportedChannelCredentials c)
    {
        void Fill(string key, string value, bool secret)
        {
            if (value.Length == 0) return;
            if (secret ? MonitorSettings.GetSecret(key).Length > 0 : MonitorSettings.GetString(key).Length > 0) return;
            if (secret) MonitorSettings.SetSecret(key, value);
            else ConfigBinding.SetValue(key, value);
        }
        switch (c.Channel)
        {
            case MonitorNotifyChannels.Telegram:
                Fill(ConfigKeys.MonitorNotifyTelegramToken, c.Value, true);
                Fill(ConfigKeys.MonitorNotifyTelegramChatId, c.Value2, false);
                break;
            case MonitorNotifyChannels.Discord:
                Fill(ConfigKeys.MonitorNotifyDiscordWebhook, c.Value, true);
                break;
            case MonitorNotifyChannels.Prowl:
                Fill(ConfigKeys.MonitorNotifyProwlApiKey, c.Value, true);
                break;
        }
    }

    private static string CpuList(Dictionary<string, Dictionary<string, string>> ini, string section, string prefix)
    {
        if (!ini.TryGetValue(section, out var s)) return "";
        var cpus = s.Where(kv => kv.Key.StartsWith(prefix, StringComparison.Ordinal) && kv.Value == CheckedValue)
            .Select(kv => int.TryParse(kv.Key[prefix.Length..], NumberStyles.Integer, CultureInfo.InvariantCulture, out int n) ? n : -1)
            .Where(n => n >= 0).OrderBy(n => n).ToList();
        bool all = cpus.Count == s.Keys.Count(k => k.StartsWith(prefix, StringComparison.Ordinal));
        return all ? "" : string.Join(",", cpus);
    }

    /// <summary>Sections -> ordered key/value (BOM-detected; RBAssist writes UTF-16 LE).</summary>
    private static Dictionary<string, Dictionary<string, string>> ReadIni(string path)
    {
        var result = new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, string>? current = null;
        using var reader = new StreamReader(path, Encoding.UTF8, detectEncodingFromByteOrderMarks: true);
        string? line;
        while ((line = reader.ReadLine()) != null)
        {
            string t = line.Trim();
            if (t.Length == 0 || t.StartsWith(';')) continue;
            if (t.StartsWith('[') && t.EndsWith(']'))
            {
                current = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                result[t[1..^1]] = current;
                continue;
            }
            int eq = t.IndexOf('=');
            if (current == null || eq <= 0) continue;
            current[t[..eq].Trim()] = t[(eq + 1)..].Trim();
        }
        return result;
    }
}
