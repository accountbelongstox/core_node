// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/extension_flow_state.py
// PY-REF: pyapps/d3-check/share/game_interface_data.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/extension_flow_tick_step.py
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>C block phases (ROSBOT_FLOW_MERMAID C: D3 already running direct). Idle = not in the C branch.</summary>
public enum ExtensionPhase
{
    Idle,
    CEntry,
    CC3Loop,
    CC3Wait,
    CC3Disconfirm,
    CC4Branch,
    CF1WaitGameTool,
    CC10SendM,
    CC10Wait,
    CC10Compare,
    CC7aSendM,
    CC7aWait,
    CC7aVerifyBounty,
    CC7bMinimize,
    CActionGroup,
}

/// <summary>
/// Extension (C branch) phase, wait ticks, deadline tick and payload; flow master only asks IsIdle.
/// Timing by flow tick count: deadline = current flow tick + N (90 ticks = 180 s at 2 s per flow tick).
/// d3_just_entered (entered from D13) makes game_tool skip C6/C10 and go directly to C7a.
/// 1:1 Python d3utils/rosbot_flow/extension_flow_state.py (module state -> Instance; dict payload -> typed fields).
/// </summary>
public sealed class ExtensionFlowState
{
    public const string BranchStart = "start";
    public const string BranchGameTool = "game_tool";
    public const string BranchDisconnect = "disconnect";
    public const string BranchWait = "wait";
    public const string BranchOther = "other";

    private readonly object _lock = new();
    private ExtensionPhase _phase = ExtensionPhase.Idle;
    private DateTime? _lastTeleportSuccessUtc;
    private bool _d3JustEnteredFromD13;
    private bool _requestDBlockFromB7;

    public static ExtensionFlowState Instance { get; } = new();

    private ExtensionFlowState()
    {
    }

    public ExtensionPhase Phase
    {
        get { lock (_lock) return _phase; }
        set { lock (_lock) _phase = value; }
    }

    public int WaitTicksRemaining { get; set; }

    public int DeadlineTick { get; set; }

    /// <summary>Payload "titles": D3 window titles for the C branch.</summary>
    public IReadOnlyList<string>? Titles { get; set; }

    /// <summary>Payload "branch_result": start | game_tool | disconnect | wait | other.</summary>
    public string? BranchResult { get; set; }

    /// <summary>Payload "d3_just_entered": set when entered from D13.</summary>
    public bool D3JustEntered { get; set; }

    /// <summary>Payload "c7a_round": 1 = first M round, 2 = second M round.</summary>
    public int C7aRound { get; set; } = 1;

    /// <summary>Payload "action_group_id" / "action_group_step_index" / "action_group_context".</summary>
    public string? ActionGroupId { get; set; }

    public int ActionGroupStepIndex { get; set; }

    public Dictionary<string, object?> ActionGroupContext { get; set; } = new();

    /// <summary>C3 last state for disconnect confirm.</summary>
    public string? LastC3State { get; set; }

    /// <summary>Time of last successful teleport (C7b or D13 path); not cleared by Reset.</summary>
    public DateTime? LastTeleportSuccessUtc
    {
        get { lock (_lock) return _lastTeleportSuccessUtc; }
    }

    public void SetLastTeleportSuccessNow()
    {
        lock (_lock) _lastTeleportSuccessUtc = DateTime.UtcNow;
    }

    /// <summary>Set when D13 found the D3 window with for_f2_only; the next C1 tick enters with d3_just_entered. 1:1 Python game_interface_data.set_d3_just_entered_from_d13.</summary>
    public void SetD3JustEnteredFromD13(bool value)
    {
        lock (_lock) _d3JustEnteredFromD13 = value;
    }

    /// <summary>Return and clear the D13 flag; flow master calls it before StartCBranch. 1:1 Python get_and_clear_d3_just_entered_from_d13.</summary>
    public bool GetAndClearD3JustEnteredFromD13()
    {
        lock (_lock)
        {
            bool v = _d3JustEnteredFromD13;
            _d3JustEnteredFromD13 = false;
            return v;
        }
    }

    /// <summary>True while within C10SkipAfterTeleportSec of the last teleport success.</summary>
    public bool IsInTeleportCooldown()
    {
        var last = LastTeleportSuccessUtc;
        return last.HasValue && (DateTime.UtcNow - last.Value).TotalSeconds < D3InterfaceConstants.C10SkipAfterTeleportSec;
    }

    /// <summary>Titles payload, defaulting to the D3 window titles when empty.</summary>
    public IReadOnlyList<string> GetTitlesOrDefault() =>
        Titles is { Count: > 0 } t ? t : D3WindowConstants.DiabloIIIWindowTitles;

    /// <summary>Set by B7 when no operable elements for N ticks; the controller then runs the D block once. 1:1 Python set_request_d_block_from_b7.</summary>
    public void SetRequestDBlockFromB7()
    {
        lock (_lock) _requestDBlockFromB7 = true;
    }

    /// <summary>Peek without clearing. 1:1 Python get_request_d_block_from_b7.</summary>
    public bool GetRequestDBlockFromB7()
    {
        lock (_lock) return _requestDBlockFromB7;
    }

    /// <summary>Return and clear. 1:1 Python get_and_clear_request_d_block_from_b7.</summary>
    public bool GetAndClearRequestDBlockFromB7()
    {
        lock (_lock)
        {
            bool v = _requestDBlockFromB7;
            _requestDBlockFromB7 = false;
            return v;
        }
    }

    /// <summary>Clear all extension flow state (idle). Does not clear the last teleport success time.</summary>
    public void Reset()
    {
        lock (_lock) _phase = ExtensionPhase.Idle;
        WaitTicksRemaining = 0;
        DeadlineTick = 0;
        Titles = null;
        BranchResult = null;
        D3JustEntered = false;
        C7aRound = 1;
        ActionGroupId = null;
        ActionGroupStepIndex = 0;
        ActionGroupContext = new Dictionary<string, object?>();
        LastC3State = null;
    }

    /// <summary>Idle = phase Idle and not within the post-teleport cooldown (avoid C7b loop).</summary>
    public bool IsIdle => Phase == ExtensionPhase.Idle && !IsInTeleportCooldown();

    public bool IsRunning => Phase != ExtensionPhase.Idle;

    /// <summary>When in an action group, flow master runs only the extension step (one step per tick), no refresh.</summary>
    public bool IsInActionGroup => Phase == ExtensionPhase.CActionGroup;

    public bool IsInC7bClickEventGroup => Phase == ExtensionPhase.CC7bMinimize;

    /// <summary>
    /// Start from the C branch (D3 running, BN confirmed). d3JustEntered: entered from D13 so game_tool skips C6/C10.
    /// 1:1 Python start_extension_flow_c_branch.
    /// </summary>
    public void StartCBranch(bool d3JustEntered = false)
    {
        if (d3JustEntered) D3JustEntered = true;
        Phase = ExtensionPhase.CEntry;
    }

    /// <summary>Start from D13 (just entered game). 1:1 Python start_extension_flow_from_d13.</summary>
    public void StartFromD13()
    {
        D3JustEntered = true;
        Phase = ExtensionPhase.CEntry;
    }
}
