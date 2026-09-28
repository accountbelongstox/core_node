using DotApps.d3check.Constants;
using DotApps.d3check.Core;
using DotApps.d3check.I18n;
using DotCore.Common;
using DotCore.UITheme.StatusBar;

namespace DotApps.d3check.StatusBar;

/// <summary>
/// D3-specific status bar display builder: implements public lib IStatusBarDisplayBuilder.
/// Single place that defines how snapshot + i18n become status bar segment text and brush keys.
/// </summary>
public sealed class D3StatusBarDisplayBuilder : IStatusBarDisplayBuilder
{
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
        string successKey = "TextSuccessBrush";
        string mutedKey = "TextMutedBrush";
        string warningKey = "TextWarningBrush";
        string errorKey = "TextErrorBrush";

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
            bnText = $"{bnLabel}: Disconnected ({regionSuffix})";
            bnBrushKey = warningKey;
        }
        else if (s.BattlenetOnLoginScreen)
        {
            bnText = $"{bnLabel}: Login ({regionSuffix})";
            bnBrushKey = warningKey;
        }
        else if (s.BattlenetWakingUp)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusBattlenetWakingUp)} ({regionSuffix})";
            bnBrushKey = warningKey;
        }
        else if (s.BattlenetNormalAvailable)
        {
            bnText = $"{bnLabel}: {p.GetUiText(I18nKeys.StatusNormal)} ({regionSuffix})";
            bnBrushKey = successKey;
        }
        else
        {
            bnText = $"{bnLabel}: - ({regionSuffix})";
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
            d3Text = $"{d3Label}: {p.GetUiText(I18nKeys.StatusNotFound)}";
            d3BrushKey = errorKey;
        }
        else if (s.D3Disconnected)
        {
            d3Text = $"{d3Label}: Disconnected";
            d3BrushKey = warningKey;
        }
        else if (s.D3OnLoginScreen)
        {
            d3Text = $"{d3Label}: Login";
            d3BrushKey = warningKey;
        }
        else if (s.D3InGame)
        {
            d3Text = $"{d3Label}: In game";
            d3BrushKey = successKey;
        }
        else
        {
            d3Text = $"{d3Label}: OK";
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

        string oauthText = "OAuth: " + (s.OauthScriptConnected ? p.GetUiText(I18nKeys.StatusOauthConnected) : p.GetUiText(I18nKeys.StatusOauthDisconnected));
        string oauthBrushKey = s.OauthScriptConnected ? successKey : errorKey;

        string sizeFmt = p.GetUiText(I18nKeys.StatusWindowSizeFormat);
        string windowSizeText = sizeFmt.Contains("{width}") ? sizeFmt.Replace("{width}", s.WindowWidth.ToString()).Replace("{height}", s.WindowHeight.ToString()) : $"{s.WindowWidth}x{s.WindowHeight}";
        string windowSizeBrushKey = s.WindowWidth > 0 && s.WindowHeight > 0 ? successKey : mutedKey;

        string testModeText = s.RosbotTestModeDisplay ?? "";

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

        string currentConfigLabel = p.GetUiText(I18nKeys.OptionsCurrentActiveConfig);

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
}
