// PY-REF: none (DOT-only)
using System.Text.RegularExpressions;
using DotCore.Foundations;
using DotCore.UIInspect;
using DotCore.Utils;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>Outcome of one network-hold pass.</summary>
public enum NetHoldPhase
{
    Idle,
    WaitingNetwork,
    WaitingClient,
    WaitingLogin,
    WaitingWindow,
    D4TabMissing,
    InstallStarted,
    InstallPathFailed,
    Downloading,
    Resumed,
    UserPaused,
    Completed,
    NotOwned,
    Unknown,
}

/// <summary>Phase plus what the D4 page showed: size "7.84 / 194.40 GB", rate "1.18 MB/s", progress bar / status text.</summary>
public sealed record NetHoldResult(NetHoldPhase Phase, string? Size = null, string? Rate = null, string? Detail = null)
{
    public BattlenetDownloadProgress? Progress => BattlenetDownloadProgress.Parse(Size, Rate);
}

/// <summary>
/// Network hold with the D4 download, one idempotent pass per call: nothing while offline (Battle.net started offline drops
/// its login; offline because airplane mode was turned on -> switch the WiFi radio back on), start Battle.net when it is not running, finish an open install dialog (install folder = installPath, then
/// Continue / Start Install), wait for the logged-in main UI (the guard logs in), open the D4 page, then by its action:
/// download running -> nothing; Resume shown (paused / queued, e.g. after a network drop) -> resume unless the user paused it;
/// Install / Update -> start it; Play -> D4 is complete, open the D3 tab.
/// Without allowActivate the window is never restored or foregrounded: only UIA Invoke is used (resume), everything else waits.
/// </summary>
public static class BattlenetD4DownloadKeeper
{
    private const string LogTag = "[NetHold]";
    private const int TabSettleMs = 1500;
    private const int ActivateSettleMs = 1500;
    private static readonly Regex SizePattern = new(@"^\s*\d+([.,]\d+)?\s*([KMGT]?B)?\s*/\s*\d+([.,]\d+)?\s*[KMGT]?B\s*$", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static NetHoldResult RunOnce(bool allowActivate, string? installPath, bool userPaused)
    {
        var bn = BattlenetManager.Instance;
        if (!BattlenetManager.IsNetworkReady())
        {
            if (WifiRadio.IsAirplaneModeOn())
            {
                ColorPrinter.Yellow($"{LogTag} airplane mode is on while holding the D4 download, switching WiFi back on");
                if (WifiRadio.EnsureWifiOn()) return new NetHoldResult(NetHoldPhase.WaitingNetwork);
            }
            ColorPrinter.Yellow($"{LogTag} no internet connection, waiting (Battle.net is not started or resumed offline)");
            return new NetHoldResult(NetHoldPhase.WaitingNetwork);
        }
        if (!bn.IsProcessRunning())
        {
            ColorPrinter.Blue($"{LogTag} Battle.net not running, starting it");
            bn.Start();
            return new NetHoldResult(NetHoldPhase.WaitingClient);
        }

        var (status, controls) = BattlenetClientStateDetector.DetectWithControls();
        if (HasInstallDialog(controls))
            return CompleteInstallDialog(installPath);
        if (status.State is BattlenetClientState.TrayHidden or BattlenetClientState.Unknown)
        {
            if (!allowActivate) return new NetHoldResult(NetHoldPhase.WaitingWindow, Detail: status.State.ToString());
            if (status.State == BattlenetClientState.TrayHidden) bn.RestoreFromTray();
            else bn.ActivateWindow();
            Thread.Sleep(ActivateSettleMs);
            (status, controls) = BattlenetClientStateDetector.DetectWithControls();
        }
        if (status.State != BattlenetClientState.Normal)
            return new NetHoldResult(NetHoldPhase.WaitingLogin, Detail: status.State.ToString());

        var op = BattlenetOperationFactory.GetOperation(status.UiRegion);
        var d4Tab = FindD4Tab(controls);
        if (d4Tab == null)
        {
            ColorPrinter.Yellow($"{LogTag} D4 tab not found on the main UI");
            return new NetHoldResult(NetHoldPhase.D4TabMissing);
        }
        if (d4Tab.IsSelected != true)
        {
            if (!allowActivate) return new NetHoldResult(NetHoldPhase.WaitingWindow, Detail: d4Tab.Name);
            ColorPrinter.Blue($"{LogTag} opening the D4 page");
            op.ClickD4Tab();
            Thread.Sleep(TabSettleMs);
            (status, controls) = BattlenetClientStateDetector.DetectWithControls();
        }

        var (button, action) = BattlenetOperationBase.FindGameAction(controls);
        var page = ReadDownload(controls);
        switch (action)
        {
            case BattlenetGameAction.Downloading:
                ColorPrinter.Gray($"{LogTag} D4 downloading {page.Size} {page.Rate} {page.Detail}");
                return page with { Phase = NetHoldPhase.Downloading };

            case BattlenetGameAction.DownloadPaused:
                if (userPaused) return page with { Phase = NetHoldPhase.UserPaused };
                ColorPrinter.Blue($"{LogTag} D4 download stopped ({page.Detail}), resuming");
                bool resumed = T.InvokeControl(button!) || (allowActivate && T.ClickControl(button!));
                if (!resumed) return page with { Phase = NetHoldPhase.WaitingWindow };
                return page with { Phase = NetHoldPhase.Resumed };

            case BattlenetGameAction.Install:
            case BattlenetGameAction.Update:
                if (!allowActivate) return new NetHoldResult(NetHoldPhase.WaitingWindow, Detail: button!.Name);
                ColorPrinter.Blue($"{LogTag} D4 shows '{button!.Name}', starting the download");
                T.ClickControl(button);
                if (action == BattlenetGameAction.Update) return new NetHoldResult(NetHoldPhase.InstallStarted, Detail: button.Name);
                Thread.Sleep(C.InstallDialogWaitMs);
                return CompleteInstallDialog(installPath);

            case BattlenetGameAction.Play:
                ColorPrinter.Green($"{LogTag} D4 installed, switching to the D3 tab");
                if (allowActivate) op.ClickD3Tab();
                return new NetHoldResult(NetHoldPhase.Completed, Detail: button?.Name);

            case BattlenetGameAction.TryFree:
                ColorPrinter.Yellow($"{LogTag} D4 not owned ('{button?.Name}'), nothing to download; switching to the D3 tab");
                if (allowActivate) op.ClickD3Tab();
                return new NetHoldResult(NetHoldPhase.NotOwned, Detail: button?.Name);

            default:
                ColorPrinter.Yellow($"{LogTag} D4 page action not recognized ({action}); buttons: {DescribeButtons(controls)}");
                return new NetHoldResult(NetHoldPhase.Unknown, Detail: action.ToString());
        }
    }

    /// <summary>Pause (pause=true) or resume the D4 download shown on the D4 page; opens the page first. False when not downloading / paused.</summary>
    public static bool SetPaused(bool pause)
    {
        if (!OpenD4Page()) return false;
        var controls = BattlenetClientStateDetector.DetectWithControls().Controls;
        var (button, action) = BattlenetOperationBase.FindGameAction(controls);
        bool applies = pause ? action == BattlenetGameAction.Downloading : action == BattlenetGameAction.DownloadPaused;
        if (!applies || button == null)
        {
            ColorPrinter.Yellow($"{LogTag} {(pause ? "pause" : "resume")}: D4 page shows {action}");
            return false;
        }
        ColorPrinter.Blue($"{LogTag} {(pause ? "pausing" : "resuming")} the D4 download");
        return T.InvokeControl(button) || T.ClickControl(button);
    }

    /// <summary>Bring Battle.net to the front and open the D4 page (no-op when already open).</summary>
    public static bool OpenD4Page()
    {
        var bn = BattlenetManager.Instance;
        if (!bn.IsProcessRunning()) return false;
        if (!bn.ActivateWindow() && !bn.RestoreFromTray()) return false;
        var (status, controls) = BattlenetClientStateDetector.DetectWithControls();
        var tab = FindD4Tab(controls);
        if (tab == null) return false;
        if (tab.IsSelected == true) return true;
        bool ok = BattlenetOperationFactory.GetOperation(status.UiRegion).ClickD4Tab();
        Thread.Sleep(TabSettleMs);
        return ok;
    }

    /// <summary>
    /// Finish the install dialog: on the location page point it at installPath (Change Folder + the Windows folder dialog) unless
    /// it already shows that folder, then press its confirm button page by page (Continue, Start Install) until it closes.
    /// </summary>
    private static NetHoldResult CompleteInstallDialog(string? installPath)
    {
        for (int page = 0; page < C.InstallDialogMaxPages; page++)
        {
            var controls = InstallDialogControls();
            if (controls.Count == 0)
                return new NetHoldResult(NetHoldPhase.InstallStarted, Detail: installPath);
            var dir = controls.FirstOrDefault(c => c.AutomationId.EndsWith(C.InstallDirAutomationIdSuffix, StringComparison.Ordinal));
            if (dir != null && !string.IsNullOrWhiteSpace(installPath) && !SamePath(dir.Name, installPath))
            {
                ColorPrinter.Blue($"{LogTag} install dialog: location '{dir.Name}' -> '{installPath}'");
                if (!ChangeInstallFolder(controls, installPath!))
                    return new NetHoldResult(NetHoldPhase.InstallPathFailed, Detail: dir.Name);
                continue;
            }
            var confirm = controls.FirstOrDefault(c => c.Type == C.ButtonControlType && c.AutomationId.EndsWith(C.InstallConfirmAutomationIdSuffix, StringComparison.Ordinal));
            if (confirm == null || confirm.IsEnabled == false)
            {
                ColorPrinter.Yellow($"{LogTag} install dialog: confirm button not available; buttons: {DescribeButtons(controls)}");
                return new NetHoldResult(NetHoldPhase.Unknown, Detail: dir?.Name);
            }
            ColorPrinter.Blue($"{LogTag} install dialog: clicking '{confirm.Name}'");
            if (!T.InvokeControl(confirm)) T.ClickControl(confirm);
            Thread.Sleep(C.InstallPageWaitMs);
        }
        return new NetHoldResult(NetHoldPhase.Unknown, Detail: C.InstallDialogAutomationId);
    }

    private static bool ChangeInstallFolder(IReadOnlyList<BattlenetControl> controls, string installPath)
    {
        var change = controls.FirstOrDefault(c => c.AutomationId.EndsWith(C.InstallChangeFolderAutomationIdSuffix, StringComparison.Ordinal));
        if (change == null) return false;
        if (!T.InvokeControl(change) && !T.ClickControl(change)) return false;
        if (!CommonFolderDialog.Choose(BattlenetManager.Instance.GetProcessIds(), installPath, TimeSpan.FromSeconds(C.FolderDialogTimeoutSec)))
        {
            ColorPrinter.Yellow($"{LogTag} install dialog: folder dialog not driven");
            return false;
        }
        Thread.Sleep(C.InstallPageWaitMs);
        var shown = InstallDialogControls().FirstOrDefault(c => c.AutomationId.EndsWith(C.InstallDirAutomationIdSuffix, StringComparison.Ordinal))?.Name;
        if (shown != null && SamePath(shown, installPath)) return true;
        ColorPrinter.Yellow($"{LogTag} install dialog: location is '{shown}' after choosing '{installPath}'");
        return false;
    }

    private static List<BattlenetControl> InstallDialogControls()
    {
        T.InvalidateLightCache();
        return BattlenetClientStateDetector.DetectWithControls().Controls.Where(c => c.AutomationId.StartsWith(C.InstallDialogAutomationId, StringComparison.Ordinal)).ToList();
    }

    private static bool HasInstallDialog(IReadOnlyList<BattlenetControl> controls) =>
        controls.Any(c => c.AutomationId.StartsWith(C.InstallDialogAutomationId, StringComparison.Ordinal)
                          && c.AutomationId.EndsWith(C.InstallConfirmAutomationIdSuffix, StringComparison.Ordinal));

    private static bool SamePath(string a, string b) =>
        string.Equals(a.Trim().TrimEnd('\\', '/'), b.Trim().TrimEnd('\\', '/'), StringComparison.OrdinalIgnoreCase);

    private static BattlenetControl? FindD4Tab(IReadOnlyList<BattlenetControl> controls)
    {
        var ids = C.D4TabAutomationIdsCn.Concat(C.D4TabAutomationIdsAsia).ToHashSet(StringComparer.Ordinal);
        return controls.FirstOrDefault(c => ids.Contains(c.AutomationId));
    }

    /// <summary>Size text, rate button name and the progress bar name (else the status text right after the download button).</summary>
    private static NetHoldResult ReadDownload(IReadOnlyList<BattlenetControl> controls)
    {
        string? size = controls.FirstOrDefault(c => c.Type == C.TextControlType && SizePattern.IsMatch(c.Name))?.Name.Trim();
        string? rate = controls.FirstOrDefault(c => c.AutomationId.StartsWith(C.DownloadRateAutomationIdPrefix, StringComparison.Ordinal))?.Name.Trim();
        string? detail = controls.FirstOrDefault(c => c.Type == C.ProgressBarControlType && c.Name.Length > 0)?.Name.Trim();
        if (detail == null && BattlenetOperationBase.FindDownloadButton(controls) is { } download)
        {
            int i = IndexOf(controls, download);
            detail = controls.Skip(i + 1).Take(4).FirstOrDefault(c => c.Type == C.TextControlType && c.Name.Length > 0)?.Name.Trim();
        }
        return new NetHoldResult(NetHoldPhase.Unknown, size, rate, detail);
    }

    private static int IndexOf(IReadOnlyList<BattlenetControl> controls, BattlenetControl target)
    {
        for (int i = 0; i < controls.Count; i++)
            if (ReferenceEquals(controls[i], target)) return i;
        return -1;
    }

    private static string DescribeButtons(IReadOnlyList<BattlenetControl> controls) =>
        string.Join(" | ", controls.Where(c => c.Type == C.ButtonControlType && c.IsOffscreen != true && c.Name.Length > 0)
            .Select(c => c.Name).Distinct().Take(20));
}
