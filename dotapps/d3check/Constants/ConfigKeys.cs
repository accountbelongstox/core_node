namespace DotApps.d3check.Constants;

/// <summary>
/// Config key paths for D3Check. Matches Python providor keys (ui_settings.*, macro_configs.*, ros_settings, battlenet, d3, log_settings).
/// Use these constants so UI and Config stay in sync; no magic strings in feature code.
/// </summary>
public static class ConfigKeys
{
    // ---------- ui_settings (Python: providor CONFIG keys) ----------
    public const string UiSettingsWindowGeometry = "ui_settings.window_geometry";
    public const string UiSettingsAppIcon = "ui_settings.app_icon";
    public const string UiSettingsSkipTaskbarWin32Fix = "ui_settings.skip_taskbar_win32_fix";
    public const string UiSettingsCurrentLanguage = "ui_settings.current_language";

    // ---------- macro_configs ----------
    public const string MacroConfigsCurrentSkillConfig = "macro_configs.current_skill_config";
    public const string MacroConfigsSkillConfigs = "macro_configs.skill_configs";
    public const string MacroConfigsAuxiliaryConfig = "macro_configs.auxiliary_config";

    /// <summary>Path used for hotkey rebind (same as Python HOTKEY_CONFIG_PATH_AUXILIARY).</summary>
    public const string HotkeyConfigPathAuxiliary = "macro_configs.auxiliary_config";

    public const string ConfigFileName = "d3check_config.json";

    public const string AuxiliaryMacroStartHotkey = "macro_configs.auxiliary_config.macro_start_hotkey";
    public const string AuxiliaryAssistantHotkey = "macro_configs.auxiliary_config.assistant_hotkey";
    public const string AuxiliaryAnimationSpeed = "macro_configs.auxiliary_config.animation_speed";
    public const string AuxiliaryGameLanguage = "macro_configs.auxiliary_config.game_language";
    public const string AuxiliarySmartPause = "macro_configs.auxiliary_config.smart_pause";
    public const string AuxiliaryBloodShard = "macro_configs.auxiliary_config.blood_shard";
    public const string AuxiliaryQuickPickup = "macro_configs.auxiliary_config.quick_pickup";
    public const string AuxiliaryBlacksmith = "macro_configs.auxiliary_config.blacksmith";
    public const string AuxiliaryKanaiReforge = "macro_configs.auxiliary_config.kanai_reforge";
    public const string AuxiliaryKanaiUpgrade = "macro_configs.auxiliary_config.kanai_upgrade";
    public const string AuxiliaryKanaiConvert = "macro_configs.auxiliary_config.kanai_convert";
    public const string AuxiliaryAutoSalvage = "macro_configs.auxiliary_config.auto_salvage";
    public const string AuxiliaryDropEquipment = "macro_configs.auxiliary_config.drop_equipment";
    public const string AuxiliarySoundFeedback = "macro_configs.auxiliary_config.sound_feedback";

    public const string UiAnalysisBagOffset = "ui_analysis.bag_offset";

    /// <summary>Downloads directory for ROSBOT zip (Python paths.downloads_dir). Fallback: user Downloads.</summary>
    public const string PathsDownloadsDir = "paths.downloads_dir";
    /// <summary>Tampermonkey script path. 1:1 Python TAMPERMONKEY_SCRIPT_PATH (providor/constants/common.py). Default: {repo}/scripts/d3check_oauth_login_tampermonkey.user.js.</summary>
    public const string PathsTampermonkeyScript = "paths.tampermonkey_script";

    // ---------- ros_settings, battlenet, d3, rosbot ----------
    public const string RosSettingsRosDirectory = "ros_settings.ros_directory";
    public const string RosSettingsBattlenetRegionCache = "ros_settings.battlenet_region_cache";
    public const string BattlenetPath = "battlenet.battlenet_path";
    /// <summary>Asia credentials object: { "email", "password" }. Password stored encrypted (machine-bound). 1:1 Python battlenet_asia_credentials. Use AsiaCredentialsService for read/write.</summary>
    public const string BattlenetAsiaCredentials = "battlenet_asia_credentials";
    /// <summary>CN credentials object: { "email", "password" }. 1:1 Python battlenet_cn_credentials.</summary>
    public const string BattlenetCnCredentials = "battlenet_cn_credentials";
    /// <summary>D3 exe path. 1:1 Python d3.d3_path. Written by 一键扫描 (ApplyScanResults); read by D3WindowFinder (priority exe then title). ROSBOT panel TxtD3Path binds this.</summary>
    public const string D3Path = "d3.d3_path";
    public const string RosSettingsAutoEnableLatestRos = "ros_settings.auto_enable_latest_ros";
    public const string RosbotPickupBloodShards = "rosbot.pickup_blood_shards";
    public const string RosbotPreventStuck = "rosbot.prevent_stuck";
    public const string RosbotBluePortalPriority = "rosbot.blue_portal_priority";
    public const string RosbotSmartEcho = "rosbot.smart_echo";
    public const string RosbotSmartEchoWaitSeconds = "rosbot.smart_echo_wait_seconds";
    public const string RosbotStartup = "rosbot.startup";
    public const string RosbotFirstbornBlueGateReuse = "rosbot.firstborn_blue_gate_reuse";
    public const string RosbotTestMode = "rosbot.test_mode";
    public const string RosbotTestTimeoutMinutes = "rosbot.test_timeout_minutes";
    public const string BattlenetTimeoutRestart = "battlenet.timeout_restart";
    public const string RosbotTimeoutMinutes = "rosbot.timeout_minutes";
    public const string AntiStuckEnabled = "anti_stuck.enabled";

    // ---------- log_settings ----------
    public const string LogSettingsShowDebugLogs = "log_settings.show_debug_logs";
    public const string LogSettingsAutoScroll = "log_settings.auto_scroll";
    public const string LogSettingsLogLevel = "log_settings.log_level";

    // ---------- coord_calibration (YOLO / calibration panel) ----------
    public const string CoordCalibrationClientType = "coord_calibration.client_type";
    public const string CoordCalibrationYoloDataRoot = "coord_calibration.yolo_data_root";
    public const string CoordCalibrationYoloCurrentProject = "coord_calibration.yolo_current_project";
    public const string CoordCalibrationYoloProjectList = "coord_calibration.yolo_project_list";
}
