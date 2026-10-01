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
/// BN-only legacy tick (delegates to BnOnlyFlow) and Battle.net flow hook installation.
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

    /// <summary>Kill ROSBOT processes (by exe name pattern). Returns true if killed or none found.</summary>
    public static bool StopRosbot()
    {
        ColorPrinter.Gray("[DEBUG][Flow] StopRosbot() entered.");
        try
        {
            var processes = Process.GetProcesses();
            int killed = 0;
            foreach (var p in processes)
            {
                try
                {
                    string? name = p.ProcessName;
                    if (string.IsNullOrEmpty(name)) continue;
                    if (name.Contains("RoS-BoT", StringComparison.OrdinalIgnoreCase)
                        || name.Contains("ros-bot", StringComparison.OrdinalIgnoreCase))
                    {
                        p.Kill();
                        killed++;
                    }
                }
                catch { /* ignore */ }
            }
            ColorPrinter.Gray($"[DEBUG][Flow] StopRosbot: killed={killed}.");
            if (killed > 0)
            {
                ColorPrinter.Blue("[Flow] Stopped " + killed + " ROSBOT process(es).");
                RosbotDetection.InvalidateCache();
            }
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray("[DEBUG][Flow] StopRosbot: exception " + ex.Message);
            return false;
        }
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

    /// <summary>Resolve ROSBOT exe path from directory (or return path if already exe). Used by E block. 1:1 Python find_rosbot_exe.</summary>
    public static string? ResolveRosbotExe(string rosDirectory)
    {
        if (string.IsNullOrWhiteSpace(rosDirectory)) return null;
        if (File.Exists(rosDirectory) && rosDirectory.EndsWith(".exe", StringComparison.OrdinalIgnoreCase))
            return rosDirectory;
        if (!Directory.Exists(rosDirectory)) return null;
        try
        {
            var files = Directory.GetFiles(rosDirectory, "*.exe");
            foreach (var f in files)
            {
                string name = Path.GetFileName(f);
                if (name.Contains("RoS-BoT", StringComparison.OrdinalIgnoreCase)
                    || name.Contains("ros-bot", StringComparison.OrdinalIgnoreCase))
                    return f;
            }
            return files.FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }

    /// <summary>
    /// One BN-only tick (legacy 2 s timer path): mirrors the page flag into RosbotFlowState, then BnOnlyFlow.Tick
    /// (refresh, B block with noActivate, confirmed -> poll). Skipped while the credentials dialog is pending.
    /// </summary>
    public static async Task TickBnOnlyFlowAsync()
    {
        await Task.Yield();
        bool enabled = GameInterfaceData.Instance.GetStateSnapshot().EnsureBattlenetOnlyEnabled;
        if (enabled && !RosbotFlowState.Instance.BnOnlyEnabled)
            RosbotFlowState.Instance.SetBnOnlyEnabled(true);
        if (!RosbotFlowState.Instance.BnOnlyEnabled || BattlenetFlowHooks.IsCredentialsDialogPending())
            return;
        BnOnlyFlow.Tick();
    }
}
