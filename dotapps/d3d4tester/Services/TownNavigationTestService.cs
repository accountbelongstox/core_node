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
/// then walk to navigation.target. A second click while running stops the walk.
/// </summary>
public static class TownNavigationTestService
{
    private const string LogTag = "[TownNav]";
    private static int _running;
    private static volatile bool _stopRequested;

    public static void RegisterTestAction() => TestActionRegistry.Register(I18nKeys.LogPanelTestPathfinding, Toggle);

    /// <summary>Navigation settings from config (navigation.*); debug frames follow log_settings.show_debug_logs.</summary>
    public static D3NavigationOptions ReadOptions() => new(
        ConfigBinding.GetValue(ConfigKeys.NavigationNpcModelPath, ""),
        (float)ConfigBinding.GetValue(ConfigKeys.NavigationConfidence, 0.35),
        ConfigBinding.GetValue(ConfigKeys.NavigationMaxSteps, 8),
        ConfigOptionsProvider.GetOptions<LogSettingsOptions>().ShowDebugLogs);

    private static void Toggle()
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
