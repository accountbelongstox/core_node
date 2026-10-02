// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/flow_bn_block_state.py
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>All steps of the B block (ROSBOT_FLOW_MERMAID). 1:1 Python flow_bn_block_state.BNStep.</summary>
public enum BnStep
{
    BN_Entry,
    BN_Win,
    BN_Start,
    BN_Wait,
    BN_WaitResult,
    BN_UI,
    BN_Login1,
    BN_Login2,
    BN_LoginAsia,
    BN_First,
    BN_B4p_BrowserWait,
    BN_Act,
    BN_WaitPlay,
    BN_Poll,
    BN_Exit,
    BN_ExitWait,
    BN_B14_Ok,
    BN_B15a_Offline,
    BN_B15b_Timeout,
    BN_B15c_Other,
    BN_Confirmed
}

/// <summary>
/// State of one B-block instance. Two independent copies (BN-only and Flow-master) so both flows can run at once.
/// Times are monotonic seconds. 1:1 Python d3utils/rosbot_flow/flow_bn_block_state.py (BNBlockState + module functions).
/// </summary>
public sealed class BnBlockState
{
    private static readonly BnBlockState BnOnly = new();
    private static readonly BnBlockState FlowMaster = new();

    public BnStep CurrentStep { get; set; } = BnStep.BN_Entry;
    public string B5EntryReason { get; set; } = "";
    public double WaitUntil { get; set; }
    public double B7PollDeadline { get; set; }
    public double B13PollDeadline { get; set; }
    public double OauthWaitUntil { get; set; }
    public double BrowserFallbackDeadline { get; set; }
    /// <summary>B11 timeout by flow tick (current tick &gt;= this -> timeout).</summary>
    public int B11DeadlineTick { get; set; }
    public bool BattlenetTickConfirmed { get; set; }
    public bool BnFlowEverConfirmed { get; set; }
    public int B7SkipCount { get; set; }
    public double B7LastTriggerTime { get; set; }

    private BnBlockState() { }

    /// <summary>Context for one flow: true = BN-only, false = Flow-master. 1:1 Python get_bn_block_ctx.</summary>
    public static BnBlockState Get(bool forBnOnly) => forBnOnly ? BnOnly : FlowMaster;

    public static BnStep GetCurrentStep(bool forBnOnly) => Get(forBnOnly).CurrentStep;

    public static bool GetEverConfirmed(bool forBnOnly) => Get(forBnOnly).BnFlowEverConfirmed;

    /// <summary>1:1 Python set_battlenet_tick_confirmed(for_bn_only) (flow master after B confirmed).</summary>
    public static void SetTickConfirmed(bool forBnOnly) => Get(forBnOnly).BattlenetTickConfirmed = true;

    /// <summary>Read and clear tick-confirmed. 1:1 Python get_and_clear_battlenet_tick_confirmed(for_bn_only).</summary>
    public bool GetAndClearTickConfirmed()
    {
        bool v = BattlenetTickConfirmed;
        BattlenetTickConfirmed = false;
        return v;
    }

    /// <summary>Reset one flow's block to entry. 1:1 Python reset_bn_block_state.</summary>
    public static void Reset(bool forBnOnly)
    {
        var b = Get(forBnOnly);
        b.CurrentStep = BnStep.BN_Entry;
        b.B5EntryReason = "";
        b.WaitUntil = 0;
        b.B7PollDeadline = 0;
        b.B13PollDeadline = 0;
        b.OauthWaitUntil = 0;
        b.BrowserFallbackDeadline = 0;
        b.B11DeadlineTick = 0;
        b.BattlenetTickConfirmed = false;
        b.BnFlowEverConfirmed = false;
        b.B7SkipCount = 0;
        b.B7LastTriggerTime = 0;
    }

    /// <summary>BN_Confirmed -> BN_Poll. 1:1 Python reset_confirmed_to_poll.</summary>
    public static void ResetConfirmedToPoll(bool forBnOnly)
    {
        var b = Get(forBnOnly);
        if (b.CurrentStep == BnStep.BN_Confirmed)
            b.CurrentStep = BnStep.BN_Poll;
    }

    /// <summary>1:1 Python is_bn_flow_in_login_phase(for_bn_only).</summary>
    public static bool IsInLoginPhase(bool forBnOnly)
        => Get(forBnOnly).CurrentStep is BnStep.BN_LoginAsia or BnStep.BN_Login1 or BnStep.BN_Login2;

    /// <summary>1:1 Python enter_battlenet_at_b2.</summary>
    public static void EnterBattlenetAtB2(bool forBnOnly) => Get(forBnOnly).CurrentStep = BnStep.BN_Win;
}
