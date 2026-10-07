// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Constants;

/// <summary>monitor.* keys: RBAssist features merged into d3d4tester (crash recovery, screenshots, notifications, triggers, tools).</summary>
public static partial class ConfigKeys
{
    public const string MonitorAutoStartOnLaunch = "monitor.auto_start_on_launch";
    public const string MonitorRestartOnErrorPopup = "monitor.restart_on_error_popup";
    public const string MonitorCloseTeamViewerPopups = "monitor.close_teamviewer_popups";
    /// <summary>F3 timeout source: log_only (logs.txt), both (logs.txt and history.txt stale), either (one of them stale).</summary>
    public const string MonitorLogTimeoutMode = "monitor.log_timeout_mode";
    public const string MonitorD3MemoryRestart = "monitor.d3_memory_restart";
    public const string MonitorD3MemoryLimitMb = "monitor.d3_memory_limit_mb";
    public const string MonitorRestartBattlenetOnRestart = "monitor.restart_battlenet_on_restart";
    public const string MonitorArchiveLogRollover = "monitor.archive_log_rollover";
    public const string MonitorD3ShrinkOnStart = "monitor.d3_shrink_on_start";
    public const string MonitorD3ShrinkWidth = "monitor.d3_shrink_width";
    public const string MonitorD3ShrinkHeight = "monitor.d3_shrink_height";
    public const string MonitorForceSequence = "monitor.force_sequence";
    public const string MonitorForceSequenceName = "monitor.force_sequence_name";

    public const string MonitorTuningEnabled = "monitor.process_tuning.enabled";
    public const string MonitorTuningD3Priority = "monitor.process_tuning.d3_priority";
    public const string MonitorTuningD3Cpus = "monitor.process_tuning.d3_cpus";
    public const string MonitorTuningRosbotPriority = "monitor.process_tuning.rosbot_priority";
    public const string MonitorTuningRosbotCpus = "monitor.process_tuning.rosbot_cpus";

    public const string MonitorScreenshotsRoot = "monitor.screenshots";
    public const string MonitorScreenshotCropCustom = "monitor.screenshots.crop_custom";
    public const string MonitorScreenshotCrop = "monitor.screenshots.crop";
    public const string MonitorScreenshotPeriodicMinutes = "monitor.screenshots.periodic_minutes";
    public const string MonitorScreenshotEnabledSuffix = "_enabled";
    public const string MonitorScreenshotDirSuffix = "_dir";
    public const string MonitorScreenshotKeepSuffix = "_keep";

    public const string MonitorNotifyPushPlusToken = "monitor.notify.pushplus_token";
    public const string MonitorNotifyTelegramToken = "monitor.notify.telegram_token";
    public const string MonitorNotifyTelegramChatId = "monitor.notify.telegram_chat_id";
    public const string MonitorNotifyDiscordWebhook = "monitor.notify.discord_webhook";
    public const string MonitorNotifyProwlApiKey = "monitor.notify.prowl_api_key";
    public const string MonitorNotifyOnRestart = "monitor.notify.on_restart";
    public const string MonitorNotifyRestartChannel = "monitor.notify.restart_channel";

    public const string MonitorToolsSpeedBridgePath = "monitor.tools.speed_bridge_path";
    public const string MonitorToolsTcpResetPath = "monitor.tools.tcp_reset_path";

    public const string MonitorProbeFight = "monitor.probes.fight";
    public const string MonitorProbeTownPortal = "monitor.probes.town_portal";
    public const string MonitorProbeUrshi = "monitor.probes.urshi";
    public const string MonitorProbeFinishIllusion = "monitor.probes.finish_illusion";
    public const string MonitorProbeFindIllusion = "monitor.probes.find_illusion";
    public const string MonitorProbePortalKeys = "monitor.probes.portal_keys";

    public const string MonitorTriggers = "monitor.triggers";

    /// <summary>ROSBOT license keys (one cipher text, newline-joined), the one written to RoS-BoT.ini, and the before-start switch.</summary>
    public const string MonitorRosbotKeys = "monitor.rosbot_keys.keys";
    public const string MonitorRosbotKeyActiveIndex = "monitor.rosbot_keys.active_index";
    public const string MonitorRosbotKeyWriteBeforeStart = "monitor.rosbot_keys.write_before_start";

    /// <summary>Screenshot key for kind (periodic, death, fail, error) and suffix: monitor.screenshots.death_dir.</summary>
    public static string MonitorScreenshotKey(string kind, string suffix) => $"{MonitorScreenshotsRoot}.{kind}{suffix}";
}
