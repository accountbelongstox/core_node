// PY-REF: pyapps/d3-check/providor/constants/common.py
// PY-REF: pyapps/d3-check/ui/components/auxiliary_options_block.py
namespace DotApps.d3d4tester.Constants;

/// <summary>
/// Config key paths for D3D4Tester. Matches Python providor keys (ui_settings.*, macro_configs.*, ros_settings, battlenet, d3, log_settings).
/// Use these constants so UI and Config stay in sync; no magic strings in feature code.
/// </summary>
public static partial class ConfigKeys
{
    // ---------- ui_settings (Python: providor CONFIG keys) ----------
    public const string UiSettingsWindowGeometry = "ui_settings.window_geometry";
    public const string UiSettingsAppIcon = "ui_settings.app_icon";
    public const string UiSettingsSkipTaskbarWin32Fix = "ui_settings.skip_taskbar_win32_fix";
    public const string UiSettingsCurrentLanguage = "ui_settings.current_language";
    public const string UiSettingsLastSelectedTab = "ui_settings.last_selected_tab";

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
    public const string AuxiliarySoundFeedback = "macro_configs.auxiliary_config.sound_feedback";

    // Feature sections are dicts {enabled, ...} (Python auxiliary_options_block); never write a bool to the section path.
    public const string AuxiliaryBloodShard = "macro_configs.auxiliary_config.blood_shard";
    public const string AuxiliaryQuickPickup = "macro_configs.auxiliary_config.quick_pickup";
    public const string AuxiliaryBlacksmith = "macro_configs.auxiliary_config.blacksmith";
    public const string AuxiliaryKanaiReforge = "macro_configs.auxiliary_config.kanai_reforge";
    public const string AuxiliaryKanaiUpgrade = "macro_configs.auxiliary_config.kanai_upgrade";
    public const string AuxiliaryKanaiConvert = "macro_configs.auxiliary_config.kanai_convert";
    public const string AuxiliaryAutoSalvage = "macro_configs.auxiliary_config.auto_salvage";
    public const string AuxiliaryDropEquipment = "macro_configs.auxiliary_config.drop_equipment";

    public static readonly string[] AuxiliaryFeatureSections =
    {
        AuxiliaryBloodShard, AuxiliaryQuickPickup, AuxiliaryBlacksmith, AuxiliaryKanaiReforge,
        AuxiliaryKanaiUpgrade, AuxiliaryKanaiConvert, AuxiliaryAutoSalvage, AuxiliaryDropEquipment
    };

    public const string AuxiliaryFeatureEnabledField = "enabled";
    public const string AuxiliaryBloodShardEnabled = AuxiliaryBloodShard + ".enabled";
    public const string AuxiliaryBloodShardType = AuxiliaryBloodShard + ".type";
    public const string AuxiliaryQuickPickupEnabled = AuxiliaryQuickPickup + ".enabled";
    public const string AuxiliaryBlacksmithEnabled = AuxiliaryBlacksmith + ".enabled";
    public const string AuxiliaryKanaiReforgeEnabled = AuxiliaryKanaiReforge + ".enabled";
    public const string AuxiliaryKanaiReforgeMode = AuxiliaryKanaiReforge + ".mode";
    public const string AuxiliaryKanaiUpgradeEnabled = AuxiliaryKanaiUpgrade + ".enabled";
    public const string AuxiliaryKanaiConvertEnabled = AuxiliaryKanaiConvert + ".enabled";
    public const string AuxiliaryKanaiConvertMaterial = AuxiliaryKanaiConvert + ".material";
    public const string AuxiliaryAutoSalvageEnabled = AuxiliaryAutoSalvage + ".enabled";
    public const string AuxiliaryAutoSalvageKeep = AuxiliaryAutoSalvage + ".keep";
    public const string AuxiliaryDropEquipmentEnabled = AuxiliaryDropEquipment + ".enabled";

    // ---------- ui_analysis.bag_offset: dict of 4 ints (Python auxiliary_options_block _BAG_OFFSET_KEYS) ----------
    public const string UiAnalysisBagOffset = "ui_analysis.bag_offset";
    public const string UiAnalysisBagOffsetTop = UiAnalysisBagOffset + ".top";
    public const string UiAnalysisBagOffsetLeft = UiAnalysisBagOffset + ".left";
    public const string UiAnalysisBagOffsetBottom = UiAnalysisBagOffset + ".bottom";
    public const string UiAnalysisBagOffsetRight = UiAnalysisBagOffset + ".right";
    public const string UiAnalysisBagOffsetUseInCalculation = UiAnalysisBagOffset + ".use_in_calculation";

    /// <summary>Downloads directory for ROSBOT zip (Python paths.downloads_dir). Fallback: user Downloads.</summary>
    public const string PathsDownloadsDir = "paths.downloads_dir";
    /// <summary>Tampermonkey script path. 1:1 Python TAMPERMONKEY_SCRIPT_PATH (providor/constants/common.py). Default: {repo}/scripts/d3check_oauth_login_tampermonkey.user.js.</summary>
    public const string PathsTampermonkeyScript = "paths.tampermonkey_script";

