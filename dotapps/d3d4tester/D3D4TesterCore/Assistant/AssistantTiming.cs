// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Assistant;

/// <summary>Assistant helper delay from macro_configs.auxiliary_config.animation_speed (D3KeyHelper helperDelay: fast 100, medium 150, slow 200 ms).</summary>
public static class AssistantTiming
{
    public const string SpeedFast = "Fast";
    public const string SpeedMedium = "Medium";
    public const string SpeedSlow = "Slow";
    private const int FastMs = 100;
    private const int MediumMs = 150;
    private const int SlowMs = 200;

    public static int HelperDelayMs(string? animationSpeed) => animationSpeed?.Trim() switch
    {
        { } s when s.Equals(SpeedFast, StringComparison.OrdinalIgnoreCase) => FastMs,
        { } s when s.Equals(SpeedSlow, StringComparison.OrdinalIgnoreCase) => SlowMs,
        _ => MediumMs,
    };
}
