// PY-REF: pyapps/d3-check/controller/game_assistant_controller.py
// PY-REF: pyapps/d3-check/ui/panels/log_panel.py
using System.Drawing;
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Assistant;
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.Blacksmith;
using DotApps.d3d4tester.Core.Kanai;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils;
using DotCore.Utils.Input;

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
    private const string DebugFileTimeFormat = D3PathConstants.FileTimestampFormat;
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

    /// <summary>Register RunLog debug buttons with the real handlers (idempotent). Cursor-driven helpers (gamble, pickup, drop, convert) log a dry-run preview.
    /// Fixes Python bug: debug_kanai_upgrade ran the blacksmith salvage.</summary>
    public static void RegisterTestActions()
    {
        if (Interlocked.Exchange(ref _testActionsRegistered, 1) == 1) return;
        TestActionRegistry.Register(I18nKeys.AuxDebugBlacksmith, RunDebugBagHoverWithSalvage);
        TestActionRegistry.Register(I18nKeys.AuxDebugKanaiUpgrade, () => RunDebugInterfaceAction(D3InterfaceDetection.InterfaceKanaiCube, KanaiFlow.RunUpgradeFlow));
        TestActionRegistry.Register(I18nKeys.AuxDebugKanaiReforge, RunDebugReforge);
        TestActionRegistry.Register(I18nKeys.LogPanelItemReforge, RunDebugReforge);
        TestActionRegistry.Register(I18nKeys.LogPanelYellowUpgrade, () => RunDebugInterfaceAction(D3InterfaceDetection.InterfaceKanaiCube, KanaiFlow.RunUpgradeFlow));
        TestActionRegistry.Register(I18nKeys.LogPanelBagTest, () => RunDebugPreview(_ => BagLayoutDetector.Instance.PrintBagMemoryState(GameInterfaceData.Instance.BagLayout)));
        TestActionRegistry.Register(I18nKeys.AuxDebugAutoSalvage, () => RunDebugInterfaceAction(D3InterfaceDetection.InterfaceBlacksmith, () =>
            BlacksmithHandler.Instance.HandleAutoSalvageBySlots(KeepRule(Aux()), debugOnly: true)));
        TestActionRegistry.Register(I18nKeys.AuxDebugKanaiConvert, () => RunDebugPreview(DebugPreviewConvert));
        TestActionRegistry.Register(I18nKeys.AuxDebugBloodShard, () => RunDebugPreview(DebugPreviewBloodShard));
        TestActionRegistry.Register(I18nKeys.AuxDebugDropEquipment, () => RunDebugPreview(DebugPreviewDrop));
        TestActionRegistry.Register(I18nKeys.AuxDebugQuickPickup, DebugPreviewQuickPickup);
        TestActionRegistry.Register(I18nKeys.AuxDebugSmartPause, DebugPreviewSmartPause);
        TestActionRegistry.Register(I18nKeys.AuxDebugSoundFeedback, EventCenter.PlayFeedbackBeep);
        TestActionRegistry.Register(I18nKeys.RosbotBridgeTestSalvageRule, () => RunDebugInterfaceAction(D3InterfaceDetection.InterfaceBlacksmith, () =>
            BlacksmithHandler.Instance.HandleAutoSalvageBySlots(KeepRule(Aux()), debugOnly: false)));
        TestActionRegistry.Register(I18nKeys.RosbotBridgeTestDropRule, RunDropEquipmentTest);
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
        (int X, int Y)? cursor = ClickHandler.TryGetCursorPos(out int cx, out int cy) ? (cx, cy) : null;
        var aux = Aux();
        bool blacksmithWanted = aux.Blacksmith.Enabled || aux.AutoSalvage.Enabled;
        var (captured, resolvedType) = PrepareInterface(blacksmithWanted, state);
        if (!captured) return false;
        aux = Aux();
        bool result = resolvedType switch
        {
            D3InterfaceDetection.InterfaceKanaiCube => RunKanaiBranch(aux, cursor),
            D3InterfaceDetection.InterfaceBlacksmith => RunBlacksmithBranch(aux),
            _ => RunNoInterfaceBranch(aux, cursor, blacksmithWanted),
        };
        ColorPrinter.Blue($"{LogTag} Done");
        return result;
    }

    /// <summary>
    /// Capture and detect the interface on the full window; with an interface, collect bag info from the same image.
    /// Captured=false when the capture or bag collection failed; Type=null when no interface panel is open.
    /// </summary>
    private (bool Captured, string? Type) PrepareInterface(bool wantBlacksmith, AssistantExecutionState? state)
    {
        if (_interfaceManager.CollectUiInfo(forceNewCapture: true, saveScreenshot: false) == null)
        {
            ColorPrinter.Red($"{LogTag} Step 1 failed: no UI region");
            return (false, null);
        }
        if (state != null && StopRequested(state)) return (false, null);

        var shared = GameInterfaceData.Instance;
        string? interfaceType;
        using (var fullWindow = shared.CloneGameWindowImage())
            interfaceType = DetectInterface(fullWindow, wantBlacksmith);
        if (interfaceType == null) return (true, null);

        if (_interfaceManager.CollectBagInfoFromCurrentShared(saveScreenshot: false) == null)
        {
            ColorPrinter.Red($"{LogTag} Failed to collect bag/interface info for handler");
            return (false, null);
        }
        if (state != null && StopRequested(state)) return (false, null);
        return (true, shared.InterfaceType ?? interfaceType);
    }

    /// <summary>Priority reforge > upgrade > convert.</summary>
    private static bool RunKanaiBranch(MacroAuxiliaryOptions aux, (int X, int Y)? cursor)
    {
        int delay = AssistantTiming.HelperDelayMs(aux.AnimationSpeed);
        if (aux.KanaiReforge.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Kanai Reforge enabled in config AND interface detected in image, running reforge flow...");
            return KanaiFlow.RunReforgeFlow(aux.KanaiReforge.Mode, cursor, delay, ShouldStop);
        }
        if (aux.KanaiUpgrade.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Kanai Upgrade enabled in config AND interface detected in image, running upgrade flow...");
            return KanaiFlow.RunUpgradeFlow();
        }
        if (aux.KanaiConvert.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Kanai Convert enabled in config AND interface detected in image, running convert flow...");
            return KanaiFlow.RunConvertFlow(aux.KanaiConvert.Material, KeepRule(aux), delay, ShouldStop);
        }
        ColorPrinter.Yellow($"{LogTag} Kanai Cube interface detected in image, but no function enabled in config (reforge/upgrade/convert), skipping");
        return false;
    }

    private static bool RunBlacksmithBranch(MacroAuxiliaryOptions aux)
    {
        if (aux.AutoSalvage.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Auto salvage enabled in config, running auto salvage flow...");
            return BlacksmithHandler.Instance.HandleAutoSalvageBySlots(KeepRule(aux), aux.AutoSalvage.DebugOnly);
        }
        if (aux.Blacksmith.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Blacksmith enabled in config, running salvage operation...");
            return HandleBlacksmithUpgrade();
        }
        ColorPrinter.Yellow($"{LogTag} No blacksmith function enabled in config, skipping");
        return false;
    }

    /// <summary>
    /// No blacksmith / Kanai panel (D3KeyHelper picks the helper by cursor position): cursor in the bag + drop enabled -> drop equipment;
    /// blood shard enabled and cursor on the left vendor panel (Kadala) or quick pickup disabled -> gamble; else quick pickup.
    /// </summary>
    private bool RunNoInterfaceBranch(MacroAuxiliaryOptions aux, (int X, int Y)? cursor, bool blacksmithWanted)
    {
        int delay = AssistantTiming.HelperDelayMs(aux.AnimationSpeed);
        var shared = GameInterfaceData.Instance;
        if (aux.DropEquipment.Enabled || aux.BloodShard.Enabled)
            _interfaceManager.CollectBagInfoFromCurrentShared(saveScreenshot: false);
        var (ox, oy) = shared.WindowOffset;
        int windowW = shared.GameWindowSize.Item1;
        var bag = shared.BagCoordinates;
        bool inBag = cursor is { } c && bag != null
                     && c.X - ox >= bag.TopLeft.X && c.X - ox <= bag.BottomRight.X && c.Y - oy >= bag.TopLeft.Y && c.Y - oy <= bag.BottomRight.Y;
        bool onLeftPanel = cursor is { } l && windowW > 0 && l.X - ox < windowW * D3InterfaceConstants.LeftRegionRatio;

        if (aux.DropEquipment.Enabled && inBag)
        {
            ColorPrinter.Blue($"{LogTag} Drop equipment enabled and cursor in bag, dropping...");
            return DropEquipment.Run(KeepRule(aux), ResolveStandKey(), delay, ShouldStop);
        }
        if (aux.BloodShard.Enabled && (onLeftPanel || !aux.QuickPickup.Enabled))
        {
            ColorPrinter.Blue($"{LogTag} Blood shard enabled, gambling at cursor...");
            return BloodShardGamble.Run(aux.BloodShard.Type, delay, ShouldStop);
        }
        if (aux.QuickPickup.Enabled)
        {
            ColorPrinter.Blue($"{LogTag} Quick pickup enabled, clicking at cursor...");
            return QuickPickup.Run(delay, ShouldStop);
        }
        string msg = blacksmithWanted
            ? $"{LogTag} Blacksmith UI not found in image (bag_opened_indicator not matched in left 30%)"
            : $"{LogTag} No interface detected in image (bag_opened_indicator or kanai_cube_left_panel_indicator not matched in left 30%)";
        ColorPrinter.Yellow(msg);
        MatchDebugNotify.Notify(DebugTitle, msg);
        return false;
    }

    private static MacroAuxiliaryOptions Aux() => ConfigOptionsProvider.GetOptions<MacroAuxiliaryOptions>();

    private static string KeepRule(MacroAuxiliaryOptions aux) => aux.AutoSalvage.Keep ?? AuxiliaryFeatureOptions.AutoSalvageKeepDefault;

    private static bool ShouldStop() => AssistantExecutionState.Instance.ShouldStopAssistant();

    /// <summary>Configured force-stand key as a virtual key when "use custom stand key" is on.</summary>
    private static ushort? ResolveStandKey()
    {
        if (!ConfigBinding.GetValue(ConfigKeys.AuxiliaryUseCustomStandKey, false)) return null;
        var key = ConfigBinding.GetValue(ConfigKeys.AuxiliaryCustomStandKey, AppConstants.DefaultCustomStandKey) ?? AppConstants.DefaultCustomStandKey;
        return ClickHandler.TryResolveKey(key.Trim(), out ushort vk) ? vk : null;
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

    /// <summary>Test button: with the inventory open, read the bag from a fresh capture and really drop what the salvage keep rule removes.</summary>
    private static void RunDropEquipmentTest()
    {
        _ = Instance;
        Task.Run(() =>
        {
            try
            {
                D3InterfaceManager.Instance.CollectBagInfoQuik(forceRefresh: true, saveScreenshot: false, forceNewCapture: true);
                var aux = Aux();
                bool ok = DropEquipment.Run(KeepRule(aux), ResolveStandKey(), AssistantTiming.HelperDelayMs(aux.AnimationSpeed), ShouldStop);
                ColorPrinter.Blue($"{LogTag} Test drop equipment (rule {KeepRule(aux)}): {(ok ? "done" : "nothing dropped")}");
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} Test drop equipment failed: {ex.Message}");
            }
        });
    }

    /// <summary>Debug button: run one interface flow on a worker thread when the expected interface is open, ignoring the feature enable flags.</summary>
    private static void RunDebugInterfaceAction(string expectedType, Func<bool> action)
    {
        var controller = Instance;
        Task.Run(() =>
        {
            try
            {
                var (captured, resolvedType) = controller.PrepareInterface(expectedType == D3InterfaceDetection.InterfaceBlacksmith, state: null);
                if (!captured) return;
                if (resolvedType != expectedType)
                {
                    ColorPrinter.Yellow($"{LogTag} Debug: expected interface {expectedType}, detected {resolvedType}, skipping");
                    return;
                }
                bool ok = action();
                ColorPrinter.Blue($"{LogTag} Debug done: {expectedType} result={ok}");
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} Debug failed: {ex.Message}");
            }
        });
    }

    /// <summary>Debug preview on a worker thread: capture + bag collection, then the preview logs what the helper would do (no clicks).</summary>
    private static void RunDebugPreview(Action<MacroAuxiliaryOptions> preview)
    {
        var controller = Instance;
        Task.Run(() =>
        {
            try
            {
                if (controller._interfaceManager.CollectUiInfo(forceNewCapture: true, saveScreenshot: false) == null
                    || controller._interfaceManager.CollectBagInfoFromCurrentShared(saveScreenshot: false) == null)
                {
                    ColorPrinter.Yellow($"{LogTag} Debug preview: no D3 capture / bag info");
                    return;
                }
                preview(Aux());
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} Debug preview failed: {ex.Message}");
            }
        });
    }

    private static void RunDebugReforge() => RunDebugInterfaceAction(D3InterfaceDetection.InterfaceKanaiCube, () =>
    {
        var aux = Aux();
        return KanaiFlow.RunReforgeFlow(aux.KanaiReforge.Mode, null, AssistantTiming.HelperDelayMs(aux.AnimationSpeed), ShouldStop);
    });

    private static void DebugPreviewBloodShard(MacroAuxiliaryOptions aux)
    {
        var layout = GameInterfaceData.Instance.BagLayout;
        int empty = layout?.Items.Values.Count(i => i.Type == BagSlotValues.TypeEmpty) ?? 0;
        ColorPrinter.Blue($"{LogTag} Debug blood shard: enabled={aux.BloodShard.Enabled} type={aux.BloodShard.Type} empty bag cells={empty} delay={AssistantTiming.HelperDelayMs(aux.AnimationSpeed)}ms");
    }

    private static void DebugPreviewDrop(MacroAuxiliaryOptions aux)
    {
        int drop = 0, keep = 0;
        string rule = KeepRule(aux);
        BlacksmithHandler.Instance.ForEachGearSlotTier(GameInterfaceData.Instance, ShouldStop, (_, _, info, tier) =>
        {
            if (BlacksmithHandler.ShouldSalvage(info.Quality, tier, rule)) drop++;
            else keep++;
        });
        ColorPrinter.Blue($"{LogTag} Debug drop equipment: enabled={aux.DropEquipment.Enabled} would drop {drop}, keep {keep} (rule {rule})");
    }

    private static void DebugPreviewConvert(MacroAuxiliaryOptions aux)
    {
        var slots = BlacksmithHandler.GearSlots(GameInterfaceData.Instance);
        var byQuality = string.Join(", ", slots.GroupBy(x => x.Info.Quality).Select(g => $"{g.Key}={g.Count()}"));
        ColorPrinter.Blue($"{LogTag} Debug kanai convert: enabled={aux.KanaiConvert.Enabled} material={aux.KanaiConvert.Material} bag items: {byQuality}");
    }

    private static void DebugPreviewQuickPickup()
    {
        var aux = Aux();
        ColorPrinter.Blue($"{LogTag} Debug quick pickup: enabled={aux.QuickPickup.Enabled} delay={AssistantTiming.HelperDelayMs(aux.AnimationSpeed)}ms (runs at the cursor from the assistant hotkey)");
    }

    private static void DebugPreviewSmartPause()
    {
        var hwnd = D3WindowFinder.FindFirstHandle();
        ColorPrinter.Blue($"{LogTag} Debug smart pause: enabled={ConfigBinding.GetValue(ConfigKeys.AuxiliarySmartPause, true)} "
                          + $"d3Window={hwnd != IntPtr.Zero} d3Foreground={WindowInputHelper.IsForegroundWindow(hwnd)} standKey={ResolveStandKey()?.ToString() ?? "-"} (Tab pauses, Enter/T/M stop)");
    }

    /// <summary>ui_analysis.bag_offset for BagInfoCollector (standard-space ints + use_in_calculation).</summary>
    private static BagOffsetSettings ReadBagOffset() => new(
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetUseInCalculation, false),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetTop, 0),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetLeft, 0),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetBottom, 0),
        ConfigBinding.GetValue(ConfigKeys.UiAnalysisBagOffsetRight, 0));
}
