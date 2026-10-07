// PY-REF: none (DOT-only)
using System.Diagnostics;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// Executes one trigger action (RBAssist DOACTION) on the trigger worker. "%LOG%" / "%HISTORY%" in arguments become the last logs.txt /
/// history.txt line. Start / stop monitoring map to the ROSBOT flow start / stop; restarts go through <see cref="MonitorService.RequestRestart"/>.
/// </summary>
public static class TriggerActionRunner
{
    private const int CloseBotGapMs = 5000;
    private const int UnstuckCooldownDefaultMs = 3000;

    public static void Run(TriggerDefinition t)
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
                GameWindowActions.SendKeyToD3(RosbotConstants.VkF7);
                break;
            case MonitorActions.StopBotF9:
                GameWindowActions.SendKeyToD3(RosbotConstants.VkF9);
                break;
            case MonitorActions.CloseBot:
                GameWindowActions.SendKeyToD3(RosbotConstants.VkF7);
                Thread.Sleep(CloseBotGapMs);
                GameWindowActions.SendKeyToD3(RosbotConstants.VkF7);
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
