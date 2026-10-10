// PY-REF: none (DOT-only)
using System.Diagnostics;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// Executes one trigger action (RBAssist DOACTION) on the trigger worker. "%LOG%" / "%HISTORY%" in arguments become the last logs.txt /
/// history.txt line. Start / stop / pause / resume monitoring map to the ROSBOT flow and run even while control is taken (they hand
/// control over themselves, under their own lease); restarts go through <see cref="MonitorService.RequestRestart"/>; town portal uses the
/// shared town portal key (BridgeTownPortal); town standby is the bridge panel's one-click return to town and stand by.
/// </summary>
public static class TriggerActionRunner
{
    private const int CloseBotGapMs = 5000;
    private const int UnstuckCooldownDefaultMs = 3000;
    private const int LeaseWaitMs = 10000;
    private const string LeasePrefix = "trigger ";

    /// <summary>
    /// Actions that never touch the game themselves (or take / give back control with their own lease): they run even while the user
    /// has taken control. Resume monitoring must, else a trigger could never end a pause.
    /// </summary>
    private static readonly HashSet<string> PassiveActions = new(StringComparer.Ordinal)
    {
        MonitorActions.WriteLog, MonitorActions.TakeScreenshot, MonitorActions.Notify, MonitorActions.StopMonitoring, MonitorActions.ExecuteCommand,
        MonitorActions.StartMonitoring, MonitorActions.PauseMonitoring, MonitorActions.ResumeMonitoring, MonitorActions.TownStandby,
    };

    /// <summary>Run one trigger action: game / ROSBOT actions are dropped while the user has control and run under the GameControl lease.</summary>
    public static void Run(TriggerDefinition t)
    {
        if (PassiveActions.Contains(t.Action))
        {
            Execute(t);
            return;
        }
        if (!GameControl.Allowed(LeasePrefix + t.Action, needsMonitoring: false)) return;
        using var lease = GameControl.TryAcquire(LeasePrefix + t.Action, LeaseWaitMs);
        if (lease == null) return;
        Execute(t);
    }

    private static void Execute(TriggerDefinition t)
    {
        var monitor = MonitorService.Instance;
        string a1 = Expand(t.ActionArg, monitor), a2 = Expand(t.ActionArg2, monitor);
        switch (t.Action)
        {
            case MonitorActions.WriteLog:
                MonitorLog.Info(a1);
                break;
            case MonitorActions.StartMonitoring:
                RosbotTaskProcessor.Instance.RequestStartFlow();
                break;
            case MonitorActions.StopMonitoring:
                RosbotTaskProcessor.Instance.RequestStopFlow();
                break;
            case MonitorActions.PauseMonitoring:
                RosbotTaskProcessor.Instance.RequestPauseFlow();
                break;
            case MonitorActions.ResumeMonitoring:
                RosbotTaskProcessor.Instance.RequestResumeFlow();
                break;
            case MonitorActions.StopBotF7:
                GameWindowActions.StopRosbotF7();
                break;
            case MonitorActions.StopBotF9:
                GameWindowActions.SendKeyToD3(RosbotConstants.VkF9);
                break;
            case MonitorActions.CloseBot:
                GameWindowActions.StopRosbotF7();
                Thread.Sleep(CloseBotGapMs);
                GameWindowActions.StopRosbotF7();
                break;
            case MonitorActions.RestartBot:
            case MonitorActions.RestartBotWithBattlenet:
                monitor.RequestRestart(MonitorService.ReasonTrigger, TriggerCatalog.EventName(t.Event), t.Action == MonitorActions.RestartBotWithBattlenet);
                break;
            case MonitorActions.TakeScreenshot:
                MonitorScreenshotService.Capture(a1.Length > 0 ? a1 : t.Event, a2.Length > 0 ? a2 : MonitorSettings.DefaultScreenshotDir(t.Event));
                break;
            case MonitorActions.GameSpeed:
                monitor.ApplyGameSpeed(a1, a2);
                break;
            case MonitorActions.TownPortal:
                monitor.ScheduleTownPortal(MonitorSettings.ParseArg(a1));
                break;
            case MonitorActions.TownStandby:
                _ = RosbotBridgePluginService.EnterTownStandbyAsync();
                break;
            case MonitorActions.QuickQuit:
                ExternalGameTools.QuickQuit(a1);
                break;
            case MonitorActions.UnstuckMove:
                GameWindowActions.UnstuckMove(a1, MonitorSettings.ParseArg(a2, UnstuckCooldownDefaultMs));
                break;
            case MonitorActions.ExecuteCommand:
                StartCommand(a1, a2);
                break;
            case MonitorActions.SendKeys:
                if (!AutoItKeySequence.Send(a1)) MonitorLog.Warn($"Send keys failed: '{a1}'");
                break;
            case MonitorActions.Notify:
                NotificationService.Send(a1, D3D4TesterI18n.Provider.GetUiText(I18nKeys.MainWindowTitle), a2);
                break;
            case MonitorActions.SetSequence:
                RosbotUiAutomation.SelectSequenceInRosbotWindow(a1);
                break;
            default:
                MonitorLog.Warn($"Unknown action '{t.Action}'");
                break;
        }
    }

    private static string Expand(string value, MonitorService monitor) => value
        .Replace(MonitorPlaceholders.LastLogLine, monitor.LastLogLine, StringComparison.Ordinal)
        .Replace(MonitorPlaceholders.LastHistoryLine, monitor.LastHistoryLine, StringComparison.Ordinal);

    private static void StartCommand(string command, string arguments)
    {
        if (command.Length == 0) return;
        try
        {
            Process.Start(new ProcessStartInfo(command, arguments) { UseShellExecute = true, WorkingDirectory = AppContext.BaseDirectory })?.Dispose();
            MonitorLog.Info($"Command started: {command} {arguments}");
        }
        catch (Exception ex)
        {
            MonitorLog.Warn($"Command failed: {command}: {ex.Message}");
        }
    }
}
