// PY-REF: pyapps/d3-check/ui/components/bottom_bar.py
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Common;
using DotCore.UITheme.StatusBar;

namespace DotApps.d3d4tester.StatusBar;

/// <summary>
/// D3-specific status bar display builder: implements public lib IStatusBarDisplayBuilder.
/// Single place that defines how snapshot + i18n become status bar segment text and brush keys. While the CoreNodeBridge plugin
/// state in the snapshot is live, the D3 / map / stage segments come from it (dead / in game, level area, town / rift kind);
/// otherwise from the D3 screenshot state and the ROSBOT log.
/// </summary>
public sealed class D3StatusBarDisplayBuilder : IStatusBarDisplayBuilder
{
    private const string SuccessBrushKey = "TextSuccessBrush";
    private const string MutedBrushKey = "TextMutedBrush";
    private const string WarningBrushKey = "TextWarningBrush";
    private const string ErrorBrushKey = "TextErrorBrush";
    private const string BridgeHintSeparator = AppConstants.DisplaySeparator;
    private const string EmptyValue = "-";
    public const string ChipNeutralStyleKey = "StatusChipStyle";
    public const string ChipSuccessStyleKey = "StatusChipSuccessStyle";
    public const string ChipWarningStyleKey = "StatusChipWarningStyle";
    public const string ChipDangerStyleKey = "StatusChipDangerStyle";
    private static readonly Regex PascalBoundary = new("(?<=[a-z0-9])(?=[A-Z])", RegexOptions.Compiled);

    public static D3StatusBarDisplayBuilder Instance { get; } = new();

    public IStatusBarDisplay Build(object stateSnapshot, object i18nProvider)
    {
        var s = (GameInterfaceStateSnapshot)stateSnapshot;
        var p = (II18nProvider)i18nProvider;
        return Build(s, p);
    }

