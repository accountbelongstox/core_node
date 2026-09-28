namespace DotApps.d3check.Constants;

/// <summary>
/// i18n key paths for UI text. Same key strings as Python (ui.*); dot convention: PascalCase constant names.
/// Use with II18nProvider.GetUiText(I18nKeys.MainWindowTitle) etc.
/// </summary>
public static class I18nKeys
{
    public const string MainWindowTitle = "ui.main_window.title";

    public const string TabsMainFunctions = "ui.tabs.main_functions";
    public const string TabsRosbotExtension = "ui.tabs.rosbot_extension";
    public const string TabsD4Functions = "ui.tabs.d4_functions";
    public const string TabsCoordinateCalibration = "ui.tabs.coordinate_calibration";
    public const string TabsLog = "ui.tabs.log";

    public const string OptionsPlaySoundOnSwitch = "ui.options.play_sound_on_switch";
    public const string OptionsSmartPause = "ui.options.smart_pause";
    public const string OptionsUseCustomStandKey = "ui.options.use_custom_stand_key";
    public const string OptionsCurrentActiveConfig = "ui.options.current_active_config";
    public const string BottomBarOneClickScan = "ui.bottom_bar.one_click_scan";
    public const string BottomBarScanning = "ui.bottom_bar.scanning";

    public const string StatusBattlenet = "ui.rosbot.battlenet_status";
    public const string StatusRos = "ui.rosbot.ros_label";
    public const string StatusD3 = "ui.rosbot.d3_status";
    public const string StatusMap = "ui.rosbot.map_status";
    public const string StatusStage = "ui.rosbot.stage";
    public const string StatusNotFound = "ui.rosbot.not_found";
    public const string StatusNormal = "ui.rosbot.status_normal";
    public const string StatusBattlenetWakingUp = "ui.rosbot.status_battlenet_waking_up";
    public const string StatusServerCn = "ui.rosbot.server_cn";
    public const string StatusServerAsia = "ui.rosbot.server_asia";
    public const string StatusServerUnknown = "ui.rosbot.server_unknown";
    public const string StatusMapUnknown = "ui.rosbot.map_unknown";
    public const string StatusStageUnknown = "ui.rosbot.stage_unknown";
    public const string StatusOauthConnected = "ui.rosbot.oauth_script_connected";
    public const string StatusOauthDisconnected = "ui.rosbot.oauth_script_disconnected";
    public const string StatusWindowSizeFormat = "ui.status_bar.size_format";
    /// <summary>Format for ROS restart count, e.g. [R{count}] or 重{count}. 1:1 Python rosbot.restart_count_format.</summary>
    public const string StatusRestartCountFormat = "ui.rosbot.restart_count_format";

    // Rosbot panel (same keys as Python ui.rosbot.*)
    public const string RosbotPathSettings = "ui.rosbot.path_settings";
    public const string RosbotRosbotPath = "ui.rosbot.rosbot_path";
    public const string RosbotBattlenetPath = "ui.rosbot.battlenet_path";
    public const string RosbotD3Path = "ui.rosbot.d3_path";
    public const string RosbotBotSettings = "ui.rosbot.bot_settings";
    public const string RosbotAutoEnableLatestRos = "ui.rosbot.auto_enable_latest_ros";
    public const string RosbotBluePortalPriority = "ui.rosbot.blue_portal_priority";
    public const string RosbotFirstbornBlueGateReuse = "ui.rosbot.firstborn_blue_gate_reuse";
    public const string RosbotPickupBloodShards = "ui.rosbot.pickup_blood_shards";
    public const string RosbotSmartEcho = "ui.rosbot.smart_echo";
    public const string RosbotSeconds = "ui.rosbot.seconds";
    public const string RosbotTestMode = "ui.rosbot.test_mode";
    public const string RosbotMinutes = "ui.rosbot.minutes";
    public const string RosbotPreventStuck = "ui.rosbot.prevent_stuck";
    public const string RosbotStartup = "ui.rosbot.startup";
    public const string RosbotTimeoutRestart = "ui.rosbot.timeout_restart";
    public const string RosbotControlPanel = "ui.rosbot.control_panel";
    public const string RosbotStartRosbot = "ui.rosbot.start_rosbot";
    public const string RosbotStopRosbot = "ui.rosbot.stop_rosbot";
    public const string RosbotEnsureBattlenetOnly = "ui.rosbot.ensure_battlenet_only";
    public const string RosbotEnsureBattlenetOnlyOn = "ui.rosbot.ensure_battlenet_only_on";
    public const string RosbotUpdateRosbot = "ui.rosbot.update_rosbot";
    public const string RosbotOpenTampermonkeyScript = "ui.rosbot.open_tampermonkey_script";
    public const string RosbotSetAccountPassword = "ui.rosbot.set_account_password";
    public const string RosbotRosbotLog = "ui.rosbot.rosbot_log";
    /// <summary>1:1 Python rosbot.warning (messagebox title for file not found).</summary>
    public const string RosbotWarning = "ui.rosbot.warning";
    /// <summary>1:1 Python rosbot.log_file_not_found (body text when script/log file missing).</summary>
    public const string RosbotLogFileNotFound = "ui.rosbot.log_file_not_found";

