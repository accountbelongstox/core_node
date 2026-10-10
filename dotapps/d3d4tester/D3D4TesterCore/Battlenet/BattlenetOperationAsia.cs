// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/battlenet_operation_asia.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d4utils/d4_battlenet_operation.py
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net operations for the Asia region. CN methods return false (Asia login is judged by IsOnAsiaLoginScreen).
/// 1:1 Python d3utils/battlenet_operation_asia.py (+ d4utils/d4_battlenet_operation.py Asia branch).
/// </summary>
public sealed class BattlenetOperationAsia : BattlenetOperationBase
{
    private readonly BattlenetAsiaOps _asiaOps;

    public BattlenetOperationAsia()
    {
        _asiaOps = new BattlenetAsiaOps(this);
    }

    public override string Region => C.RegionAsia;

    protected override string LogRegionLabel => "Asia";

    protected override string NotFoundLogSuffix => " (Asia)";

    /// <summary>Asia-only login UI not covered by the shared account form (combined / switch account / keyword fallback).</summary>
    protected override BattlenetClientState? ClassifyLoginScreen(IReadOnlyList<BattlenetControl> controls) =>
        new BattlenetRegionJudge(controls).IsAsiaLoginUi() ? BattlenetClientState.LoginAsia : null;

    public BattlenetAsiaOps AsiaOps => _asiaOps;

    public override bool ClickD3Tab() => ClickD3TabBy(C.D3TabAutomationIdsAsia, C.D3TabNameKeywordsFallbackAsia);

    public override bool ClickStartGame() => ClickPlayBy(C.StartGameAutomationIdsAsia, C.StartGameNameKeywordsFallbackAsia);

    public override bool ClickD4Tab() => ClickD4TabBy(C.D4TabAutomationIdsAsia, skipExcludedOnAid: true, C.D4TabNameKeywordsAsia);

    public override bool IsOnAsiaLoginScreen() => new BattlenetRegionJudge(T.EnumerateLight()).IsAsiaLoginUi();

    public override bool PerformAsiaLoginFillAndSubmit(string? email, string? password) => _asiaOps.PerformAsiaLoginFillAndSubmit(email, password);

    public override bool PerformCnLoginFlow(double waitAfterNetEaseSec = C.CnAfterNetEaseClickSettleSec) => false;
}
