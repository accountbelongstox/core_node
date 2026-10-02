// PY-REF: pyapps/d3-check/main.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_manager.py
using System.Diagnostics;
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Services;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Ctl;

/// <summary>
/// ROSBOT flow controller: one-shot F1 -> B (delegates to Core.Flow.BattlenetReadyFlow) -> D (launch D3 from BN) -> E (start ROSBOT),
/// and Battle.net flow hook installation. The BN-only tick runs from RosbotTaskProcessor (TickDriver flow step).
/// </summary>
public static class RosbotFlowController
{
    private const int FlowStepIntervalMs = TickDriver.TickIntervalMs * TickDriver.TickFlowStep;

    private static readonly object HooksLock = new();
    private static bool _hooksInstalled;

    static RosbotFlowController()
    {
        InstallHooks();
    }

    /// <summary>Set the UI-thread presenter for the credentials dialog (MainWindow OnLoaded); also installs the Battle.net flow hooks.</summary>
    public static void SetShowCredentialsDialogAndWait(Func<string, bool>? showAndWait)
    {
        AsiaCredentialsService.SetDialogPresenter(showAndWait);
        InstallHooks();
    }

    /// <summary>Wire Core Battle.net flow hooks to app services (config, credentials dialog, OAuth bridge, event hub, status provider). Idempotent.</summary>
    public static void InstallHooks()
    {
        lock (HooksLock)
        {
            if (_hooksInstalled) return;
            _hooksInstalled = true;
        }
        BattlenetFlowHooks.RegionCacheProvider = () => ConfigOptionsProvider.GetOptions<RosSettingsOptions>().BattlenetRegionCache;
        BattlenetFlowHooks.GetAsiaCredentials = () => AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia) is { } c ? (c.email, c.password) : null;
        BattlenetFlowHooks.CredentialsDialogPending = () => AsiaCredentialsService.IsDialogPending;
        BattlenetFlowHooks.ScheduleCredentialsDialog = () => AsiaCredentialsService.ScheduleCredentialsDialog(AsiaCredentialsService.RegionAsia);
        BattlenetFlowHooks.ResetOauthDone = OAuthCallbackState.ResetOauthDone;
        BattlenetFlowHooks.NotifyOauthDone = OAuthCallbackState.NotifyOauthDone;
        BattlenetFlowHooks.TriggerExtensionRosbotStart = EventCenter.TriggerExtensionRosbotStart;
        BattlenetFlowHooks.RefreshBattlenetStatus = () => BattlenetStatusProvider.Refresh().Changed;
        BattlenetFlowHooks.NotifyStateSync = GameInterfaceData.Instance.NotifyCallbacks;
        ShutdownManager.RegisterShutdownHook(BattlenetReadyFlow.ResetFlowMasterBnBlock);
    }

    /// <summary>F1: D3 online? (process with main window). 1:1 with PY d3_running / F1 branch.</summary>
    public static bool IsD3Running()
    {
        try
        {
            foreach (var p in Process.GetProcessesByName("Diablo III"))
            {
                try
                {
                    if (p.MainWindowHandle != IntPtr.Zero)
                        return true;
                }
                catch { /* ignore */ }
                finally { p.Dispose(); }
            }
        }
        catch { /* ignore */ }
        return false;
    }

    /// <summary>
    /// Run flow once: F1 (D3 online?) -> no: B block via BattlenetReadyFlow ticks (Flow-master context) until confirmed -> D block
    /// (launch D3 from BN) -> E block. Runs on the thread pool.
    /// </summary>
    public static async Task<bool> RunAsync()
    {
        await Task.Yield();
        var game = GameInterfaceData.Instance;
        string? region = EnsureRegion();
        if (string.IsNullOrEmpty(region))
        {
            ColorPrinter.Yellow("[Flow] Region unknown.");
            return false;
        }
        if (BattlenetManager.Instance.GetPath() == null)
        {
            ColorPrinter.Yellow("[Flow] Battle.net path not set or file not found.");
            return false;
        }

        var op = BattlenetOperationFactory.GetOperation(region);
        bool f1D3Online = IsD3Running();
        if (f1D3Online)
            ColorPrinter.Blue("[Flow] F1: D3 online -> skip B, proceed to E (C/D when implemented).");
        else
        {
            if (!await RunBBlockUntilConfirmedAsync().ConfigureAwait(false))
            {
                ColorPrinter.Yellow("[Flow] B block did not reach B16 (BN confirmed).");
                game.NotifyCallbacks();
                return false;
            }
            await RunDBlockLaunchD3Async(op, region).ConfigureAwait(false);
        }

        bool eDone = await RosbotRunFlow.RunEBlockAsync(region!).ConfigureAwait(false);
        game.SetRosbotStatus(eDone);
        game.NotifyCallbacks();
        return true;
    }

    /// <summary>Kill ROSBOT main + same-dir exes by PID (renamed copies included), then invalidate the lookup cache. 1:1 Python get_rosbot_manager().kill_if_running.</summary>
    public static bool StopRosbot()
    {
        bool ok = RosbotManager.Instance.KillIfRunning();
        RosbotDetection.InvalidateCache();
        return ok;
    }

    /// <summary>
    /// B block for the one-shot run: refresh Battle.net status then BattlenetReadyFlow.Tick(noActivate: false) every flow step
    /// until confirmed, exit, or the flow master is switched off (block reset). 1:1 Python flow_master F0_ACTION_B1.
    /// </summary>
    private static async Task<bool> RunBBlockUntilConfirmedAsync()
    {
        BnBlockState.EnterBattlenetAtB2(false);
        while (IsFlowMasterOn())
        {
            BattlenetFlowHooks.RefreshBattlenetStatus?.Invoke();
            var (done, result) = BattlenetReadyFlow.Tick(noActivate: false);
            if (done)
            {
                if (result == BattlenetReadyFlow.ResultConfirmed)
                    BnBlockState.SetTickConfirmed(false);
                return result == BattlenetReadyFlow.ResultConfirmed;
            }
            await Task.Delay(FlowStepIntervalMs).ConfigureAwait(false);
        }
        BattlenetReadyFlow.ResetFlowMasterBnBlock();
        return false;
    }

    private static bool IsFlowMasterOn()
        => RosbotFlowState.Instance.FlowMasterEnabled || GameInterfaceData.Instance.GetStateSnapshot().RosbotFlowMasterEnabled;

    /// <summary>D block: D1 -> D4 activate -> D5/D6 -> D7/D9 click D3 tab -> D11w/D11 click Play -> D12 -> D12b poll D3 window. Does not loop; single pass.</summary>
    private static async Task RunDBlockLaunchD3Async(IBattlenetOperation op, string region)
    {
        if (!BattlenetManager.Instance.HasWindow())
        {
            ColorPrinter.Gray("[DEBUG][Flow] D block: no BN window, skip D.");
            return;
        }
        ColorPrinter.Gray("[DEBUG][Flow] D block: D1 entry, D4 activate.");
        ColorPrinter.Blue("[Flow] D1: from BN launch D3.");
        op.ActivateWindow();
        await Task.Delay(1000).ConfigureAwait(false);
        ColorPrinter.Gray("[DEBUG][Flow] D block: D4w done, D5 GetDynamicState.");
        var state = op.GetDynamicState();
        if (!state.NormalAvailable && state.OnLogin)
        {
            ColorPrinter.Gray("[DEBUG][Flow] D block: D5 still on login, skip D.");
            ColorPrinter.Yellow("[Flow] D5: still on login, skip D.");
            return;
        }
        ColorPrinter.Gray("[DEBUG][Flow] D block: D7/D9 ClickD3Tab.");
        if (!op.ClickD3Tab())
        {
            ColorPrinter.Yellow("[Flow] D7/D9: D3 tab not found.");
            return;
        }
        // BN_WaitPlay: poll Play if visible (1:1 Python BN_WaitPlay, 8s)
        ColorPrinter.Gray("[DEBUG][Flow] D block: D11w WaitPlay (8s poll).");
        const int waitPlayMs = 8000;
        const int waitPlayIntervalMs = 500;
        bool playClicked = false;
        for (int t = 0; t < waitPlayMs; t += waitPlayIntervalMs)
        {
            await Task.Delay(waitPlayIntervalMs).ConfigureAwait(false);
            if (op.ClickPlayButtonIfVisible(true))
            {
                ColorPrinter.Green("[Flow] BN_WaitPlay: Play visible, clicked.");
                playClicked = true;
                break;
            }
        }
        if (!playClicked && !op.ClickStartGame())
        {
            ColorPrinter.Gray("[DEBUG][Flow] D block: D11 Play/ClickStartGame not found.");
            ColorPrinter.Yellow("[Flow] D11: Play not found.");
            return;
        }
        ColorPrinter.Gray("[DEBUG][Flow] D block: D12 sleep 5s, then D12b poll D3 window.");
        await Task.Delay(5000).ConfigureAwait(false);
        for (int i = 0; i < 20; i++)
        {
            if (IsD3Running())
            {
                ColorPrinter.Gray($"[DEBUG][Flow] D block: D12b/D13 D3 window found at poll i={i}.");
                ColorPrinter.Green("[Flow] D12b/D13: D3 window found.");
                return;
            }
            await Task.Delay(500).ConfigureAwait(false);
        }
        ColorPrinter.Gray("[DEBUG][Flow] D block: D12b timeout, D13b/D14 restart BN.");
        ColorPrinter.Yellow("[Flow] D12b: D3 window not found within 10s.");
        // D13b/D14: restart Battle.net so next run can re-enter B2. 1:1 Python flow D14→D14w→B2.
        ColorPrinter.Blue("[Flow] D14: restart Battle.net (close + wait 5s).");
        op.Close();
        await Task.Delay(5000).ConfigureAwait(false);
    }

    private static string? EnsureRegion()
    {
        string? region = BattlenetStatusProvider.GetRegion();
        return region is AppConstants.RegionAsia or AppConstants.RegionCn ? region : null;
    }

    /// <summary>Resolve ROSBOT exe path from directory (or return path if already exe): exact rosbot_exe_name, then ROSBOT exe patterns. 1:1 Python find_rosbot_exe.</summary>
    public static string? ResolveRosbotExe(string rosDirectory)
    {
        if (string.IsNullOrWhiteSpace(rosDirectory)) return null;
        if (File.Exists(rosDirectory) && rosDirectory.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            return rosDirectory;
        return RosbotManager.Instance.FindRosbotExe();
    }
}