    /// <summary>Credentials dialog. 1:1 Python credentials.*</summary>
    public const string CredentialsTitle = "ui.credentials.title";
    public const string CredentialsRegionType = "ui.credentials.region_type";
    public const string CredentialsRegionAsia = "ui.credentials.region_asia";
    public const string CredentialsRegionCn = "ui.credentials.region_cn";
    public const string CredentialsAccount = "ui.credentials.account";
    public const string CredentialsPassword = "ui.credentials.password";

    public const string SkillConfigSkill = "ui.skill_config.skill";
    public const string SkillConfigKey = "ui.skill_config.key";
    public const string SkillConfigStrategy = "ui.skill_config.strategy";
    public const string SkillConfigStrategiesContinuous = "ui.skill_config.strategies.continuous";
    public const string SkillConfigStrategiesSingle = "ui.skill_config.strategies.single";
    public const string SkillConfigStrategiesHold = "ui.skill_config.strategies.hold";
    public const string SkillConfigStrategiesIgnore = "ui.skill_config.strategies.ignore";
    public const string SkillConfigInterval = "ui.skill_config.interval";
    public const string SkillConfigDelay = "ui.skill_config.delay";
    public const string SkillConfigRandomDelay = "ui.skill_config.random_delay";

    public const string AuxiliaryFunctionsCombatMacro = "ui.auxiliary_functions.combat_macro";
    public const string AuxiliaryFunctionsAssistantMacro = "ui.auxiliary_functions.assistant_macro";
    public const string AuxiliaryFunctionsAnimationSpeed = "ui.auxiliary_functions.animation_speed";
    public const string AuxiliaryFunctionsGameLanguage = "ui.auxiliary_functions.game_language";
    public const string AuxiliaryFunctionsSlow = "ui.auxiliary_functions.slow";
    public const string AuxiliaryFunctionsMedium = "ui.auxiliary_functions.medium";
    public const string AuxiliaryFunctionsFast = "ui.auxiliary_functions.fast";

    public const string AdditionalSettingsQuickSwitch = "ui.additional_settings.quick_switch";
    public const string BasicInfoCurrentSkillConfig = "ui.basic_info.current_skill_config";

    public const string UiAuxiliaryPanelBagOffsetLabel = "ui.auxiliary_panel.bag_offset_label";
    public const string MainFunctionsPanelCurrentConfig = "ui.main_functions_panel.current_config";
    public const string MainFunctionsPanelMacroStartHotkeyLabel = "ui.main_functions_panel.macro_start_hotkey_label";
    public const string MainFunctionsPanelMacroPauseHotkeyLabel = "ui.main_functions_panel.macro_pause_hotkey_label";
    /// <summary>Combat macro Start/Stop toggle button. 1:1 Python MacroControls on_start/on_stop.</summary>
    public const string MainFunctionsPanelCombatMacroToggleButton = "ui.main_functions_panel.combat_macro_toggle_button";
    public const string ConfigTabsConfig1 = "ui.config_tabs.config1";
    public const string ConfigTabsConfig2 = "ui.config_tabs.config2";
    public const string ConfigTabsConfig3 = "ui.config_tabs.config3";
    public const string ConfigTabsConfig4 = "ui.config_tabs.config4";
    public const string SkillTableSkill = "ui.skill_config.skill";
    public const string SkillTableKey = "ui.skill_config.key";
    public const string SkillTableStrategy = "ui.skill_config.strategy";
    public const string SkillTableInterval = "ui.skill_config.interval";
    public const string SkillTableDelay = "ui.skill_config.delay";
    public const string SkillTableRandom = "ui.skill_config.random_delay";
    public const string SkillTableSkillsSkill1 = "ui.skill_table.skills.skill1";
    public const string SkillTableSkillsSkill2 = "ui.skill_table.skills.skill2";
    public const string SkillTableSkillsSkill3 = "ui.skill_table.skills.skill3";
    public const string SkillTableSkillsSkill4 = "ui.skill_table.skills.skill4";
    public const string SkillTableSkillsLeftClick = "ui.skill_table.skills.left_click";
    public const string SkillTableSkillsRightClick = "ui.skill_table.skills.right_click";
    public const string SkillTableSkillsPotion = "ui.skill_table.skills.potion";
    public const string AuxiliaryBloodShardEnabled = "ui.auxiliary_panel.blood_shard_enabled";
    public const string AuxiliaryQuickPickupEnabled = "ui.auxiliary_panel.quick_pickup_enabled";
    public const string AuxiliaryBlacksmithEnabled = "ui.auxiliary_panel.blacksmith_enabled";
    public const string AuxiliaryKanaiReforgeEnabled = "ui.auxiliary_panel.kanai_reforge_enabled";
    public const string AuxiliaryKanaiUpgradeEnabled = "ui.auxiliary_panel.kanai_upgrade_enabled";
    public const string AuxiliaryKanaiConvertEnabled = "ui.auxiliary_panel.kanai_convert_enabled";
    public const string AuxiliaryAutoSalvageEnabled = "ui.auxiliary_panel.auto_salvage_enabled";
    public const string AuxiliaryDropEquipmentEnabled = "ui.auxiliary_panel.drop_equipment_enabled";
    public const string AuxiliarySoundFeedback = "ui.auxiliary_panel.sound_feedback";
    public const string AuxiliarySmartPause = "ui.auxiliary_panel.smart_pause";
    public const string OptionsCustomStandKey = "ui.common.use_custom_stand_key";
    public const string AuxiliaryPlaySoundOnSwitch = "ui.options.play_sound_on_switch";
    public const string MainFunctionsPanelQuickSwitch = "ui.main_functions_panel.quick_switch";
    public const string MainFunctionsPanelAnimationSpeedLabel = "ui.main_functions_panel.animation_speed_label";
    public const string MainFunctionsPanelAnimationSpeedSlow = "ui.main_functions_panel.animation_speed_slow";
    public const string MainFunctionsPanelAnimationSpeedMedium = "ui.main_functions_panel.animation_speed_medium";
    public const string MainFunctionsPanelAnimationSpeedFast = "ui.main_functions_panel.animation_speed_fast";
    public const string MainFunctionsPanelGameLanguageLabel = "ui.main_functions_panel.game_language_label";
    public const string AutomationOptions = "ui.auxiliary_panel.automation_section_title";

