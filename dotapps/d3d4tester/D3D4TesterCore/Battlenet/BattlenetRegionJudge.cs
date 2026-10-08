// PY-REF: pyapps/d3-check/d3utils/battlenet_region_judge.py
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net UI type checks on one control list (Asia email/password/combined login, CN login, Asia/CN main UI,
/// disconnect/connecting). The client screen state and the UI region come from BattlenetClientStateDetector.
/// 1:1 Python d3utils/battlenet_region_judge.py.
/// </summary>
public sealed class BattlenetRegionJudge
{
    private readonly IReadOnlyList<BattlenetControl> _controls;
    public BattlenetRegionJudge(IReadOnlyList<BattlenetControl> controls)
    {
        _controls = controls;
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

    private BattlenetControl? FindAsiaD3Tab() => T.FindByAnyAutomationId(_controls, C.D3TabAutomationIdsAsia) ?? T.FindByName(_controls, C.D3TabNameKeywordsFallbackAsia);

    private BattlenetControl? FindAsiaPlay() => T.FindByAnyAutomationId(_controls, C.StartGameAutomationIdsAsia) ?? T.FindByName(_controls, C.StartGameNameKeywordsFallbackAsia);

    private BattlenetControl? FindCnD3Tab() => T.FindByAnyAutomationId(_controls, C.D3TabAutomationIdsCn) ?? T.FindByName(_controls, C.D3TabNameKeywordsFallbackCn);

    private BattlenetControl? FindCnPlay() => T.FindByAnyAutomationId(_controls, C.StartGameAutomationIdsCn) ?? T.FindByName(_controls, C.StartGameNameKeywordsFallbackCn);

    internal static bool ContainsAny(string text, IEnumerable<string> keywords)
        => keywords.Any(k => !string.IsNullOrEmpty(k) && text.Contains(k, StringComparison.Ordinal));
}
