// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/battlenet_operation_cn.py
// PY-REF: dotapps/d3d4tester/reference/py_d3check/d4utils/d4_battlenet_operation.py
using DotCore.Foundations;
using DotCore.UIInspect;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net operations for the CN region (agree + NetEase login). Asia methods return false.
/// 1:1 Python d3utils/battlenet_operation_cn.py (+ d4utils/d4_battlenet_operation.py CN branch).
/// </summary>
public sealed class BattlenetOperationCn : BattlenetOperationBase
{
    private const string CheckBoxControlType = "CheckBoxControl";

    public override string Region => C.RegionCn;

    protected override string LogRegionLabel => "CN";

    protected override string NotFoundLogSuffix => "";

    /// <summary>CN web login popup (NetEase account / password in progress), then the NetEase agreement login page.</summary>
    protected override BattlenetClientState? ClassifyLoginScreen(IReadOnlyList<BattlenetControl> controls)
    {
        if (T.FindByAutomationId(controls, C.LoginPopupWindowAutomationId) != null) return BattlenetClientState.LoginCnWeb;
        if (new BattlenetRegionJudge(controls).IsCnLoginUi()) return BattlenetClientState.LoginCn;
        return null;
    }

    public override bool ClickD3Tab() => ClickD3TabBy(C.D3TabAutomationIdsCn, C.D3TabNameKeywordsFallbackCn);

    public override bool ClickStartGame() => ClickPlayBy(C.StartGameAutomationIdsCn, C.StartGameNameKeywordsFallbackCn);

    public override bool ClickD4Tab() => ClickD4TabBy(C.D4TabAutomationIdsCn, skipExcludedOnAid: false, C.D4TabNameKeywordsCn);

    /// <summary>Activate, ensure agree checked, click NetEase, settle. 1:1 Python perform_cn_login_flow.</summary>
    public override bool PerformCnLoginFlow(double waitAfterNetEaseSec = C.CnAfterNetEaseClickSettleSec)
    {
        ActivateWindow();
        Thread.Sleep(C.ActivateSettleMs);
        if (!EnsureAgreeCheckboxChecked())
            return false;
        Thread.Sleep(C.ActivateSettleMs);
        if (!ClickNetEaseLoginButton())
            return false;
        ColorPrinter.Blue("[BattlenetOperation] Web agreement: polled each 2s tick, 30s timeout (BN_Login2)");
        if (waitAfterNetEaseSec > 0)
            Thread.Sleep((int)(waitAfterNetEaseSec * 1000));
        return true;
    }

    public override bool IsOnAsiaLoginScreen() => false;

    public override bool PerformAsiaLoginFillAndSubmit(string? email, string? password) => false;

    /// <summary>legalAcceptance by id, else CheckBox by name; TogglePattern, else Invoke/mouse when unchecked. 1:1 Python _ensure_agree_checkbox_checked.</summary>
    private static bool EnsureAgreeCheckboxChecked()
    {
        var raw = T.FindRawByAutomationId(C.CnAgreeAutomationId);
        if (raw == null)
        {
            raw = T.FindRawByNameAndType(C.CnAgreeKeywordsFallback, CheckBoxControlType);
            if (raw != null)
                ColorPrinter.Blue("[BattlenetOperation] Agree checkbox found by name (fallback)");
        }
        if (raw == null)
        {
            ColorPrinter.Yellow("[BattlenetOperation] legalAcceptance checkbox not found");
            return false;
        }
        bool? state = UIOperations.GetToggleState(raw);
        if (state != null)
        {
            if (state == false)
            {
                UIOperations.Toggle(raw);
                Thread.Sleep(C.ActivateSettleMs);
            }
            ColorPrinter.Blue("[BattlenetOperation] Agree checkbox ensured checked (TogglePattern)");
            return true;
        }
        ColorPrinter.Gray("[BattlenetOperation] TogglePattern not used: not supported");
        if (!UIOperations.OperateButton(raw, T.ClickRectCenter, preferInvoke: true))
            return false;
        Thread.Sleep(C.ActivateSettleMs);
        return true;
    }

    /// <summary>1:1 Python _click_netease_login_button.</summary>
    private static bool ClickNetEaseLoginButton()
    {
        var controls = T.Enumerate();
        var ctrl = T.FindByAutomationId(controls, C.CnNetEaseAutomationId);
        if (ctrl != null)
        {
            ColorPrinter.Blue($"[BattlenetOperation] Click NetEase login: automation_id={C.CnNetEaseAutomationId}");
            return T.ClickControl(ctrl);
        }
        ctrl = T.FindByName(controls, C.CnNetEaseLoginKeywordsFallback);
        if (ctrl != null)
        {
            ColorPrinter.Blue("[BattlenetOperation] Click NetEase login: by name");
            return T.ClickControl(ctrl);
        }
        ColorPrinter.Yellow("[BattlenetOperation] NetEase login button not found");
        return false;
    }
}