    /// <summary>Pure: snapshot + i18n -> display DTO. No side effects.</summary>
    public static D3StatusBarDisplay Build(GameInterfaceStateSnapshot s, II18nProvider p)
    {
        string successKey = SuccessBrushKey;
        string mutedKey = MutedBrushKey;
        string warningKey = WarningBrushKey;
        string errorKey = ErrorBrushKey;

        string? shownRegion = s.BattlenetUiRegion ?? s.BattlenetRegion;
        string regionSuffix = shownRegion == BattlenetConstants.RegionCn ? p.GetUiText(I18nKeys.StatusServerCn) : (shownRegion == BattlenetConstants.RegionAsia ? p.GetUiText(I18nKeys.StatusServerAsia) : p.GetUiText(I18nKeys.StatusServerUnknown));
        string bnLabel = p.GetUiText(I18nKeys.StatusBattlenet);
        string bnText;
        string bnBrushKey;
        string? bnStateText = BattlenetStateText(s.BattlenetClientState, p);
        if (s.BattlenetClientState == BattlenetClientState.TrayHidden && bnStateText != null)
        {
            bnText = $"{bnLabel}: {bnStateText}";
            bnBrushKey = warningKey;
        }
        else if (!s.BattlenetWindowFound)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusNotFound)}";
            bnBrushKey = errorKey;
        }
        else if (s.BattlenetWakingUp)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusBattlenetWakingUp)} ({regionSuffix})";
            bnBrushKey = warningKey;
        }
        else if (bnStateText != null)
        {
            bnText = $"{bnLabel}: {bnStateText} ({regionSuffix})";
            bnBrushKey = BattlenetStateBrushKey(s.BattlenetClientState);
        }
        else if (s.BattlenetDisconnected)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusBattlenetDisconnected)} ({regionSuffix})";
            bnBrushKey = warningKey;
        }
        else if (s.BattlenetOnLoginScreen)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusBattlenetOnLoginScreen)} ({regionSuffix})";
            bnBrushKey = warningKey;
        }
        else if (s.BattlenetNormalAvailable)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusBattlenetNormalAvailable)} ({regionSuffix})";
            bnBrushKey = successKey;
        }
        else
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusFoundUnknownState)}";
            bnBrushKey = warningKey;
        }

        string rosLabel = p.GetUiText(I18nKeys.StatusRos);
        string rosFmt = p.GetUiText(I18nKeys.StatusRestartCountFormat);
        string rosVal = s.RosbotTotalRestartCount > 0 ? rosFmt.Replace(I18nKeys.StatusRestartCountPlaceholder, s.RosbotTotalRestartCount.ToString()) : EmptyValue;
        string rosProcess = RosbotDetection.IsOnline(s.RosbotExtendedStatus) ? ProcessText(s.RosbotFoundExeName, s.RosbotFoundPid) : "";
        string rosText = $"{rosLabel} {rosVal}" + (rosProcess.Length > 0 ? BridgeHintSeparator + rosProcess : "");
        string rosBrushKey = RosbotBrushKey(s.RosbotExtendedStatus);

        var bridge = s.RosbotBridgeFresh ? s.RosbotBridge : null;
        string d3Label = p.GetUiText(I18nKeys.StatusD3);
        string d3Text;
        string d3BrushKey;
        if (!s.D3Running)
        {
            d3Text = $"{d3Label}: {p.GetUiText(I18nKeys.StatusNotRunning)}";
            d3BrushKey = errorKey;
        }
        else if (bridge != null)
        {
            d3Text = $"{d3Label}: {p.GetUiText(bridge.Dead ? I18nKeys.RosbotBridgeDead : bridge.InGame ? I18nKeys.StatusD3InGame : I18nKeys.RosbotBridgeNotInGame)}"
                + (bridge.InGame ? BridgeHintSeparator + RosbotBridgeText.BloodShardsText(bridge, p) : "")
                + (bridge.InventoryFull ? BridgeHintSeparator + p.GetUiText(I18nKeys.RosbotBridgeInventoryFull) : "")
                + (bridge.RepairNeeded ? BridgeHintSeparator + p.GetUiText(I18nKeys.RosbotBridgeRepairNeeded) : "");
            d3BrushKey = bridge.InGame && !bridge.Dead && !bridge.InventoryFull && !bridge.RepairNeeded ? successKey : warningKey;
        }
        else if (s.D3Disconnected)
        {
            d3Text = $"{d3Label}: {p.GetUiText(I18nKeys.StatusD3Disconnected)}";
            d3BrushKey = warningKey;
        }
        else if (s.D3OnLoginScreen)
        {
            d3Text = $"{d3Label}: {p.GetUiText(I18nKeys.StatusD3OnLoginScreen)}";
            d3BrushKey = warningKey;
        }
        else if (s.D3InGame)
        {
            d3Text = $"{d3Label}: {p.GetUiText(I18nKeys.StatusD3InGame)}";
            d3BrushKey = successKey;
        }
        else
        {
            d3Text = $"{d3Label}: {p.GetUiText(I18nKeys.StatusFound)}";
            d3BrushKey = successKey;
        }

        string mapVal;
        string mapBrushKey;
        string stageVal;
        string stageBrushKey;
        if (bridge is { InGame: true })
        {
            mapVal = RosbotBridgeText.AreaText(bridge.LevelAreaSno, p);
            mapBrushKey = bridge.LevelAreaSno != 0 ? successKey : warningKey;
            stageVal = RosbotBridgeText.LocationText(bridge, p);
            stageBrushKey = successKey;
        }
        else
        {
            const string unknown = GameInterfaceStateSnapshot.UnknownValue;
            string mapType = string.IsNullOrEmpty(s.MapType) ? unknown : s.MapType;
            string mapKey = I18nKeys.StatusMapPrefix + mapType;
            mapVal = p.GetUiText(mapKey) != mapKey ? p.GetUiText(mapKey) : mapType;
            mapBrushKey = mapType != unknown ? successKey : warningKey;
            string gameStage = string.IsNullOrEmpty(s.GameStage) ? unknown : s.GameStage;
            string stageKey = I18nKeys.StatusStagePrefix + gameStage;
            stageVal = p.GetUiText(stageKey) != stageKey ? p.GetUiText(stageKey) : gameStage;
            stageBrushKey = gameStage != unknown ? successKey : warningKey;
        }
        string mapText = p.GetUiText(I18nKeys.StatusMap) + ": " + mapVal;
        string stageText = p.GetUiText(I18nKeys.StatusStage) + ": " + stageVal;
        var (monitoringText, monitoringBrushKey) = MonitoringStatus(s, p);

        string sizeFmt = p.GetUiText(I18nKeys.StatusWindowSizeFormat);
        string windowSizeText = sizeFmt.Contains("{width}") ? sizeFmt.Replace("{width}", s.WindowWidth.ToString()).Replace("{height}", s.WindowHeight.ToString()) : $"{s.WindowWidth}x{s.WindowHeight}";
        string windowSizeBrushKey = s.WindowWidth > 0 && s.WindowHeight > 0 ? successKey : errorKey;

        // 1:1 Python bottom_bar: test-mode text only while rosbot.test_mode is on.
        bool testModeOn = D3D4TesterConfigService.Instance.GetValueSafe(ConfigKeys.RosbotTestMode, false);
        string testModeText = testModeOn ? (s.RosbotTestModeDisplay ?? "").Trim() : "";

        bool bnOk = s.PathValidBn;
        bool d3Ok = s.PathValidD3;
        bool rosOk = s.PathValidRos;
        string rosSuffix = string.IsNullOrEmpty(s.RosVersionDisplay) ? "" : " " + s.RosVersionDisplay;
        string pathBnText = (bnOk ? StatusDisplaySymbols.Found : StatusDisplaySymbols.NotFound) + " BN";
        string pathBnBrushKey = bnOk ? successKey : mutedKey;
        string pathD3Text = (d3Ok ? StatusDisplaySymbols.Found : StatusDisplaySymbols.NotFound) + " D3";
        string pathD3BrushKey = d3Ok ? successKey : mutedKey;
        string pathD4Text = StatusDisplaySymbols.NotFound + " D4";
        string pathD4BrushKey = mutedKey;
        string pathRosText = (rosOk ? StatusDisplaySymbols.Found : StatusDisplaySymbols.NotFound) + " ROS" + rosSuffix;
        string pathRosBrushKey = rosOk ? successKey : mutedKey;

        string configName = D3D4TesterConfigService.Instance.GetValueSafe(ConfigKeys.MacroConfigsCurrentSkillConfig, MacroConfigLoader.DefaultConfigName) ?? MacroConfigLoader.DefaultConfigName;
        string configKey = I18nKeys.ConfigTabsPrefix + configName;
        string configText = p.GetUiText(configKey);
        if (string.IsNullOrEmpty(configText) || configText == configKey) configText = configName;
        string currentConfigLabel = $"{p.GetUiText(I18nKeys.OptionsCurrentActiveConfig)}: {configText}";

        return new D3StatusBarDisplay
        {
            CurrentConfigLabel = currentConfigLabel,
            BattlenetText = bnText,
            BattlenetBrushKey = bnBrushKey,
            RosText = rosText,
            RosBrushKey = rosBrushKey,
            D3Text = d3Text,
            D3BrushKey = d3BrushKey,
            MapText = mapText,
            MapBrushKey = mapBrushKey,
            StageText = stageText,
            StageBrushKey = stageBrushKey,
            MonitoringText = monitoringText,
            MonitoringBrushKey = monitoringBrushKey,
            WindowSizeText = windowSizeText,
            WindowSizeBrushKey = windowSizeBrushKey,
            TestModeText = testModeText,
            PathBnText = pathBnText,
            PathBnBrushKey = pathBnBrushKey,
            PathD3Text = pathD3Text,
            PathD3BrushKey = pathD3BrushKey,
            PathD4Text = pathD4Text,
            PathD4BrushKey = pathD4BrushKey,
            PathRosText = pathRosText,
            PathRosBrushKey = pathRosBrushKey,
        };
    }

    /// <summary>ROSBOT status colour: running -> success, paused -> warning, anything else -> error. Shared by the status bar and the Monitor tab.</summary>
    public static string RosbotBrushKey(string? status) => status switch
    {
        RosbotDetection.StatusRunning => SuccessBrushKey,
        RosbotDetection.StatusPaused => WarningBrushKey,
        _ => ErrorBrushKey,
    };

    /// <summary>Monitoring (ROSBOT flow) state text and brush: paused -> warning, on -> success, off -> muted. Shared by the status bar and the Monitor tab.</summary>
    public static (string Text, string BrushKey) MonitoringStatus(GameInterfaceStateSnapshot s, II18nProvider p)
    {
        if (s.RosbotFlowMasterEnabled && s.RosbotFlowPaused) return (p.GetUiText(I18nKeys.MonitorMonitoringPaused), WarningBrushKey);
        return s.RosbotFlowMasterEnabled
            ? (p.GetUiText(I18nKeys.MonitorMonitoringOn), SuccessBrushKey)
            : (p.GetUiText(I18nKeys.MonitorMonitoringOff), MutedBrushKey);
    }

    /// <summary>"name.exe #1234" for a found process; "" when there is none. Shared by the status bar and the Monitor tab.</summary>
    public static string ProcessText(string exeName, int pid) =>
        string.IsNullOrEmpty(exeName) || pid <= 0 ? "" : $"{exeName} #{pid}";

    /// <summary>Status chip style for a builder brush key: success / warning / danger chips, neutral otherwise.</summary>
    public static string ChipStyleKeyForBrush(string brushKey) => brushKey switch
    {
        SuccessBrushKey => ChipSuccessStyleKey,
        WarningBrushKey => ChipWarningStyleKey,
        ErrorBrushKey => ChipDangerStyleKey,
        _ => ChipNeutralStyleKey,
    };

    /// <summary>i18n text for a probed client state (key ui.rosbot.battlenet_state.&lt;snake_case&gt;); null for Unknown or a missing key.</summary>
    public static string? BattlenetStateText(BattlenetClientState state, II18nProvider p)
    {
        if (state == BattlenetClientState.Unknown) return null;
        string key = I18nKeys.StatusBattlenetStatePrefix + PascalBoundary.Replace(state.ToString(), "_").ToLowerInvariant();
        string text = p.GetUiText(key);
        return string.IsNullOrEmpty(text) || text == key ? null : text;
    }

    public static string BattlenetStateBrushKey(BattlenetClientState state) => state switch
    {
        BattlenetClientState.Normal or BattlenetClientState.GameStarting => SuccessBrushKey,
        BattlenetClientState.NotRunning or BattlenetClientState.Disconnected or BattlenetClientState.LoginFailed
            or BattlenetClientState.AccountOffline => ErrorBrushKey,
        _ => WarningBrushKey,
    };
}
