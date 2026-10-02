// PY-REF: pyapps/d3-check/ui/components/bottom_bar.py
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.I18n;
using DotCore.Common;
using DotCore.UITheme.StatusBar;

namespace DotApps.d3d4tester.StatusBar;

/// <summary>
/// D3-specific status bar display builder: implements public lib IStatusBarDisplayBuilder.
/// Single place that defines how snapshot + i18n become status bar segment text and brush keys.
/// </summary>
public sealed class D3StatusBarDisplayBuilder : IStatusBarDisplayBuilder
{
    private const string SuccessBrushKey = "TextSuccessBrush";
    private const string MutedBrushKey = "TextMutedBrush";
    private const string WarningBrushKey = "TextWarningBrush";
    private const string ErrorBrushKey = "TextErrorBrush";
    private const string ChipNeutralStyleKey = "StatusChipStyle";
    private const string ChipSuccessStyleKey = "StatusChipSuccessStyle";
    private const string ChipWarningStyleKey = "StatusChipWarningStyle";
    private const string ChipDangerStyleKey = "StatusChipDangerStyle";
    private const string ConfigTabsKeyPrefix = "ui.config_tabs.";
    private const string DefaultSkillConfig = "config1";

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

        string regionSuffix = s.BattlenetRegion == AppConstants.RegionCn ? p.GetUiText(I18nKeys.StatusServerCn) : (s.BattlenetRegion == AppConstants.RegionAsia ? p.GetUiText(I18nKeys.StatusServerAsia) : p.GetUiText(I18nKeys.StatusServerUnknown));
        string bnLabel = p.GetUiText(I18nKeys.StatusBattlenet);
        string bnText;
        string bnBrushKey;
        if (!s.BattlenetWindowFound)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusNotFound)}";
            bnBrushKey = errorKey;
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
        else if (s.BattlenetWakingUp)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusBattlenetWakingUp)} ({regionSuffix})";
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
        if (string.IsNullOrEmpty(rosFmt) || rosFmt == I18nKeys.StatusRestartCountFormat) rosFmt = "[R{count}]";
        string rosVal = s.RosbotTotalRestartCount > 0 ? rosFmt.Replace("{count}", s.RosbotTotalRestartCount.ToString()) : "-";
        string rosText = $"{rosLabel} {rosVal}";
        string rosBrushKey = s.RosbotExtendedStatus == "running" ? successKey : (s.RosbotExtendedStatus == "paused" ? warningKey : errorKey);

        string d3Label = p.GetUiText(I18nKeys.StatusD3);
        string d3Text;
        string d3BrushKey;
        if (!s.D3Running)
        {
            d3Text = $"{d3Label}: {p.GetUiText(I18nKeys.StatusNotRunning)}";
            d3BrushKey = errorKey;
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

        string mapKey = "ui.rosbot.map_" + (string.IsNullOrEmpty(s.MapType) ? "unknown" : s.MapType);
        string mapVal = p.GetUiText(mapKey) != mapKey ? p.GetUiText(mapKey) : (s.MapType ?? "unknown");
        string mapText = (p.GetUiText(I18nKeys.StatusMap) ?? "Map") + ": " + mapVal;
        string mapBrushKey = s.MapType != "unknown" ? successKey : warningKey;

        string stageKey = "ui.rosbot.stage_" + (string.IsNullOrEmpty(s.GameStage) ? "unknown" : s.GameStage);
        string stageVal = p.GetUiText(stageKey) != stageKey ? p.GetUiText(stageKey) : (s.GameStage ?? "unknown");
        string stageText = (p.GetUiText(I18nKeys.StatusStage) ?? "Stage") + ": " + stageVal;
        string stageBrushKey = s.GameStage != "unknown" ? successKey : warningKey;

        string oauthText = p.GetUiText(I18nKeys.StatusOauthScriptLabel) + ": " + (s.OauthScriptConnected ? p.GetUiText(I18nKeys.StatusOauthConnected) : p.GetUiText(I18nKeys.StatusOauthDisconnected));
        string oauthBrushKey = s.OauthScriptConnected ? successKey : errorKey;

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

        string configName = D3D4TesterConfigService.Instance.GetValueSafe(ConfigKeys.MacroConfigsCurrentSkillConfig, DefaultSkillConfig) ?? DefaultSkillConfig;
        string configKey = ConfigTabsKeyPrefix + configName;
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
            OauthText = oauthText,
            OauthBrushKey = oauthBrushKey,
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

    /// <summary>Status chip style for a builder brush key: success / warning / danger chips, neutral otherwise.</summary>
    public static string ChipStyleKeyForBrush(string brushKey) => brushKey switch
    {
        SuccessBrushKey => ChipSuccessStyleKey,
        WarningBrushKey => ChipWarningStyleKey,
        ErrorBrushKey => ChipDangerStyleKey,
        _ => ChipNeutralStyleKey,
    };
}
