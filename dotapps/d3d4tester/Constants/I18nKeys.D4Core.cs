// PY-REF: pyapps/d3-check/providor/i18n/i18n_d4_panel_en.json
namespace DotApps.d3d4tester.Constants;

/// <summary>D4 core keys: map switch state, location, team check outcomes, team health labels (1:1 Python team_health.*).</summary>
public static partial class I18nKeys
{
    public const string D4MapStateNormal = "ui.d4_panel.exp_farming.game_status.map_state.normal";
    public const string D4MapStateSwitching = "ui.d4_panel.exp_farming.game_status.map_state.switching";
    public const string D4MapStatePostSwitch = "ui.d4_panel.exp_farming.game_status.map_state.post_switch";

    public const string D4LocationTown = "ui.d4_panel.exp_farming.game_status.location.town";
    public const string D4LocationDungeon = "ui.d4_panel.exp_farming.game_status.location.dungeon";
    public const string D4LocationUnknown = "ui.d4_panel.exp_farming.game_status.location.unknown";

    public const string D4TeamCheckChecking = "ui.d4_panel.exp_farming.team_check.checking";
    public const string D4TeamCheckHasTeam = "ui.d4_panel.exp_farming.team_check.has_team";
    public const string D4TeamCheckNoTeam = "ui.d4_panel.exp_farming.team_check.no_team";
    public const string D4TeamCheckUnknown = "ui.d4_panel.exp_farming.team_check.unknown";
    public const string D4TeamCheckFormationStarted = "ui.d4_panel.exp_farming.team_check.formation_started";
    public const string D4TeamCheckFormationSuccess = "ui.d4_panel.exp_farming.team_check.formation_success";
    public const string D4TeamCheckFormationFailed = "ui.d4_panel.exp_farming.team_check.formation_failed";
    public const string D4TeamCheckAbortNoTeam = "ui.d4_panel.exp_farming.team_check.abort_no_team";
    public const string D4TeamCheckContinueWarning = "ui.d4_panel.exp_farming.team_check.continue_warning";

    public const string D4ExpFarmingGameStatusDetecting = "ui.d4_panel.exp_farming.game_status.detecting";
    public const string D4ExpFarmingGameStatusNotDetected = "ui.d4_panel.exp_farming.game_status.not_detected";

    public const string TeamHealthLocalMap = "team_health.local_map";
    public const string TeamHealthNonLocalMap = "team_health.non_local_map";
    public const string TeamHealthSameMap = "team_health.same_map";
    public const string TeamHealthDifferentMap = "team_health.different_map";
    public const string TeamHealthGroup1 = "team_health.group1";
    public const string TeamHealthGroup2 = "team_health.group2";
    public const string TeamHealthMember = "team_health.member";
    public const string TeamHealthMembers = "team_health.members";
    public const string TeamHealthTotal = "team_health.total";
    public const string TeamHealthDetectionSummary = "team_health.detection_summary";
    public const string TeamHealthHpOffset = "team_health.hp_offset";
    public const string TeamHealthScreenPosition = "team_health.screen_position";
}
