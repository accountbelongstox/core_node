using System.Diagnostics;
using System.IO;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;
using DotApps.d3check.Core;
using DotApps.d3check.Core.Battlenet;
using DotCore.Foundations;

namespace DotApps.d3check.Ctl;

/// <summary>
/// ROSBOT flow controller: orchestrates F0/F1 pre-judge, B (Battle.net), D (launch D3 from BN), E (start ROSBOT). No tick; run once per Start click.
/// Aligned with ROSBOT_FLOW_MERMAID: A1e event-driven entry -> F_Entry -> F1 -> B or C -> D -> E.
/// </summary>
public static class RosbotFlowController
{
    /// <summary>Optional: show credentials dialog on UI thread and block until closed. Set by MainWindow so B10a can prompt when credentials are missing. 1:1 Python schedule_battlenet_credentials_dialog + wait.</summary>
    private static Func<string, bool>? _showCredentialsDialogAndWait;

    /// <summary>Set the delegate that shows CredentialsDialog on the UI thread and returns true if user confirmed. Call from MainWindow OnLoaded.</summary>
    public static void SetShowCredentialsDialogAndWait(Func<string, bool>? showAndWait)
    {
        _showCredentialsDialogAndWait = showAndWait;
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

    /// <summary>Run flow: A1e -> F0 -> F1. F1 no -> B block (full: B2/B4/B5/B7/B9/B10/B11) -> D block (launch D3 from BN) -> E. F1 yes -> E (C/D when implemented). Aligned with ROSBOT_FLOW_MERMAID event-driven. Yields immediately so heavy B/D/E work runs on thread pool and does not block UI.</summary>
    public static async Task<bool> RunAsync()
    {
        ColorPrinter.Gray("[DEBUG][Flow] RunAsync() entered.");
        await Task.Yield();
        var game = GameInterfaceData.Instance;
        string? region = EnsureRegion();
        if (string.IsNullOrEmpty(region))
        {
            ColorPrinter.Gray("[DEBUG][Flow] RunAsync: EnsureRegion() returned null.");
            ColorPrinter.Yellow("[Flow] Region unknown.");
            return false;
        }
        ColorPrinter.Gray($"[DEBUG][Flow] RunAsync: region={region}.");

        string? bnPath = ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath;
        if (string.IsNullOrWhiteSpace(bnPath)) bnPath = null;
        if (string.IsNullOrWhiteSpace(bnPath) || !File.Exists(bnPath))
        {
            ColorPrinter.Gray("[DEBUG][Flow] RunAsync: Battlenet path missing or file not found.");
            ColorPrinter.Yellow("[Flow] Battle.net path not set or file not found.");
            return false;
        }

        var op = BattlenetOperationFactory.GetOperation(region);

        // F0 / F1: pre-judge — D3 online?
        bool f1D3Online = IsD3Running();
        ColorPrinter.Gray($"[DEBUG][Flow] RunAsync: F1 D3 online={f1D3Online}.");
        if (f1D3Online)
            ColorPrinter.Blue("[Flow] F1: D3 online -> skip B, proceed to E (C/D when implemented).");

        // B block: only when F1 no (D3 not online). Event-driven: B1 -> B2 -> ... -> B16 confirmed.
        if (!f1D3Online)
        {
            ColorPrinter.Gray("[DEBUG][Flow] RunAsync: entering B block (RunBBlockUntilConfirmedAsync).");
            bool b16Confirmed = await RunBBlockUntilConfirmedAsync(op, region, game).ConfigureAwait(false);
            if (!b16Confirmed)
            {
                ColorPrinter.Gray("[DEBUG][Flow] RunAsync: B block returned false (did not reach B16).");
                ColorPrinter.Yellow("[Flow] B block did not reach B16 (BN confirmed).");
                game.NotifyCallbacks();
                return false;
            }
            ColorPrinter.Gray("[DEBUG][Flow] RunAsync: B16 confirmed, entering D block.");
            // D block: from BN launch D3 (D1 -> D4 activate -> D5/D6 -> D7 tab -> D9 click tab -> D11w/D11 click Play -> D12 -> D12b poll D3 window)
            await RunDBlockLaunchD3Async(op, region).ConfigureAwait(false);
        }

        // E block: E1→E2→E3→E4→E5a→E6 (class library: RosbotRunFlow). 1:1 Python flow_e_rosbot_run + run_after_rosbot_start.
        ColorPrinter.Gray("[DEBUG][Flow] RunAsync: entering E block (RosbotRunFlow.RunEBlockAsync).");
        bool eDone = await RosbotRunFlow.RunEBlockAsync(region!).ConfigureAwait(false);
        ColorPrinter.Gray($"[DEBUG][Flow] RunAsync: E block returned eDone={eDone}.");
        game.SetRosbotStatus(eDone);
        game.NotifyCallbacks();
        ColorPrinter.Gray("[DEBUG][Flow] RunAsync: returning true.");
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

    /// <summary>B block: B1 entry -> B2 -> B4/B4p -> B6 -> B7/B8/B9 get_dynamic_state -> B10/B10a -> B11 poll loop -> B16. 1:1 Python rosbot_flow_battlenet; DOT is poll-loop / wall-clock (no tick).</summary>
    private static async Task<bool> RunBBlockUntilConfirmedAsync(IBattlenetOperation op, string region, GameInterfaceData game)
    {
        int b7Deadline = Environment.TickCount + AppConstants.B7WaitForUiTimeoutMs;
        int b7SkipCount = 0;
        double b7LastTriggerTime = 0;
        int bLoopIteration = 0;

        while (true)
        {
            bLoopIteration++;
            ColorPrinter.Gray($"[DEBUG][Flow] B block loop iteration #{bLoopIteration} (b7Deadline in {(b7Deadline - Environment.TickCount) / 1000}s).");

            // B2: has BN window?
            if (!BattlenetManager.Instance.HasWindow())
            {
                ColorPrinter.Blue("[Flow] B2: no window -> B3 start Battle.net (" + region + ")");
                if (!op.Start())
                {
                    ColorPrinter.Red("[Flow] B3: failed to start Battle.net.");
                    return false;
                }
                await Task.Delay(AppConstants.B3wWaitAfterStartMs).ConfigureAwait(false);
                for (int i = 0; i < AppConstants.WaitForBnWindowMaxAttempts; i++)
                {
                    await Task.Delay(AppConstants.WaitForBnWindowMs).ConfigureAwait(false);
                    if (BattlenetManager.Instance.HasWindow()) break;
                }
                if (!BattlenetManager.Instance.HasWindow())
                {
                    ColorPrinter.Yellow("[Flow] B: BN window not found after start.");
                    return false;
                }
                b7Deadline = Environment.TickCount + AppConstants.B7WaitForUiTimeoutMs;
                b7SkipCount = 0;
            }

            game.SetBattlenetWindowFound(true);
            bool onLoginScreen = op.IsOnLoginScreen();
            game.SetBattlenetOnLoginScreen(onLoginScreen);
            ColorPrinter.Gray($"[DEBUG][Flow] B block iter #{bLoopIteration}: B2 has window; onLoginScreen={onLoginScreen}.");

            // B4: first check — login failed / browser wait -> B5 exit. Login page -> do NOT exit; go B6 then B9/B10a (1:1 Python semantics: event-driven single run cannot "return then next tick", so login page = enter login flow).
            if (op.IsLoginFailedScreen())
            {
                ColorPrinter.Yellow("[Flow] B4: login failed (Continue Offline/Cancel) -> B5 exit.");
                op.Close();
                await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                continue;
            }
            if (op.IsOnBrowserLoginWaitScreen())
            {
                ColorPrinter.Blue("[Flow] B4p: browser login wait popup -> B5 exit.");
                op.Close();
                await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                continue;
            }
            if (onLoginScreen)
                ColorPrinter.Gray("[DEBUG][Flow] B4: current is login page; skip B5 exit, go B6 activate then B9/B10a (1:1 event-driven: enter login flow).");

            op.ActivateWindow();
            await Task.Delay(300).ConfigureAwait(false);

            if (op.TryClosePopup())
            {
                await Task.Delay(400).ConfigureAwait(false);
                continue;
            }

            var state = op.GetDynamicState();
            bool elemReady = state.NormalAvailable || state.Disconnected
                || (state.OnLogin && (op.IsLoginScreenReady() || (region == AppConstants.RegionAsia && op.IsOnLoginScreen())));
            ColorPrinter.Gray($"[DEBUG][Flow] B block iter #{bLoopIteration}: GetDynamicState NormalAvailable={state.NormalAvailable} OnLogin={state.OnLogin} Disconnected={state.Disconnected} Connecting={state.Connecting} elemReady={elemReady}.");

            if (elemReady)
            {
                b7SkipCount = 0;
                if (op.IsLoginFailedScreen())
                {
                    ColorPrinter.Yellow("[Flow] B7: login failed -> B5 exit.");
                    op.Close();
                    await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                    continue;
                }
            }

            if (state.Connecting)
            {
                await Task.Delay(AppConstants.B7B11PollIntervalMs).ConfigureAwait(false);
                continue;
            }
            if (state.NormalAvailable)
            {
                ColorPrinter.Blue("[Flow] B9: main -> B16 confirmed.");
                return true;
            }
            if (state.Disconnected)
            {
                ColorPrinter.Blue("[Flow] B4/B15a: disconnected -> B5 exit.");
                op.Close();
                await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                continue;
            }
            if (state.OnLogin)
            {
                // B9 on login -> B10 (CN) or B10a (Asia) then B11 poll loop. 1:1 Python: B10 failure still go B11 wait (no B5 exit).
                if (region == AppConstants.RegionCn)
                {
                    ColorPrinter.Blue("[Flow] B9: login screen (CN) -> B10 agree+NetEase, then B11 poll loop.");
                    op.ActivateWindow();
                    await Task.Delay(200).ConfigureAwait(false);
                    bool b10Ok = op.PerformCnLoginFlow((double)BattlenetConstants.CnAfterNetEaseClickSettleSec);
                    if (!b10Ok)
                        ColorPrinter.Yellow("[Flow] B10: agree/NetEase failed, still enter B11 wait (1:1 Python).");
                    else
                        ColorPrinter.Blue("[Flow] B10: agree/NetEase done -> B11 poll.");
                    // B11: wall-clock poll loop (DOT not tick-driven). 1:1 Python BN_Login2 + run_one_poll; timeout = BROWSER_LOGIN_FALLBACK_TIMEOUT_SEC (300s).
                    int b11TimeoutMs = (int)(BattlenetConstants.BrowserOcrTimeoutSec * 1000);
                    int b11Deadline = Environment.TickCount + b11TimeoutMs;
                    var b11DeadlineUtc = DateTime.UtcNow.AddSeconds(BattlenetConstants.BrowserOcrTimeoutSec);
                    bool b11LoginFailed = false;
                    while (Environment.TickCount < b11Deadline)
                    {
                        await Task.Delay((int)(BattlenetConstants.BrowserOcrPollIntervalSec * 1000)).ConfigureAwait(false);
                        if (!BattlenetManager.Instance.HasWindow()) break;
                        if (op.IsLoginFailedScreen())
                        {
                            b11LoginFailed = true;
                            break;
                        }
                        var engine = BrowserLoginOcrFlow.GetOrCreateDefaultEngine();
                        var ocrResult = BrowserLoginOcrFlow.RunOnePoll(b11DeadlineUtc, engine, null);
                        if (ocrResult == BrowserLoginOcrFlow.PollResult.Success)
                        {
                            ColorPrinter.Blue("[Flow] B11: browser OAuth done (OCR) -> B16 confirmed.");
                            return true;
                        }
                        if (ocrResult == BrowserLoginOcrFlow.PollResult.Timeout) break;
                        var s2 = op.GetDynamicState();
                        if (s2.NormalAvailable)
                        {
                            ColorPrinter.Blue("[Flow] B11: browser OAuth done -> B16 confirmed.");
                            return true;
                        }
                    }
                    if (b11LoginFailed)
                        ColorPrinter.Yellow("[Flow] B11: login failed (Continue Offline/Cancel) -> B5 exit.");
                    else
                        ColorPrinter.Yellow("[Flow] B11: browser OCR timeout -> B5 exit.");
                }
                else if (region == AppConstants.RegionAsia)
                {
                    ColorPrinter.Blue("[Flow] B9: login screen (Asia) -> B10a fill+submit.");
                    var creds = AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia);
                    string? email = creds?.email;
                    string? password = creds?.password;
                    ColorPrinter.Gray($"[DEBUG][Flow] B10a: GetCredentials(Asia) -> creds={(creds != null ? "ok" : "null")} email={(email != null ? "set" : "null")}");
                    if (creds == null && _showCredentialsDialogAndWait != null)
                    {
                        ColorPrinter.Gray("[DEBUG][Flow] B10a: no credentials -> showing credentials dialog on UI thread and waiting.");
                        bool userConfirmed = _showCredentialsDialogAndWait(AsiaCredentialsService.RegionAsia);
                        ColorPrinter.Gray($"[DEBUG][Flow] B10a: credentials dialog closed userConfirmed={userConfirmed}");
                        creds = AsiaCredentialsService.GetCredentials(AsiaCredentialsService.RegionAsia);
                        email = creds?.email;
                        password = creds?.password;
                        ColorPrinter.Gray($"[DEBUG][Flow] B10a: after dialog GetCredentials(Asia) -> creds={(creds != null ? "ok" : "null")}");
                    }
                    if (creds == null)
                    {
                        ColorPrinter.Yellow("[Flow] B10a: no Asia credentials (user cancelled or did not fill) -> B5 exit.");
                        op.Close();
                        await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                        continue;
                    }
                    op.ActivateWindow();
                    await Task.Delay(200).ConfigureAwait(false);
                    ColorPrinter.Gray($"[DEBUG][Flow] B10a: calling PerformAsiaLoginFillAndSubmit emailLen={email?.Length ?? 0}");
                    if (!op.PerformAsiaLoginFillAndSubmit(email, password))
                    {
                        ColorPrinter.Yellow("[Flow] B10a: Asia fill/submit failed -> B5 exit.");
                        op.Close();
                        await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                        continue;
                    }
                    // B11-style poll for normal_available
                    int b11Deadline = Environment.TickCount + AppConstants.B11BrowserWaitTimeoutMs;
                    while (Environment.TickCount < b11Deadline)
                    {
                        await Task.Delay(AppConstants.B7B11PollIntervalMs).ConfigureAwait(false);
                        if (!BattlenetManager.Instance.HasWindow()) break;
                        var s2 = op.GetDynamicState();
                        if (s2.NormalAvailable)
                        {
                            ColorPrinter.Blue("[Flow] B11: Asia login done -> B16 confirmed.");
                            return true;
                        }
                    }
                    ColorPrinter.Yellow("[Flow] B11: Asia login timeout -> B5 exit.");
                }
                else
                {
                    ColorPrinter.Yellow("[Flow] B9: login screen but region not CN/Asia -> B5 exit.");
                }
                op.Close();
                await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                continue;
            }

            // B7: no operable elements yet (only when !elemReady). Try close popup; else increment skip count and optionally trigger D (1:1 PY B7_TRIGGER_D_AFTER_SKIPS).
            if (!elemReady)
            {
                if (op.TryClosePopup())
                {
                    await Task.Delay(AppConstants.B7B11PollIntervalMs).ConfigureAwait(false);
                    continue;
                }
                b7SkipCount++;
            }
            if (!elemReady)
            {
                double nowSec = Environment.TickCount64 / 1000.0;
                if (b7SkipCount >= AppConstants.B7TriggerDAfterSkips && (nowSec - b7LastTriggerTime) >= AppConstants.B7TriggerDCooldownSec)
            {
                ColorPrinter.Gray($"[DEBUG][Flow] B block iter #{bLoopIteration}: B7 trigger D (b7SkipCount={b7SkipCount}).");
                ColorPrinter.Blue("[Flow] B7: no operable for " + b7SkipCount + " skips -> trigger D (D3 tab, Play).");
                op.ActivateWindow();
                await Task.Delay(200).ConfigureAwait(false);
                op.ClickD3Tab();
                await Task.Delay(500).ConfigureAwait(false);
                op.ClickPlayButtonIfVisible(true);
                b7SkipCount = 0;
                b7LastTriggerTime = nowSec;
                }
            }
            if (Environment.TickCount >= b7Deadline)
            {
                ColorPrinter.Gray($"[DEBUG][Flow] B block iter #{bLoopIteration}: B7 deadline reached, B5 exit.");
                ColorPrinter.Yellow("[Flow] B7: timeout no operable UI -> B5 exit.");
                op.Close();
                await Task.Delay(AppConstants.B5wExitWaitMs).ConfigureAwait(false);
                continue;
            }
            await Task.Delay(AppConstants.B7B11PollIntervalMs).ConfigureAwait(false);
        }
    }

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
        var game = GameInterfaceData.Instance;
        string? existing = game.GetStateSnapshot().BattlenetRegion;
        ColorPrinter.Gray($"[DEBUG][Flow] EnsureRegion: snapshot BattlenetRegion={existing ?? "null"}.");
        if (!string.IsNullOrEmpty(existing) && (existing == AppConstants.RegionAsia || existing == AppConstants.RegionCn))
            return existing;
        string? region = BattlenetRegionDetection.DetectRegion();
        ColorPrinter.Gray($"[DEBUG][Flow] EnsureRegion: DetectRegion={region ?? "null"}.");
        if (string.IsNullOrEmpty(region))
            region = ConfigOptionsProvider.GetOptions<RosSettingsOptions>().BattlenetRegionCache;
            if (string.IsNullOrEmpty(region)) region = null;
        if (string.IsNullOrEmpty(region) || (region != AppConstants.RegionAsia && region != AppConstants.RegionCn))
            return null;
        game.SetBattlenetRegion(region);
        if (BattlenetRegionDetection.DetectRegion() != null)
            D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.RosSettingsBattlenetRegionCache, region);
        D3CheckConfigService.Instance.QueueSave();
        return region;
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

