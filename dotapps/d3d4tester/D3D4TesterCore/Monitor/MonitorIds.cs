// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Monitor;

/// <summary>Trigger event ids (stored in monitor.triggers). Ported from the RBAssist event list.</summary>
public static class MonitorEvents
{
    public const string ScheduledTime = "scheduled_time";
    public const string LogMatch = "log_match";
    public const string HistoryMatch = "history_match";
    public const string ErrorDetected = "error_detected";
    public const string DeathDetected = "death_detected";
    public const string FailDetected = "fail_detected";
    public const string D3Launch = "d3_launch";
    public const string D3Exit = "d3_exit";
    public const string RosbotLaunch = "rosbot_launch";
    public const string RosbotExit = "rosbot_exit";
    public const string MonitoringStart = "monitoring_start";
    public const string MonitoringStop = "monitoring_stop";
    public const string AppLaunch = "app_launch";
    public const string AppExit = "app_exit";
    public const string LogRollover = "log_rollover";
    public const string HistoryRollover = "history_rollover";
    public const string LogTimer = "log_timer";
    public const string HistoryTimer = "history_timer";
    public const string NewRun = "new_run";
    public const string CombatSwitch = "combat_switch";
    public const string UrshiOpen = "urshi_open";
    public const string TownPortal = "town_portal";
    public const string TownPortalAfterIllusion = "town_portal_v2";
    public const string ShrineInfinite = "shrine_infinite";
    public const string ShrineSpeed = "shrine_speed";
    public const string BuffEnd = "buff_end";
    public const string SpecialPortalTimer = "special_portal_timer";
    public const string InventoryFull = "inventory_full";
    public const string RepairNeeded = "repair_needed";
    public const string ItemPickup = "item_pickup";

    public static IReadOnlyList<string> All { get; } = new[]
    {
        ScheduledTime, LogMatch, HistoryMatch, ErrorDetected, DeathDetected, FailDetected, D3Launch, D3Exit, RosbotLaunch, RosbotExit,
        MonitoringStart, MonitoringStop, AppLaunch, AppExit, LogRollover, HistoryRollover, LogTimer, HistoryTimer, NewRun, CombatSwitch,
        UrshiOpen, TownPortal, TownPortalAfterIllusion, ShrineInfinite, ShrineSpeed, BuffEnd, SpecialPortalTimer,
        InventoryFull, RepairNeeded, ItemPickup
    };
}

/// <summary>Trigger action ids. RBAssist "call AutoIt function" is not ported (no AutoIt runtime).</summary>
public static class MonitorActions
{
    public const string WriteLog = "write_log";
    public const string StartMonitoring = "start_monitoring";
    public const string StopMonitoring = "stop_monitoring";
    public const string PauseMonitoring = "pause_monitoring";
    public const string ResumeMonitoring = "resume_monitoring";
    public const string StopBotF7 = "stop_bot_f7";
    public const string StopBotF9 = "stop_bot_f9";
    public const string CloseBot = "close_bot";
    public const string RestartBot = "restart_bot";
    public const string RestartBotWithBattlenet = "restart_bot_battlenet";
    public const string TakeScreenshot = "take_screenshot";
    public const string GameSpeed = "game_speed";
    public const string TownPortal = "town_portal";
    public const string QuickQuit = "quick_quit";
    public const string UnstuckMove = "unstuck_move";
    public const string ExecuteCommand = "execute_command";
    public const string SendKeys = "send_keys";
    public const string Notify = "notify";
    public const string SetSequence = "set_sequence";
    /// <summary>Return to town and stand by (CoreNodeBridge town standby): monitoring and ROSBOT paused, game kept.</summary>
    public const string TownStandby = "town_standby";

    public static IReadOnlyList<string> All { get; } = new[]
    {
        WriteLog, StartMonitoring, StopMonitoring, PauseMonitoring, ResumeMonitoring, StopBotF7, StopBotF9, CloseBot, RestartBot, RestartBotWithBattlenet, TakeScreenshot,
        GameSpeed, TownPortal, TownStandby, QuickQuit, UnstuckMove, ExecuteCommand, SendKeys, Notify, SetSequence
    };
}

/// <summary>Values of monitor.log_timeout_mode.</summary>
public static class MonitorLogTimeoutModes
{
    public const string LogOnly = "log_only";
    public const string Both = "both";
    public const string Either = "either";
    public static IReadOnlyList<string> All { get; } = new[] { LogOnly, Both, Either };
}

/// <summary>Screenshot kinds: config key prefix, default folder name and file name label.</summary>
public static class MonitorScreenshotKinds
{
    public const string Periodic = "periodic";
    public const string Death = "death";
    public const string Fail = "fail";
    public const string Error = "error";
    public static IReadOnlyList<string> All { get; } = new[] { Periodic, Death, Fail, Error };
}

/// <summary>Notification channels (monitor.notify.*); "all" sends to every configured channel.</summary>
public static class MonitorNotifyChannels
{
    public const string All = "all";
    public const string PushPlus = "pushplus";
    public const string Telegram = "telegram";
    public const string Discord = "discord";
    public const string Prowl = "prowl";
    public static IReadOnlyList<string> Values { get; } = new[] { All, PushPlus, Telegram, Discord, Prowl };
}

/// <summary>Placeholders replaced in action arguments.</summary>
public static class MonitorPlaceholders
{
    public const string LastLogLine = "%LOG%";
    public const string LastHistoryLine = "%HISTORY%";
}
