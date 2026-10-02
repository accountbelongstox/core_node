// PY-REF: pyapps/d3-check/d3utils/battlenet_region_judge.py
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Single source of truth for Battle.net region and UI type from one control list (Asia email/password/combined login,
/// CN login, Asia/CN main UI, disconnect/connecting, detected region, dynamic state tuple).
/// 1:1 Python d3utils/battlenet_region_judge.py.
/// </summary>
public sealed class BattlenetRegionJudge
{
    private readonly IReadOnlyList<BattlenetControl> _controls;
    private readonly string? _preferredRegion;

    public BattlenetRegionJudge(IReadOnlyList<BattlenetControl> controls, string? preferredRegion = null)
    {
        _controls = controls;
        _preferredRegion = preferredRegion;
    }

    public bool HasAsiaLoginMarkers() => T.HasAutomationIdContainingAny(_controls, C.LoginWindowAutomationIdMarkersAsia);

    /// <summary>Asia email step: account + submit (or Continue) and no password field.</summary>
    public bool IsAsiaEmailStep()
    {
        if (!HasAsiaLoginMarkers()) return false;
        var account = T.FindByAnyAutomationId(_controls, C.AsiaLoginAccountAutomationIds) ?? T.FindByName(_controls, C.AsiaLoginAccountKeywordsFallback);
        if (account == null) return false;
        var submit = T.FindByAnyAutomationId(_controls, C.AsiaLoginSubmitAutomationIds)
            ?? T.FindByName(_controls, C.AsiaLoginSubmitKeywordsFallback.Concat(C.AsiaLoginContinueNameKeywords));
        if (submit == null) return false;
        var password = T.FindByAnyAutomationId(_controls, C.AsiaLoginPasswordAutomationIds) ?? T.FindByName(_controls, C.AsiaLoginPasswordKeywordsFallback);
        return password == null;
    }

    /// <summary>Asia password step: password + submit, or submit named Log in (not Continue) before password is enumerated.</summary>
    public bool IsAsiaPasswordStep()
    {
        if (!HasAsiaLoginMarkers()) return false;
        var password = T.FindByAnyAutomationId(_controls, C.AsiaLoginPasswordAutomationIds) ?? T.FindByName(_controls, C.AsiaLoginPasswordKeywordsFallback);
        var submit = T.FindByAnyAutomationId(_controls, C.AsiaLoginSubmitAutomationIds) ?? T.FindByName(_controls, C.AsiaLoginSubmitKeywordsFallback);
        if (password != null && submit != null) return true;
        string submitName = submit?.Name ?? "";
        return submitName.Length > 0 && ContainsAny(submitName, C.AsiaLoginSubmitKeywordsFallback) && !ContainsAny(submitName, C.AsiaLoginContinueNameKeywords);
    }

    public bool IsAsiaLoginUi() => IsAsiaEmailStep() || IsAsiaPasswordStep() || IsAsiaCombinedLoginUi();

    /// <summary>Account and password on the same Asia screen.</summary>
    public bool IsAsiaCombinedLoginUi()
    {
        if (!HasAsiaLoginMarkers()) return false;
        var account = T.FindByAnyAutomationId(_controls, C.AsiaLoginAccountAutomationIds) ?? T.FindByName(_controls, C.AsiaLoginAccountKeywordsFallback);
        var password = T.FindByAnyAutomationId(_controls, C.AsiaLoginPasswordAutomationIds) ?? T.FindByName(_controls, C.AsiaLoginPasswordKeywordsFallback);
        return account != null && password != null;
    }

    public bool IsAsiaPasswordStepWithSwitchAccount()
        => IsAsiaPasswordStep() && T.FindByName(_controls, C.AsiaLoginSwitchAccountKeywords) != null;

    public bool HasCnLoginMarkers() => T.HasAutomationIdContainingAny(_controls, C.LoginWindowAutomationIdMarkersCn);

    public bool IsCnLoginUi() => HasCnLoginMarkers() || T.FindByName(_controls, C.LoginScreenKeywordsFallbackCn) != null;

    /// <summary>Asia D3 tab + Play present and no Asia login markers.</summary>
    public bool HasAsiaMainUi()
    {
        if (HasAsiaLoginMarkers()) return false;
        return FindAsiaD3Tab() != null && FindAsiaPlay() != null;
    }

    /// <summary>CN D3 tab + Play present and no CN login markers.</summary>
    public bool HasCnMainUi()
    {
        if (HasCnLoginMarkers()) return false;
        return FindCnD3Tab() != null && FindCnPlay() != null;
    }

    public bool HasDisconnect()
    {
        if (C.DisconnectAutomationIds.Length > 0 && T.FindByAnyAutomationId(_controls, C.DisconnectAutomationIds) != null)
            return true;
        return T.FindByName(_controls, C.DisconnectKeywords) != null;
    }

    public bool HasConnecting()
    {
        if (C.ConnectingAutomationIds.Length > 0 && T.FindByAnyAutomationId(_controls, C.ConnectingAutomationIds) != null)
            return true;
        return T.FindByName(_controls, C.ConnectingKeywords) != null;
    }

    /// <summary>"asia" | "cn" | null. Preferred region: only that one; otherwise Asia then CN.</summary>
    public string? DetectedRegion()
    {
        if (_preferredRegion == C.RegionAsia) return TryAsiaResult() != null ? C.RegionAsia : null;
        if (_preferredRegion == C.RegionCn) return TryCnResult() != null ? C.RegionCn : null;
        if (TryAsiaResult() != null) return C.RegionAsia;
        if (TryCnResult() != null) return C.RegionCn;
        return null;
    }

    /// <summary>(on_login, disconnected, normal_available, play_name, connecting, region).</summary>
    public BattlenetDynamicState GetDynamicStateResult()
    {
        var empty = new BattlenetDynamicState(false, false, false, null, false, null);
        if (_controls.Count == 0) return empty;
        if (_preferredRegion == C.RegionAsia) return TryAsiaResult() is { } a ? a with { RegionDetected = C.RegionAsia } : empty;
        if (_preferredRegion == C.RegionCn) return TryCnResult() is { } c ? c with { RegionDetected = C.RegionCn } : empty;
        if (TryAsiaResult() is { } asia) return asia with { RegionDetected = C.RegionAsia };
        if (TryCnResult() is { } cn) return cn with { RegionDetected = C.RegionCn };
        return empty;
    }

    public bool IsAsia() => DetectedRegion() == C.RegionAsia;

    public bool IsCn() => DetectedRegion() == C.RegionCn;

    public bool IsLoggedIn() => HasAsiaMainUi() || HasCnMainUi();

    private BattlenetDynamicState? TryAsiaResult()
    {
        var d3 = FindAsiaD3Tab();
        var play = FindAsiaPlay();
        bool onLoginAsia = HasAsiaLoginMarkers() || T.FindByName(_controls, C.LoginScreenKeywordsFallbackAsia) != null;
        bool hasMain = d3 != null && play != null && !HasAsiaLoginMarkers();
        if (hasMain)
        {
            if (!HasConnecting())
                return new BattlenetDynamicState(false, false, true, string.IsNullOrEmpty(play!.Name) ? "Play" : play.Name, false, null);
            return new BattlenetDynamicState(false, false, false, null, true, null);
        }
        if (HasDisconnect()) return new BattlenetDynamicState(false, true, false, null, false, null);
        if (onLoginAsia) return new BattlenetDynamicState(true, false, false, null, false, null);
        return null;
    }

    private BattlenetDynamicState? TryCnResult()
    {
        var d3 = FindCnD3Tab();
        var play = FindCnPlay();
        bool onLoginCn = HasCnLoginMarkers() || T.FindByName(_controls, C.LoginScreenKeywordsFallbackCn) != null;
        bool hasMain = d3 != null && play != null && !HasCnLoginMarkers();
        bool connecting = HasConnecting();
        if (hasMain && !connecting)
            return new BattlenetDynamicState(false, false, true, string.IsNullOrEmpty(play!.Name) ? "Play" : play.Name, false, null);
        if (hasMain) return new BattlenetDynamicState(false, false, false, null, true, null);
        if (onLoginCn) return new BattlenetDynamicState(true, false, false, null, false, null);
        return null;
    }

    private BattlenetControl? FindAsiaD3Tab() => T.FindByAnyAutomationId(_controls, C.D3TabAutomationIdsAsia) ?? T.FindByName(_controls, C.D3TabNameKeywordsFallbackAsia);

    private BattlenetControl? FindAsiaPlay() => T.FindByAnyAutomationId(_controls, C.StartGameAutomationIdsAsia) ?? T.FindByName(_controls, C.StartGameNameKeywordsFallbackAsia);

    private BattlenetControl? FindCnD3Tab() => T.FindByAnyAutomationId(_controls, C.D3TabAutomationIdsCn) ?? T.FindByName(_controls, C.D3TabNameKeywordsFallbackCn);

    private BattlenetControl? FindCnPlay() => T.FindByAnyAutomationId(_controls, C.StartGameAutomationIdsCn) ?? T.FindByName(_controls, C.StartGameNameKeywordsFallbackCn);

    internal static bool ContainsAny(string text, IEnumerable<string> keywords)
        => keywords.Any(k => !string.IsNullOrEmpty(k) && text.Contains(k, StringComparison.Ordinal));
}
