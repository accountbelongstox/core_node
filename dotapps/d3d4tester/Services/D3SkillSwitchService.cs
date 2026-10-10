// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Core.Planner;
using DotApps.d3d4tester.Services.Monitor;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "Switch skills" for the selected maxroll gear set: makes sure the class icons are cached, pauses a botting ROSBOT with its pause key
/// (it must not cast while the skill menus are open) and resumes it afterwards, then runs <see cref="D3SkillSwitcher"/> with the chosen
/// method. The plugin method asks the CoreNodeBridge plugin (skills_check) for the hero level and which planned skills / runes /
/// passives are active, before and after the switch. One run at a time.
/// </summary>
public static class D3SkillSwitchService
{
    private const string LogTag = "[SkillSwitch]";
    private const string DebugSubdir = "skill_switch";
    private static readonly TimeSpan CheckTimeout = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan CheckFlowTimeout = TimeSpan.FromSeconds(15);
    private const char PartSeparator = ';';
    private const char ListSeparator = ',';
    private const char PairSeparator = ':';
    private const char ValueSeparator = '=';
    private const string KeyLevel = "level";
    private const string KeySkills = "skills";
    private const string KeyPassives = "passives";
    private const string CodeOk = "1";
    private const string CodeUnresolved = "?";
    private const char FirstRune = 'a';

    private static int _running;

    public static bool IsRunning => Volatile.Read(ref _running) == 1;

    /// <summary>True when the bridge plugin publishes fresh state (ROSBOT running with the plugin enabled): the plugin method can be used.</summary>
    public static bool PluginAvailable => GameInterfaceData.Instance.GetStateSnapshot().RosbotBridgeFresh;

    /// <summary>Run the switch for the selected gear set; null when another run is going or no gear set is selected.</summary>
    public static async Task<SkillSwitchResult?> RunAsync(SkillSwitchMethod method, bool reuseCache, Action<SkillSwitchStep>? progress = null)
    {
        if (D3PlannerService.Build is not { } build || D3PlannerService.Profile is not { } profile) return null;
        if (Interlocked.Exchange(ref _running, 1) == 1) return null;
        D3SkillSwitcher.DebugDir = Path.Combine(ConfigPaths.DebugCaptureDir, DebugSubdir);
        var watch = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            string cacheDir = D3PlannerService.CacheDir;
            await D3SkillIcons.EnsureAsync(cacheDir, build.Class).ConfigureAwait(false);
            bool pausedHere = false;
            if (!RosbotFlowRunner.IsPaused && RosbotDetection.IsBotting(GameInterfaceData.Instance.GetStateSnapshot()))
            {
                await RosbotFlowRunner.Pause().ConfigureAwait(false);
                pausedHere = true;
            }
            try
            {
                MonitorLog.Info($"{LogTag} {build.Name} / {profile.Name}: {method}, reuse cache {reuseCache}");
                var result = await Task.Run(() => D3SkillSwitcher.Run(profile, build.Class, cacheDir, method,
                    method == SkillSwitchMethod.Plugin ? () => PluginCheck(build.Class, profile) : null, () => false, progress, reuseCache)).ConfigureAwait(false);
                MonitorLog.Info($"{LogTag} {result.Outcome}: {result.Detail} (switch {result.Elapsed.TotalSeconds:F1} s)");
                return result;
            }
            finally
            {
                if (pausedHere) RosbotFlowRunner.Resume();
            }
        }
        finally
        {
            MonitorLog.Info($"{LogTag} total time {watch.Elapsed.TotalSeconds:F1} s");
            Interlocked.Exchange(ref _running, 0);
        }
    }

    /// <summary>skills_check through the plugin: "class;key:runeIndex,...;passive,...", answer parsed into per-target results.</summary>
    private static SkillCheckResult? PluginCheck(string cls, PlannerProfile profile)
    {
        var skills = Enumerable.Range(0, profile.Skills.Count == 0 ? 0 : profile.Skills.Max(s => s.SlotIndex) + 1)
            .Select(i => profile.Skills.FirstOrDefault(s => s.SlotIndex == i)).ToList();
        string value = cls + PartSeparator
            + string.Join(ListSeparator, skills.Where(s => s != null).Select(s => s!.Id + PairSeparator + RuneIndex(s.Rune).ToString(CultureInfo.InvariantCulture)))
            + PartSeparator + string.Join(ListSeparator, profile.Passives.Select(p => p.Id));
        var answer = RosbotBridgePluginService.SendCommandAndWait(FlowContext.WithTimeout(CheckFlowTimeout), CheckTimeout, RosbotPluginConstants.BridgeActionSkillsCheck, value: value);
        if (answer is not { Ok: true } r) return null;
        var parts = r.Message.Split(PartSeparator).Select(p => p.Split(ValueSeparator, 2)).Where(p => p.Length == 2).ToDictionary(p => p[0], p => p[1]);
        int level = parts.TryGetValue(KeyLevel, out var lv) && int.TryParse(lv, NumberStyles.Integer, CultureInfo.InvariantCulture, out int l) ? l : 0;
        var skillCodes = Codes(parts.GetValueOrDefault(KeySkills));
        var passiveCodes = Codes(parts.GetValueOrDefault(KeyPassives));
        var skillResults = Enumerable.Range(0, D3SkillSwitcher.SlotCount).Select(i =>
            profile.Skills.FirstOrDefault(s => s.SlotIndex == i) is { } s && skillCodes.TryGetValue(s.Id, out var c) ? Code(c) : null).ToList();
        var passiveResults = profile.Passives.Select(p => passiveCodes.TryGetValue(p.Id, out var c) ? Code(c) : null).ToList();
        return new SkillCheckResult(level, skillResults, passiveResults);
    }

    private static Dictionary<string, string> Codes(string? list) =>
        (list ?? "").Split(ListSeparator, StringSplitOptions.RemoveEmptyEntries).Select(e => e.Split(PairSeparator, 2)).Where(e => e.Length == 2)
            .GroupBy(e => e[0]).ToDictionary(g => g.Key, g => g.First()[1], StringComparer.Ordinal);

    private static bool? Code(string code) => code == CodeUnresolved ? null : code == CodeOk;

    /// <summary>maxroll rune letter a..e -> D3 rune index 0..4 (-1 = no rune).</summary>
    private static int RuneIndex(string rune) => rune.Length == 1 && rune[0] >= FirstRune ? rune[0] - FirstRune : -1;
}