    // ---------- BN-only flow (Ensure Battle.net on): 2s tick loop 1:1 Python tick_bn_only_flow + tick_battlenet_ready_flow(no_activate=True) ----------
    private static int _bnOnlyTickCount;

    /// <summary>One tick of BN-only flow. Called every 2s when EnsureBattlenetOnlyEnabled. 1:1 Python flow_bn_only.tick_bn_only_flow: REFRESH_NOTIFY -> RE_READ_ABORT -> RUN_BN_TICK (no activate).</summary>
    public static async Task TickBnOnlyFlowAsync()
    {
        await Task.Yield();
        var game = GameInterfaceData.Instance;
        var snapshot = game.GetStateSnapshot();
        if (!snapshot.EnsureBattlenetOnlyEnabled)
        {
            ColorPrinter.Gray("[DEBUG][BNOnly] TickBnOnlyFlow: EnsureBattlenetOnlyEnabled=false, skip this tick.");
            return;
        }

        _bnOnlyTickCount++;
        ColorPrinter.Gray($"[DEBUG][BNOnly] Tick #{_bnOnlyTickCount} step=REFRESH_NOTIFY: refresh BN status (no activate, 1:1 Python).");

        bool hasBn = BattlenetManager.Instance.HasWindow();
        game.SetBattlenetWindowFound(hasBn);
        game.SetBattlenetNormalAvailable(hasBn);

        string? region = snapshot.BattlenetRegion;
        if (string.IsNullOrEmpty(region) || (region != AppConstants.RegionAsia && region != AppConstants.RegionCn))
        {
            region = EnsureRegion();
            if (string.IsNullOrEmpty(region))
            {
                ColorPrinter.Gray("[DEBUG][BNOnly] Tick: region unknown, skip B block.");
                game.NotifyCallbacks();
                return;
            }
        }

        string? bnPath = ConfigOptionsProvider.GetOptions<BattlenetOptions>().BattlenetPath;
        if (string.IsNullOrWhiteSpace(bnPath)) bnPath = null;
        if (string.IsNullOrWhiteSpace(bnPath) || !File.Exists(bnPath))
        {
            ColorPrinter.Gray("[DEBUG][BNOnly] Tick: BN path missing, skip B block.");
            game.NotifyCallbacks();
            return;
        }

        var op = BattlenetOperationFactory.GetOperation(region!);
        if (!hasBn)
        {
            ColorPrinter.Gray("[DEBUG][BNOnly] Tick: B2 no window (from refresh); next tick may start BN or wait. Not activating (bn_only no_activate).");
            game.NotifyCallbacks();
            return;
        }

        bool onLogin = op.IsOnLoginScreen();
        game.SetBattlenetOnLoginScreen(onLogin);
        var state = op.GetDynamicState();
        game.SetBattlenetDisconnected(state.Disconnected);
        if (state.NormalAvailable)
            game.SetBattlenetNormalAvailable(true);

        bool elemReady = state.NormalAvailable || state.Disconnected
            || (state.OnLogin && (op.IsLoginScreenReady() || (region == AppConstants.RegionAsia && op.IsOnLoginScreen())));
        if (!elemReady)
        {
            bool closed = op.TryClosePopup();
            if (closed)
            {
                ColorPrinter.Gray("[DEBUG][BNOnly] Tick: TryClosePopup closed in-client popup, wait next tick (1:1 Python B7).");
                game.NotifyCallbacks();
                return;
            }
            ColorPrinter.Gray($"[DEBUG][BNOnly] Tick: B2 has window; state not operable (NormalAvailable={state.NormalAvailable} OnLogin={state.OnLogin} Disconnected={state.Disconnected} Connecting={state.Connecting}); no popup closed this tick.");
        }
        else
            ColorPrinter.Gray($"[DEBUG][BNOnly] Tick: B2 has window; GetDynamicState NormalAvailable={state.NormalAvailable} OnLogin={state.OnLogin} Disconnected={state.Disconnected} elemReady=true.");
        game.NotifyCallbacks();
    }
}