    /// <summary>Key for skill row display name: ui.skill_table.skills.{skillKey}</summary>
    public static string SkillTableSkillDisplayKey(string skillKey) => "ui.skill_table.skills." + skillKey;

    // D4 panel (tab[2]) - same keys as Python ui.d4_panel.*
    public const string D4PanelTitle = "ui.d4_panel.title";
    public const string D4PanelSubTabsExpFarming = "ui.d4_panel.sub_tabs.exp_farming";
    public const string D4ExpFarmingTitle = "ui.d4_panel.exp_farming.title";
    public const string D4ExpFarmingStartButton = "ui.d4_panel.exp_farming.start_button";
    public const string D4ExpFarmingStopButton = "ui.d4_panel.exp_farming.stop_button";
    public const string D4ExpFarmingLogTitle = "ui.d4_panel.exp_farming.log_title";
    public const string D4ExpFarmingStatusRunning = "ui.d4_panel.exp_farming.status.running";
    public const string D4ExpFarmingStatusStopped = "ui.d4_panel.exp_farming.status.stopped";
    public const string D4ExpFarmingStatusReady = "ui.d4_panel.exp_farming.status.ready";
    public const string D4ExpFarmingGameStatusTitle = "ui.d4_panel.exp_farming.game_status.title";
    public const string D4ExpFarmingGameStatusCurrentMap = "ui.d4_panel.exp_farming.game_status.current_map";
    public const string D4ExpFarmingGameStatusGameState = "ui.d4_panel.exp_farming.game_status.game_state";
    public const string D4ExpFarmingGameStatusTeamCount = "ui.d4_panel.exp_farming.game_status.team_count";
    public const string D4ExpFarmingGameStatusDungeonProgress = "ui.d4_panel.exp_farming.game_status.dungeon_progress";
    public const string D4ExpFarmingGameStatusD4RunningStatus = "ui.d4_panel.exp_farming.game_status.d4_running_status";
    public const string D4ExpFarmingGameStatusScreenCoordinates = "ui.d4_panel.exp_farming.game_status.screen_coordinates";
    public const string D4ExpFarmingGameStatusScreenSize = "ui.d4_panel.exp_farming.game_status.screen_size";
    public const string D4ExpFarmingGameStatusMapSwitchCount = "ui.d4_panel.exp_farming.game_status.map_switch_count";
    public const string D4ExpFarmingGameStatusMapSwitchState = "ui.d4_panel.exp_farming.game_status.map_switch_state";
    public const string D4ExpFarmingGameStatusReserved = "ui.d4_panel.exp_farming.game_status.reserved";
    public const string D4ExpFarmingGameStatusUnknown = "ui.d4_panel.exp_farming.game_status.unknown";
    public const string D4ExpFarmingGameStatusRunning = "ui.d4_panel.exp_farming.game_status.running";
    public const string D4ExpFarmingGameStatusStopped = "ui.d4_panel.exp_farming.game_status.stopped";
    public const string D4ExpFarmingGameStatusWindowed = "ui.d4_panel.exp_farming.game_status.windowed";
    public const string D4ExpFarmingGameStatusFullscreen = "ui.d4_panel.exp_farming.game_status.fullscreen";
}
