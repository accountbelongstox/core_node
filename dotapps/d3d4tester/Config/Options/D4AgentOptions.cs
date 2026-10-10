// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.D4.Agent;

namespace DotApps.d3d4tester.Config.Options;

/// <summary>Reads the d4_agent section live (every start uses what the page shows) into the agent settings, clamping every number.</summary>
public static class D4AgentOptions
{
    private const char KeySeparator = ',';
    private const double PercentScale = 100.0;

    public static D4AgentSettings ReadLive()
    {
        var d = new D4AgentSettings();
        string Text(string key, string fallback) => ConfigBinding.GetValue(key, fallback)?.Trim() ?? fallback;
        int Int(string key, int min, int max, int fallback) => ConfigBinding.GetIntValue(key, min, max, fallback);
        double Double(string key, double min, double max, double fallback) => ConfigBinding.ParseDouble(ConfigBinding.GetScalarText(key), min, max, fallback);
        bool Bool(string key, bool fallback) => ConfigBinding.GetValue<bool?>(key, fallback) ?? fallback;

        string source = Text(ConfigKeys.D4AgentSource, d.Source);
        string mode = Text(ConfigKeys.D4AgentMode, d.Mode);
        return new D4AgentSettings
        {
            Source = D4AgentConstants.Sources.Contains(source) ? source : d.Source,
            VideoPath = Text(ConfigKeys.D4AgentVideoPath, d.VideoPath),
            VideoFrameStep = Int(ConfigKeys.D4AgentVideoFrameStep, 1, 120, d.VideoFrameStep),
            Mode = D4AgentConstants.Modes.Contains(mode) ? mode : d.Mode,
            ModelPath = Text(ConfigKeys.D4AgentModelPath, d.ModelPath),
            Confidence = (float)Double(ConfigKeys.D4AgentConfidence, 0.05, 0.95, d.Confidence),
            TargetFps = Double(ConfigKeys.D4AgentTargetFps, 1, 60, d.TargetFps),
            LowHealthRatio = Int(ConfigKeys.D4AgentLowHealthPercent, 0, 100, (int)(d.LowHealthRatio * PercentScale)) / PercentScale,
            SkillKeys = Text(ConfigKeys.D4AgentSkillKeys, "").Split(KeySeparator, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(k => k.ToLowerInvariant()).ToList(),
            SkillMinIntervalMs = Int(ConfigKeys.D4AgentSkillMinIntervalMs, 0, 60_000, d.SkillMinIntervalMs),
            PotionKey = Text(ConfigKeys.D4AgentPotionKey, d.PotionKey).ToLowerInvariant(),
            PotionCooldownSec = Double(ConfigKeys.D4AgentPotionCooldownSec, 0, 600, d.PotionCooldownSec),
            MenuCloseKey = Text(ConfigKeys.D4AgentMenuCloseKey, d.MenuCloseKey).ToLowerInvariant(),
            PickupLoot = Bool(ConfigKeys.D4AgentPickupLoot, d.PickupLoot),
            Explore = Bool(ConfigKeys.D4AgentExplore, d.Explore),
            MinimapRotationDeg = Double(ConfigKeys.D4AgentMinimapRotationDeg, -180, 180, d.MinimapRotationDeg),
            WalkableValueMin = Int(ConfigKeys.D4AgentWalkableValueMin, 0, 255, d.WalkableValueMin),
            WalkableValueMax = Int(ConfigKeys.D4AgentWalkableValueMax, 0, 255, d.WalkableValueMax),
            WalkableSaturationMax = Int(ConfigKeys.D4AgentWalkableSaturationMax, 0, 255, d.WalkableSaturationMax),
            DebugFrameEvery = Int(ConfigKeys.D4AgentDebugFrameEvery, 0, 100_000, d.DebugFrameEvery),
            MaxMinutes = Int(ConfigKeys.D4AgentMaxMinutes, 0, 24 * 60, d.MaxMinutes),
        };
    }
}
