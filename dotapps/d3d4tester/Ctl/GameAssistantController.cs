using System.Drawing;
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.Blacksmith;
using DotApps.d3d4tester.Core.Kanai;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;
using DotCore.ScreenCapture;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// Assistant hotkey flow: capture -> detect interface (left 30%) -> collect bag from the same image -> Kanai or blacksmith branch.
/// Blacksmith and Kanai Cube flows are mutually exclusive. 1:1 Python pyapps/d3-check/controller/game_assistant_controller.py
/// and ui/panels/log_panel.py debug_blacksmith / debug_kanai_upgrade.
/// </summary>
public sealed class GameAssistantController
{
    private const string LogTag = "[AutoUseInterface]";
    private const string DebugTitle = "AutoUseInterface";
    private const string DebugCaptureDirName = "debug_capture";
    private const string DebugLeftFilePrefix = "autouse_debug_left30_";
    private const string DebugAnnotatorFilePrefix = "autouse_annotator_";
    private const string DebugFileTimeFormat = "yyyyMMdd_HHmmss";
    private const string PngExt = ".png";

    private static readonly Lazy<GameAssistantController> LazyInstance = new(() => new GameAssistantController());
    private static int _testActionsRegistered;

    private readonly D3InterfaceManager _interfaceManager;

    private GameAssistantController()
    {
        ColorPrinter.Green("[GameAssistantController] Initializing...");
        _interfaceManager = D3InterfaceManager.Instance;
        BagInfoCollector.BagOffsetProvider ??= ReadBagOffset;
        ColorPrinter.Green("[GameAssistantController] Initialized");
    }

    /// <summary>Singleton. 1:1 get_game_assistant_controller.</summary>
    public static GameAssistantController Instance => LazyInstance.Value;

    /// <summary>Register RunLog debug buttons (blacksmith, kanai upgrade) with the real handlers (idempotent).</summary>
    public static void RegisterTestActions()
    {
        if (Interlocked.Exchange(ref _testActionsRegistered, 1) == 1) return;
        TestActionRegistry.Register(I18nKeys.AuxDebugBlacksmith, RunDebugBagHoverWithSalvage);
        TestActionRegistry.Register(I18nKeys.AuxDebugKanaiUpgrade, RunDebugBagHoverWithSalvage);
    }

    /// <summary>
    /// Hotkey entry: guard, run, always reset state. 1:1 auto_use_interface_function
    /// (the hotkey callback already checked can_start and set_should_stop).
    /// </summary>
    public bool AutoUseInterfaceFunction()
    {
        var state = AssistantExecutionState.Instance;
        if (!state.CanStart())
        {
            ColorPrinter.Yellow($"{LogTag} Cannot start: already running or disabled");
            return false;
        }
        state.SetRunning(true);
        try
        {
            ColorPrinter.Blue($"{LogTag} Started (press hotkey again to stop)");
            return Run(state);
        }
        finally
        {
            state.ResetState();
        }
    }

    private bool Run(AssistantExecutionState state)
    {
        if (StopRequested(state)) return false;

        if (_interfaceManager.CollectUiInfo(forceNewCapture: true, saveScreenshot: false) == null)
        {
            ColorPrinter.Red($"{LogTag} Step 1 failed: no UI region");
            return false;
        }
        if (StopRequested(state)) return false;

        var shared = GameInterfaceData.Instance;
        var aux = ConfigOptionsProvider.GetOptions<MacroAuxiliaryOptions>();
        bool wantBlacksmith = aux.Blacksmith.Enabled || aux.AutoSalvage.Enabled;
        string? interfaceType;
        using (var fullWindow = shared.CloneGameWindowImage())
            interfaceType = DetectInterface(fullWindow, wantBlacksmith);

        if (interfaceType == null)
        {
            string msg = wantBlacksmith
                ? $"{LogTag} Blacksmith UI not found in image (bag_opened_indicator not matched in left 30%)"
                : $"{LogTag} No interface detected in image (bag_opened_indicator or kanai_cube_left_panel_indicator not matched in left 30%)";
            ColorPrinter.Yellow(msg);
            MatchDebugNotify.Notify(DebugTitle, msg);
            return false;
        }

        if (_interfaceManager.CollectBagInfoFromCurrentShared(saveScreenshot: false) == null)
        {
            ColorPrinter.Red($"{LogTag} Failed to collect bag/interface info for handler");
            return false;
        }
        if (StopRequested(state)) return false;

        string resolvedType = shared.InterfaceType ?? interfaceType;
        aux = ConfigOptionsProvider.GetOptions<MacroAuxiliaryOptions>();
        bool result = resolvedType == D3InterfaceDetection.InterfaceKanaiCube ? RunKanaiBranch(aux) : RunBlacksmithBranch(aux);
        ColorPrinter.Blue($"{LogTag} Done");
        return result;
    }

    /// <summary>Priority reforge > upgrade > convert.</summary>
    private static bool RunKanaiBranch(MacroAuxiliaryOptions aux)
    {
        if (aux.KanaiReforge.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Kanai Reforge enabled in config AND interface detected in image, running reforge flow...");
            return KanaiFlow.RunReforgeFlow();
        }
        if (aux.KanaiUpgrade.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Kanai Upgrade enabled in config AND interface detected in image, running upgrade flow...");
            return KanaiFlow.RunUpgradeFlow();
        }
        if (aux.KanaiConvert.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Kanai Convert enabled in config AND interface detected in image, running convert flow...");
            ColorPrinter.Yellow($"{LogTag} Kanai Convert flow not yet implemented");
            return false;
        }
        ColorPrinter.Yellow($"{LogTag} Kanai Cube interface detected in image, but no function enabled in config (reforge/upgrade/convert), skipping");
        return false;
    }

