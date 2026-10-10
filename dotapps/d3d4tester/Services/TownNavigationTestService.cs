// PY-REF: none (DOT-only; Python "test pathfinding" only printed start/complete texts)
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Navigation;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "Test pathfinding" button: detect every town target and NPC panel element in the D3 frame with the YOLO NPC model (enchant affixes read by OCR),
/// then walk to navigation.target; the town operation buttons run D3TownNavigator.Run (repair, salvage, enchant read, cube, Kadala).
/// A second click while running stops the walk or operation.
/// </summary>
public static class TownNavigationTestService
{
    private const string LogTag = "[TownNav]";
    private static int _running;
    private static volatile bool _stopRequested;

    private static readonly (string Key, D3TownOperation Operation)[] OperationButtons =
    {
        (I18nKeys.LogPanelTownRepair, D3TownOperation.Repair), (I18nKeys.LogPanelTownSalvage, D3TownOperation.Salvage),
        (I18nKeys.LogPanelTownEnchant, D3TownOperation.Enchant), (I18nKeys.LogPanelTownKanai, D3TownOperation.KanaiCube),
        (I18nKeys.LogPanelTownKadala, D3TownOperation.Kadala),
    };

    public static void RegisterTestAction()
    {
        TestActionRegistry.Register(I18nKeys.LogPanelTestPathfinding, () => Toggle(null));
        foreach (var (key, operation) in OperationButtons) TestActionRegistry.Register(key, () => Toggle(operation));
    }

    /// <summary>Navigation settings from config (navigation.*); debug frames follow log_settings.show_debug_logs.</summary>
    public static D3NavigationOptions ReadOptions() => new(
        ConfigBinding.GetValue(ConfigKeys.NavigationNpcModelPath, ""),
        (float)ConfigBinding.GetValue(ConfigKeys.NavigationConfidence, 0.35),
        ConfigBinding.GetValue(ConfigKeys.NavigationMaxSteps, 8),
        ConfigOptionsProvider.GetOptions<LogSettingsOptions>().ShowDebugLogs);

    /// <summary>operation null = pathfinding test; else run that NPC operation (D3TownNavigator.Run). A click while running stops it.</summary>
    private static void Toggle(D3TownOperation? operation)
    {
        if (Interlocked.Exchange(ref _running, 1) == 1)
        {
            _stopRequested = true;
            ColorPrinter.Yellow($"{LogTag} Stop requested");
            return;
        }
        _stopRequested = false;
        D3TownNavigator.DebugDir = ConfigPaths.DebugCaptureDir;
        Task.Run(() =>
        {
            try
            {
                var options = ReadOptions();
                if (operation is { } op)
                {
                    var result = D3TownNavigator.Instance.Run(op, options, () => _stopRequested);
                    ColorPrinter.Blue($"{LogTag} {op}: {result.Outcome}");
                    return;
                }
                var target = ConfigBinding.GetValue(ConfigKeys.NavigationTarget, D3TownTargets.Blacksmith) ?? D3TownTargets.Blacksmith;
                if (Array.IndexOf(D3TownTargets.All, target) < 0) target = D3TownTargets.Blacksmith;
                var navigator = D3TownNavigator.Instance;
                navigator.DetectOnce(options);
                var outcome = navigator.NavigateTo(target, options, () => _stopRequested);
                ColorPrinter.Blue($"{LogTag} Test pathfinding to {target}: {outcome}");
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} {ex.Message}");
            }
            finally
            {
                Interlocked.Exchange(ref _running, 0);
            }
        });
    }
}
