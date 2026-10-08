using System;
using System.Collections.Generic;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Single skill row schema (macro_configs.skill_configs.{name}.skills.{skillKey}.{field}): field names, strategy values,
/// per-row defaults and strategy normalization. Shared by the UI row view model, the config loader and MacroSkillRunner.
/// </summary>
public static class MacroSkillSchema
{
    public const string FieldKey = "key";
    public const string FieldStrategy = "strategy";
    public const string FieldInterval = "interval";
    public const string FieldDelay = "delay";
    public const string FieldRandomDelay = "random_delay";

    public const string StrategyContinuous = "continuous";
    public const string StrategySingle = "single";
    public const string StrategyHold = "hold";
    public const string StrategyIgnore = "ignore";

    public const int IntervalDefault = 100;
    public const int DelayDefault = 0;
    public const int RandomDelayDefault = 0;
    public const string PotionDefaultKey = "Q";

    public static readonly IReadOnlyList<string> Fields = new[] { FieldKey, FieldStrategy, FieldInterval, FieldDelay, FieldRandomDelay };

    /// <summary>Strategy values in dropdown order.</summary>
    public static readonly IReadOnlyList<string> StrategyValues = new[] { StrategyContinuous, StrategySingle, StrategyHold, StrategyIgnore };

    /// <summary>Legacy stored strategy values that mean "ignore".</summary>
    private static readonly HashSet<string> IgnoreAliases = new(StringComparer.Ordinal) { "drag", "disabled", "禁用", "忽略" };

    public static bool IsMouseRow(string skillKey) => skillKey is MacroSkillRunner.SkillLeftClick or MacroSkillRunner.SkillRightClick;

    /// <summary>Strategy when none is stored: missing mouse / potion rows are ignored, everything else is continuous.</summary>
    public static string DefaultStrategy(string skillKey, bool rowExists) =>
        !rowExists && (IsMouseRow(skillKey) || skillKey == MacroSkillRunner.SkillPotion) ? StrategyIgnore : StrategyContinuous;

    public static string DefaultKey(string skillKey) => skillKey == MacroSkillRunner.SkillPotion ? PotionDefaultKey : "";

    /// <summary>Empty -> defaultStrategy; legacy aliases -> ignore; known values kept; unknown -> continuous.</summary>
    public static string NormalizeStrategy(string? value, string defaultStrategy)
    {
        var v = (value ?? "").Trim().ToLowerInvariant();
        if (v.Length == 0) return defaultStrategy;
        if (IgnoreAliases.Contains(v)) return StrategyIgnore;
        foreach (var s in StrategyValues)
            if (s == v) return v;
        return StrategyContinuous;
    }
}