    private static bool RunBlacksmithBranch(MacroAuxiliaryOptions aux)
    {
        if (aux.AutoSalvage.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Auto salvage enabled in config, running auto salvage flow...");
            return BlacksmithHandler.Instance.HandleAutoSalvageBySlots(aux.AutoSalvage.Keep ?? AuxiliaryFeatureOptions.AutoSalvageKeepDefault, aux.AutoSalvage.DebugOnly);
        }
        if (aux.Blacksmith.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Blacksmith enabled in config, running salvage operation...");
            return HandleBlacksmithUpgrade();
        }
        ColorPrinter.Yellow($"{LogTag} No blacksmith function enabled in config, skipping");
        return false;
    }

    /// <summary>Blacksmith has no upgrade; run salvage instead. 1:1 _handle_blacksmith_upgrade.</summary>
    private static bool HandleBlacksmithUpgrade()
    {
        ColorPrinter.Blue("\n[AutoUpgrade] Interface type: Blacksmith");
        ColorPrinter.Blue("[AutoUpgrade] Blacksmith does not have upgrade function");
        ColorPrinter.Blue("[AutoUpgrade] Executing salvage operation instead...");
        bool ok = BlacksmithHandler.Instance.HandleSalvageOperation();
        if (ok) ColorPrinter.Green("[AutoUpgrade] Blacksmith salvage operation completed");
        else ColorPrinter.Red("[AutoUpgrade] Blacksmith salvage operation failed");
        return ok;
    }

    /// <summary>Detect interface on the full window; DEBUG logs also save the left 30% and the annotated attempts. 1:1 _detect_interface_from_full_window.</summary>
    private static string? DetectInterface(Bitmap? fullWindow, bool wantBlacksmith)
    {
        bool showDebugLogs = ConfigOptionsProvider.GetOptions<LogSettingsOptions>().ShowDebugLogs;
        string debugDir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppConstants.AppDataDirName, DebugCaptureDirName);
        if (showDebugLogs && fullWindow != null)
            SaveLeftRegionDebug(fullWindow, debugDir);
        var attempts = showDebugLogs ? new List<InterfaceDetectionAttempt>() : null;
        var interfaceType = D3InterfaceDetection.DetectInterfaceTypeFromFullWindow(fullWindow, wantBlacksmith, debugAttempts: attempts).InterfaceType;
        if (showDebugLogs && fullWindow != null && attempts is { Count: > 0 })
        {
            try
            {
                var path = Path.Combine(debugDir, DebugAnnotatorFilePrefix + DateTime.Now.ToString(DebugFileTimeFormat) + PngExt);
                D3InterfaceDetectionDebugImage.SaveDebugImage(fullWindow, attempts, path);
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"[DEBUG]{LogTag} Failed to save annotator debug image: {ex.Message}");
            }
        }
        if (interfaceType == D3InterfaceDetection.InterfaceBlacksmith)
            ColorPrinter.Green($"{LogTag} Found bag_opened_indicator (blacksmith) in left 30% -> blacksmith flow");
        else if (interfaceType == D3InterfaceDetection.InterfaceKanaiCube)
            ColorPrinter.Green($"{LogTag} Found kanai_cube_left_panel_indicator in left 30% -> Kanai Cube flow");
        return interfaceType;
    }

    private static void SaveLeftRegionDebug(Bitmap fullWindow, string debugDir)
    {
        try
        {
            Directory.CreateDirectory(debugDir);
            int leftWidth = Math.Max(1, (int)(fullWindow.Width * D3InterfaceConstants.LeftRegionRatio));
            int h = fullWindow.Height;
            using var leftRegion = new Bitmap(leftWidth, h);
            using (var g = Graphics.FromImage(leftRegion))
                g.DrawImage(fullWindow, 0, 0, new Rectangle(0, 0, leftWidth, h), GraphicsUnit.Pixel);
            var path = Path.Combine(debugDir, DebugLeftFilePrefix + DateTime.Now.ToString(DebugFileTimeFormat) + PngExt);
            ScreenCaptureService.SaveToFile(leftRegion, path);
            ColorPrinter.Gray($"[DEBUG]{LogTag} Saved left 30% region ({leftWidth}x{h}) to: {path}");
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[DEBUG]{LogTag} Failed to save debug screenshot: {ex.Message}");
        }
    }

    private static bool StopRequested(AssistantExecutionState state)
    {
        if (!state.ShouldStopAssistant()) return false;
        ColorPrinter.Yellow($"{LogTag} Execution stopped by user");
        return true;
    }

    /// <summary>Debug bag hover on a worker thread; on the blacksmith interface it runs a real auto salvage first. 1:1 log_panel _debug_blacksmith.</summary>
    private static void RunDebugBagHoverWithSalvage()
    {
        _ = Instance;
        Task.Run(() =>
        {
            try
            {
                DebugBagHover.Run(() =>
                {
                    var keep = ConfigOptionsProvider.GetOptions<MacroAuxiliaryOptions>().AutoSalvage.Keep ?? AuxiliaryFeatureOptions.AutoSalvageKeepDefault;
                    BlacksmithHandler.Instance.HandleAutoSalvageBySlots(keep, debugOnly: false);
                });
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"[DebugBagHover] {ex.Message}");
            }
        });
    }

    /// <summary>ui_analysis.bag_offset for BagInfoCollector (standard-space ints + use_in_calculation).</summary>
    private static BagOffsetSettings ReadBagOffset() => new(
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetUseInCalculation, false),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetTop, 0),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetLeft, 0),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetBottom, 0),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetRight, 0));
}
