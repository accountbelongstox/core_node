// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Bridge;
using DotCore.Common;

namespace DotApps.d3d4tester.Services;

/// <summary>Display text for the CoreNodeBridge plugin state, shared by the bridge panel and the bottom status bar.</summary>
public static class RosbotBridgeText
{
    public const string Empty = "-";

    /// <summary>i18n key of the plugin's live status: not installed / ROSBOT stopped / plugin not loaded / not in game / live.</summary>
    public static string LiveStatusKey(RosbotBridgeState? state, bool fresh)
    {
        if (!RosbotBridgePluginService.IsInstalled) return I18nKeys.RosbotBridgeNotInstalledHint;
        if (!fresh)
            return !RosbotBridgePluginService.IsRosbotRunning ? I18nKeys.RosbotBridgeRosbotStopped
                : state is { Enabled: false } ? I18nKeys.RosbotBridgeNotBotting
                : I18nKeys.RosbotBridgeNotLoaded;
        if (state!.Starting) return I18nKeys.RosbotBridgeStarting;
        return state.InGame ? I18nKeys.RosbotBridgeLive : I18nKeys.RosbotBridgeNotInGame;
    }

    /// <summary>User-given level-area name with its SNO id, or the unnamed-area text.</summary>
    public static string AreaText(int sno, II18nProvider p) =>
        sno == 0 ? Empty
        : RosbotBridgePluginService.GetAreaName(sno) is { } name ? $"{name} ({sno})"
        : string.Format(p.GetUiText(I18nKeys.RosbotBridgeUnnamedArea), sno);

    /// <summary>Blood shards with the hero's cap ("full" at the cap), or the bare count from an older plugin.</summary>
    public static string BloodShardsText(RosbotBridgeState s, II18nProvider p) =>
        s.MaxBloodShards <= 0 ? string.Format(p.GetUiText(I18nKeys.RosbotBridgeBloodShards), s.BloodShards, Empty)
        : string.Format(p.GetUiText(I18nKeys.RosbotBridgeBloodShards), s.BloodShards, s.MaxBloodShards)
          + (s.BloodShardsFull ? AppConstants.DisplaySeparator + p.GetUiText(I18nKeys.RosbotBridgeBloodShardsFull) : "");

    /// <summary>Location kind: town / greater rift level / rift / field.</summary>
    public static string LocationText(RosbotBridgeState s, II18nProvider p) =>
        s.InTown ? p.GetUiText(I18nKeys.RosbotBridgeTown)
        : s.GreaterRift ? string.Format(p.GetUiText(I18nKeys.RosbotBridgeGreaterRift), s.GreaterRiftLevel)
        : s.NephalemRift || s.InRift ? p.GetUiText(I18nKeys.RosbotBridgeRift)
        : p.GetUiText(I18nKeys.RosbotBridgeField);
}