    // ---------- ros_settings, battlenet, d3, rosbot ----------
    public const string RosSettingsRosDirectory = "ros_settings.ros_directory";
    public const string RosSettingsBattlenetRegionCache = "ros_settings.battlenet_region_cache";
    public const string BattlenetPath = "battlenet.battlenet_path";
    /// <summary>Keep Battle.net running and logged in from startup (BN-only guard). Default on.</summary>
    public const string BattlenetEnsureNormal = "battlenet.ensure_normal";
    public const bool BattlenetEnsureNormalDefault = true;
    /// <summary>Global region chosen by the user ("cn" / "asia"); empty = from Battle.net.config, then the region cache.</summary>
    public const string BattlenetRegion = "battlenet.region";
    public const string BattlenetAbnormalRestartEnabled = Core.Battlenet.BattlenetConstants.ConfigKeyAbnormalRestartEnabled;
    public const string BattlenetAbnormalTimeoutSec = Core.Battlenet.BattlenetConstants.ConfigKeyAbnormalTimeoutSec;
    public const string BattlenetLoginRestartEnabled = Core.Battlenet.BattlenetConstants.ConfigKeyLoginRestartEnabled;
    public const string BattlenetLoginTimeoutSec = Core.Battlenet.BattlenetConstants.ConfigKeyLoginTimeoutSec;
    /// <summary>Ask before restarting Battle.net when the global region changes.</summary>
    public const string BattlenetRegionSwitchPrompt = "battlenet.region_switch_prompt";
    /// <summary>Saved accounts per region: battlenet_accounts.cn / .asia = [{label, email, password (encrypted)}].</summary>
    public const string BattlenetAccounts = "battlenet_accounts";
    /// <summary>Asia credentials object: { "email", "password" }. Password stored encrypted (machine-bound). 1:1 Python battlenet_asia_credentials. Use AsiaCredentialsService for read/write.</summary>
    public const string BattlenetAsiaCredentials = "battlenet_asia_credentials";
    /// <summary>CN credentials object: { "email", "password" }. 1:1 Python battlenet_cn_credentials.</summary>
    public const string BattlenetCnCredentials = "battlenet_cn_credentials";
    /// <summary>D3 exe path. 1:1 Python d3.d3_path. Written by 一键扫描 (ApplyScanResults); read by D3WindowFinder (priority exe then title). ROSBOT panel TxtD3Path binds this.</summary>
    public const string D3Path = "d3.d3_path";
    public const string RosSettingsAutoEnableLatestRos = "ros_settings.auto_enable_latest_ros";
    public const string RosSettingsAutoStartRosbot = "ros_settings.auto_start_rosbot";
    public const string RosbotPickupBloodShards = "rosbot.pickup_blood_shards";
    public const string RosbotPreventStuck = "rosbot.prevent_stuck";
    public const string RosbotBluePortalPriority = "rosbot.blue_portal_priority";
    public const string RosbotSmartEcho = "rosbot.smart_echo";
    public const string RosbotSmartEchoWaitSeconds = "rosbot.smart_echo_wait_seconds";
    public const string RosbotStartup = "rosbot.startup";
    public const string RosbotFirstbornBlueGateReuse = "rosbot.firstborn_blue_gate_reuse";
    public const string RosbotTestMode = "rosbot.test_mode";
    public const string RosbotTestTimeoutMinutes = "rosbot.test_timeout_minutes";
    public const string RosbotTestRecordedDurationSec = "rosbot.test_recorded_duration_sec";
    public const string RosbotTestRecordCount = "rosbot.test_record_count";
    public const string RosbotTotalRestartCount = "rosbot.total_restart_count";
    public const string BattlenetTimeoutRestart = Core.RosbotConstants.ConfigKeyTimeoutRestart;
    public const string RosbotTimeoutMinutes = "rosbot.timeout_minutes";
    public const string AntiStuckEnabled = "anti_stuck.enabled";

    // ---------- log_settings ----------
    public const string LogSettingsShowDebugLogs = "log_settings.show_debug_logs";
    public const string LogSettingsAutoScroll = "log_settings.auto_scroll";
    public const string LogSettingsLogLevel = "log_settings.log_level";
    public const string LogSettingsDebugLogLatency = "log_settings.debug_log_latency";

    // ---------- d4_settings ----------
    public const string D4SettingsExpFarmingRunning = "d4_settings.exp_farming_running";

    // ---------- coord_calibration (YOLO / calibration panel) ----------
    public const string CoordCalibrationClientType = "coord_calibration.client_type";
    public const string CoordCalibrationYoloDataRoot = "coord_calibration.yolo_data_root";
    public const string CoordCalibrationYoloCurrentProject = "coord_calibration.yolo_current_project";
    public const string CoordCalibrationYoloProjectList = "coord_calibration.yolo_project_list";
}
