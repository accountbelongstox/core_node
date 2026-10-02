// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_asia.py
// PY-REF: pyapps/d3-check/d4utils/d4_battlenet_operation.py
using DotCore.Foundations;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net operations for the Asia region. CN methods return false; is_on_login_screen / is_login_screen_ready are false for Asia
/// (Asia login is judged by IsOnAsiaLoginScreen). 1:1 Python d3utils/battlenet_operation_asia.py (+ d4utils/d4_battlenet_operation.py Asia branch).
/// </summary>
public sealed class BattlenetOperationAsia : BattlenetOperationBase
{
    private readonly BattlenetAsiaOps _asiaOps;

    public BattlenetOperationAsia()
    {
        _asiaOps = new BattlenetAsiaOps(this);
    }

    public override string Region => C.RegionAsia;

    /// <summary>Asia login: email step, password step, then any other Asia login UI (combined / switch account).</summary>
    protected override BattlenetClientState? ClassifyLoginScreen(IReadOnlyList<BattlenetControl> controls)
    {
        var judge = new BattlenetRegionJudge(controls);
        if (judge.IsAsiaEmailStep()) return BattlenetClientState.LoginAsiaEmail;
        if (judge.IsAsiaPasswordStep()) return BattlenetClientState.LoginAsiaPassword;
        if (judge.IsAsiaLoginUi()) return BattlenetClientState.LoginAsia;
        return null;
    }

    public BattlenetAsiaOps AsiaOps => _asiaOps;

    /// <summary>Exact automation id, then name (excluding Playing Now / Game Version). 1:1 Python click_d3_tab.</summary>
    public override bool ClickD3Tab()
    {
        var controls = T.Enumerate();
        if (controls.Count > 0)
        {
            foreach (var aid in C.D3TabAutomationIdsAsia)
            {
                var ctrl = T.FindByAutomationId(controls, aid, exactMatch: true);
                if (ctrl != null)
                {
                    ColorPrinter.Blue($"[BattlenetOperation] Asia Click D3 tab: automation_id={aid}");
                    return T.ClickControl(ctrl);
                }
            }
            var byName = T.FindByName(controls, C.D3TabNameKeywordsFallbackAsia);
            if (byName != null && !BattlenetRegionJudge.ContainsAny(byName.Name, C.GameTabExcludedNameSubstrings))
            {
                ColorPrinter.Blue($"[BattlenetOperation] Asia Click D3 tab: name={byName.Name}");
                return T.ClickControl(byName);
            }
        }
        ColorPrinter.Yellow("[BattlenetOperation] D3 tab control not found (Asia)");
        return false;
    }

    /// <summary>1:1 Python click_start_game.</summary>
    public override bool ClickStartGame()
    {
        var controls = T.Enumerate();
        if (controls.Count > 0)
        {
            foreach (var aid in C.StartGameAutomationIdsAsia)
            {
                var ctrl = T.FindByAutomationId(controls, aid);
                if (ctrl != null)
                {
                    ColorPrinter.Blue($"[BattlenetOperation] Asia Click start game: automation_id={aid}");
                    return T.ClickControl(ctrl);
                }
            }
            var byName = T.FindByName(controls, C.StartGameNameKeywordsFallbackAsia);
            if (byName != null)
            {
                ColorPrinter.Blue($"[BattlenetOperation] Asia Click start game: name={byName.Name}");
                return T.ClickControl(byName);
            }
        }
        ColorPrinter.Yellow("[BattlenetOperation] Start game button not found (Asia)");
        return false;
    }

    public override bool ClickPlayButtonIfVisible(bool forceRefresh = true)
        => ClickPlayIfVisible(C.StartGameAutomationIdsAsia, C.StartGameNameKeywordsFallbackAsia, forceRefresh);

    /// <summary>1:1 Python is_game_starting.</summary>
    public override bool IsGameStarting()
    {
        var ctrl = FindPlay(T.EnumerateLight(), C.StartGameAutomationIdsAsia, C.StartGameNameKeywordsFallbackAsia);
        return ctrl != null && PlayButtonIndicatesStarting(ctrl);
    }

    public override BattlenetDynamicState GetDynamicState()
        => ComputeDynamicState(C.LoginWindowAutomationIdMarkersAsia, C.LoginScreenKeywordsFallbackAsia,
            C.D3TabAutomationIdsAsia, C.D3TabNameKeywordsFallbackAsia, C.StartGameAutomationIdsAsia, C.StartGameNameKeywordsFallbackAsia);

    public override bool IsOnLoginScreen() => false;

    public override bool IsOnAsiaLoginScreen() => new BattlenetRegionJudge(T.EnumerateLight()).IsAsiaLoginUi();

    public bool IsOnAsiaEmailStep() => _asiaOps.IsOnAsiaEmailStep();

    public bool IsOnAsiaPasswordStep() => _asiaOps.IsOnAsiaPasswordStep();

    public bool IsOnAsiaCombinedLoginUi() => _asiaOps.IsOnAsiaCombinedLoginUi();

    public override bool PerformAsiaEmailStep(string email) => _asiaOps.PerformAsiaEmailStep(email);

    public override bool PerformAsiaPasswordStep(string? password = null) => _asiaOps.PerformAsiaPasswordStep(password);

    public bool PerformAsiaCombinedLogin(string email, string? password = null) => _asiaOps.PerformAsiaCombinedLogin(email, password);

    public override bool PerformAsiaLoginFillAndSubmit(string? email, string? password) => _asiaOps.PerformAsiaLoginFillAndSubmit(email, password);

    public override bool IsLoggedIn() => new BattlenetRegionJudge(T.EnumerateLight()).HasAsiaMainUi();

    public override bool PerformCnLoginFlow(double waitAfterNetEaseSec = C.CnAfterNetEaseClickSettleSec) => false;

    public override bool ClickCnLoginButton() => false;

    public override bool IsLoginScreenReady() => false;

    /// <summary>Asia D4 tab: exact automation id (skip Playing Now / Game Version), then name. 1:1 Python D4BattlenetOperation.click_d4_tab (region asia).</summary>
    public override bool ClickD4Tab()
    {
        var controls = T.Enumerate();
        if (controls.Count > 0)
        {
            var ctrl = FindGameTabByAutomationId(controls, C.D4TabAutomationIdsAsia, skipExcludedOnAid: true);
            if (ctrl != null)
            {
                ColorPrinter.Blue($"[D4BattlenetOperation] Asia Click D4 tab: automation_id={ctrl.AutomationId}");
                return T.ClickControl(ctrl);
            }
            var byName = T.FindByName(controls, C.D4TabNameKeywordsAsia);
            if (byName != null && !BattlenetRegionJudge.ContainsAny(byName.Name, C.GameTabExcludedNameSubstrings))
            {
                ColorPrinter.Blue($"[D4BattlenetOperation] Asia Click D4 tab: name={byName.Name}");
                return T.ClickControl(byName);
            }
        }
        ColorPrinter.Yellow("[D4BattlenetOperation] D4 tab control not found (Asia)");
        return false;
    }

    /// <summary>Asia: Play by automation id only. 1:1 Python D4BattlenetOperation.is_game_starting (region asia).</summary>
    public override bool IsD4Starting()
    {
        var controls = T.Enumerate();
        foreach (var aid in C.StartGameAutomationIdsAsia)
        {
            var ctrl = T.FindByAutomationId(controls, aid);
            if (ctrl != null)
                return PlayButtonIndicatesStarting(ctrl);
        }
        return false;
    }
}
