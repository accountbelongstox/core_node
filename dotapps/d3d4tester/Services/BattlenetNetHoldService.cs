// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Network hold (battlenet.net_hold_enabled): while the app runs, every net_hold_interval_sec (default 60 s) one idempotent
/// BattlenetD4DownloadKeeper pass ensures the client, starts or resumes the D4 download (a dropped network pauses it) and opens
/// the D3 tab once D4 is complete. Turning it on also turns on the Battle.net guard so the client is logged in.
/// While D3 runs or a Rosbot flow is active the pass never activates Battle.net (resume by UIA Invoke only).
/// </summary>
public static class BattlenetNetHoldService
{
    private const string LogTag = "[NetHold]";
    private const int MinIntervalSec = 15;
    private const int MaxIntervalSec = 3600;

    private static readonly object Lock = new();
    private static readonly AutoResetEvent Wake = new(false);
    private static int _initialized;
    private static Thread? _thread;
    private static volatile bool _running;
    private static volatile bool _userPaused;
    private static int _retry;
    private static NetHoldRecord _last = new(DateTime.Now, NetHoldPhase.Idle, null, null, null, null, null, null);

    /// <summary>Raised on the worker thread after every pass (already recorded in NetHoldHistory) and when the hold stops.</summary>
    public static event Action<NetHoldRecord>? StatusChanged;

    public static NetHoldRecord LastRecord => _last;

    public static bool IsEnabled => ConfigBinding.GetValue(ConfigKeys.BattlenetNetHoldEnabled, false);

    public static void Initialize()
    {
        if (Interlocked.Exchange(ref _initialized, 1) == 1) return;
        D3D4TesterConfigChangeHub.Notifier.Subscribe(OnConfigChanged);
        Apply();
    }

    /// <summary>Configured D4 install folder, or null to keep Battle.net's suggestion.</summary>
    public static string? InstallPath =>
        ConfigBinding.GetValue(ConfigKeys.BattlenetD4InstallPath, "") is { Length: > 0 } p ? p.Trim() : null;

    /// <summary>True after the user paused the download here: the hold then leaves it paused until Resume.</summary>
    public static bool UserPaused => _userPaused;

    /// <summary>Run a pass now (no-op when the hold is off).</summary>
    public static void RunNow() => Wake.Set();

    /// <summary>Pause the D4 download and keep it paused (the hold stops resuming it). Blocking; call off the UI thread.</summary>
    public static bool Pause()
    {
        _userPaused = true;
        bool ok = BattlenetD4DownloadKeeper.SetPaused(true);
        Wake.Set();
        return ok;
    }

    /// <summary>Resume the D4 download and let the hold keep it running again. Blocking; call off the UI thread.</summary>
    public static bool Resume()
    {
        _userPaused = false;
        bool ok = BattlenetD4DownloadKeeper.SetPaused(false);
        Wake.Set();
        return ok;
    }

    /// <summary>Bring Battle.net to the front on the D4 page. Blocking; call off the UI thread.</summary>
    public static bool OpenD4Page() => BattlenetD4DownloadKeeper.OpenD4Page();

    /// <summary>"Ensure client": turn the guard on and start Battle.net when it is not running (both idempotent).</summary>
    public static void EnsureClient()
    {
        if (!BattlenetGuardService.IsEnabled) ConfigBinding.SetValue(ConfigKeys.BattlenetEnsureNormal, true);
        if (!BattlenetManager.Instance.IsProcessRunning()) BattlenetManager.Instance.Start();
        Wake.Set();
    }

    private static void OnConfigChanged(string? keyPath)
    {
        if (keyPath == ConfigKeys.BattlenetNetHoldEnabled) Apply();
        else if (keyPath is ConfigKeys.BattlenetNetHoldIntervalSec or ConfigKeys.BattlenetD4InstallPath) Wake.Set();
    }

    private static void Apply()
    {
        bool enabled = IsEnabled;
        lock (Lock)
        {
            if (enabled == _running) return;
            _running = enabled;
            if (enabled)
            {
                _retry = 0;
                NetHoldTaskLog.BeginRun();
                _thread = new Thread(Loop) { IsBackground = true, Name = "NetHold" };
                _thread.Start();
            }
            else Wake.Set();
        }
        ColorPrinter.Blue($"{LogTag} network hold = {enabled}");
        if (enabled) EnsureClient();
        else Publish(new NetHoldResult(NetHoldPhase.Idle));
    }

    private static void Loop()
    {
        while (_running)
        {
            try
            {
                bool gameActive = RosbotFlowState.Instance.FlowMasterEnabled || D3Manager.Instance.GetProcessIds().Count > 0;
                var result = BattlenetD4DownloadKeeper.RunOnce(!gameActive, InstallPath, _userPaused);
                _retry = result.Phase is NetHoldPhase.Downloading or NetHoldPhase.InstallStarted or NetHoldPhase.UserPaused
                    or NetHoldPhase.Completed or NetHoldPhase.NotOwned ? 0 : _retry + 1;
                Publish(result);
                if (result.Phase is NetHoldPhase.Completed or NetHoldPhase.NotOwned)
                {
                    ColorPrinter.Green($"{LogTag} D4 download finished ({result.Phase}); hold idle until the next app start");
                    lock (Lock) _running = false;
                    return;
                }
            }
            catch (Exception ex)
            {
                _retry++;
                ColorPrinter.Red($"{LogTag} pass failed: {ex.Message}");
                NetHoldTaskLog.ReportError(_last, _retry, ex.Message);
            }
            int interval = _last.Phase == NetHoldPhase.WaitingNetwork
                ? MinIntervalSec
                : Math.Clamp(ConfigBinding.GetValue(ConfigKeys.BattlenetNetHoldIntervalSec, ConfigKeys.BattlenetNetHoldIntervalSecDefault), MinIntervalSec, MaxIntervalSec);
            if (_retry > 0) ColorPrinter.Yellow($"{LogTag} retry #{_retry} in {interval}s ({_last.Phase})");
            Wake.WaitOne(TimeSpan.FromSeconds(interval));
        }
    }

    private static void Publish(NetHoldResult result)
    {
        var record = result.Phase == NetHoldPhase.Idle
            ? new NetHoldRecord(DateTime.Now, NetHoldPhase.Idle, null, null, null, null, null, null)
            : NetHoldHistory.Add(result, DateTime.Now);
        if (record.Phase != NetHoldPhase.Idle)
        {
            ColorPrinter.Gray($"{LogTag} {NetHoldTaskLog.Describe(record, _retry)} Battle.net pid {string.Join(", ", BattlenetManager.Instance.GetProcessIds())}");
            NetHoldTaskLog.Report(record, _retry);
        }
        _last = record;
        StatusChanged?.Invoke(record);
    }
}
