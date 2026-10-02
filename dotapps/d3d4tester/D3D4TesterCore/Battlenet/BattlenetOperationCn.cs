// PY-REF: pyapps/d3-check/d3utils/battlenet_operation_cn.py
// PY-REF: pyapps/d3-check/d4utils/d4_battlenet_operation.py
using DotCore.Foundations;
using DotCore.UIInspect;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Battle.net operations for the CN region (agree + NetEase login, CN login button). Asia methods return false.
/// 1:1 Python d3utils/battlenet_operation_cn.py (+ d4utils/d4_battlenet_operation.py CN branch).
/// </summary>
public sealed class BattlenetOperationCn : BattlenetOperationBase
{
    private const string CheckBoxControlType = "CheckBoxControl";

    public override string Region => C.RegionCn;

    /// <summary>CN web login popup (NetEase account / password in progress), then the NetEase agreement login page.</summary>
    protected override BattlenetClientState? ClassifyLoginScreen(IReadOnlyList<BattlenetControl> controls)
    {
        if (T.FindByAutomationId(controls, C.LoginPopupWindowAutomationId) != null) return BattlenetClientState.LoginCnWeb;
        if (new BattlenetRegionJudge(controls).IsCnLoginUi()) return BattlenetClientState.LoginCn;
        return null;
    }

    /// <summary>Exact automation id, then name (abort on Playing Now / Game Version). 1:1 Python click_d3_tab.</summary>
    public override bool ClickD3Tab()
    {
        var controls = T.Enumerate();
        foreach (var aid in C.D3TabAutomationIdsCn)
        {
            var ctrl = T.FindByAutomationId(controls, aid, exactMatch: true);
            if (ctrl != null)
            {
                ColorPrinter.Blue($"[BattlenetOperation] CN Click D3 tab: automation_id={aid}");
                return T.ClickControl(ctrl);
            }
        }
        var byName = T.FindByName(controls, C.D3TabNameKeywordsFallbackCn);
        if (byName == null)
        {
            ColorPrinter.Yellow("[BattlenetOperation] D3 tab control not found");
            return false;
        }
        if (BattlenetRegionJudge.ContainsAny(byName.Name, C.GameTabExcludedNameSubstrings))
            return false;
        ColorPrinter.Blue($"[BattlenetOperation] CN Click D3 tab: name={byName.Name}");
        return T.ClickControl(byName);
    }

    /// <summary>1:1 Python click_start_game.</summary>
    public override bool ClickStartGame()
    {
        var controls = T.Enumerate();
        foreach (var aid in C.StartGameAutomationIdsCn)
        {
            var ctrl = T.FindByAutomationId(controls, aid);
            if (ctrl != null)
            {
                ColorPrinter.Blue($"[BattlenetOperation] CN Click start game: automation_id={aid}");
                return T.ClickControl(ctrl);
            }
        }
        var byName = T.FindByName(controls, C.StartGameNameKeywordsFallbackCn);
        if (byName == null)
        {
            ColorPrinter.Yellow("[BattlenetOperation] Start game button not found");
            return false;
        }
        ColorPrinter.Blue($"[BattlenetOperation] CN Click start game: name={byName.Name}");
        return T.ClickControl(byName);
    }

    public override bool ClickPlayButtonIfVisible(bool forceRefresh = true)
        => ClickPlayIfVisible(C.StartGameAutomationIdsCn, C.StartGameNameKeywordsFallbackCn, forceRefresh);

    /// <summary>1:1 Python is_game_starting.</summary>
    public override bool IsGameStarting()
    {
        var ctrl = FindPlay(T.EnumerateLight(), C.StartGameAutomationIdsCn, C.StartGameNameKeywordsFallbackCn);
        return ctrl != null && PlayButtonIndicatesStarting(ctrl);
    }

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

    /// <summary>Login button by automation id, then name (登陆/登录/Login). 1:1 Python click_cn_login_button.</summary>
    public override bool ClickCnLoginButton()
    {
        var controls = T.Enumerate();
        foreach (var aid in C.CnLoginButtonAutomationIds)
        {
            var ctrl = T.FindByAutomationId(controls, aid);
            if (ctrl != null)
            {
                ColorPrinter.Blue($"[BattlenetOperation] Click Login button: automation_id={aid}");
                return T.ClickControl(ctrl);
            }
        }
        var byName = T.FindByName(controls, C.CnLoginButtonKeywords);
        if (byName == null)
        {
            ColorPrinter.Yellow("[BattlenetOperation] Login button (UI) not found");
            return false;
        }
        ColorPrinter.Blue($"[BattlenetOperation] Click Login button: name={byName.Name}");
        return T.ClickControl(byName);
    }

    /// <summary>legalAcceptance or ntes present. 1:1 Python is_login_screen_ready.</summary>
    public override bool IsLoginScreenReady()
    {
        var controls = T.EnumerateLight();
        if (controls.Count == 0) return false;
        return T.FindByAutomationId(controls, C.CnAgreeAutomationId) != null || T.FindByAutomationId(controls, C.CnNetEaseAutomationId) != null;
    }

    public override BattlenetDynamicState GetDynamicState()
        => ComputeDynamicState(C.LoginWindowAutomationIdMarkersCn, C.LoginScreenKeywordsFallbackCn,
            C.D3TabAutomationIdsCn, C.D3TabNameKeywordsFallbackCn, C.StartGameAutomationIdsCn, C.StartGameNameKeywordsFallbackCn);

    public override bool IsOnLoginScreen() => new BattlenetRegionJudge(T.EnumerateLight()).IsCnLoginUi();

    public override bool IsLoggedIn() => new BattlenetRegionJudge(T.EnumerateLight()).HasCnMainUi();

    public override bool IsOnAsiaLoginScreen() => false;

    public override bool PerformAsiaEmailStep(string email) => false;

    public override bool PerformAsiaPasswordStep(string? password = null) => false;

    public override bool PerformAsiaLoginFillAndSubmit(string? email, string? password) => false;

    /// <summary>CN D4 tab: exact automation id, then name (abort on Playing Now / Game Version). 1:1 Python D4BattlenetOperation.click_d4_tab (CN).</summary>
    public override bool ClickD4Tab()
    {
        var controls = T.Enumerate();
        var ctrl = FindGameTabByAutomationId(controls, C.D4TabAutomationIdsCn, skipExcludedOnAid: false);
        if (ctrl != null)
        {
            ColorPrinter.Blue($"[D4BattlenetOperation] CN Click D4 tab: automation_id={ctrl.AutomationId}");
            return T.ClickControl(ctrl);
        }
        var byName = T.FindByName(controls, C.D4TabNameKeywordsCn);
        if (byName == null)
        {
            ColorPrinter.Yellow("[D4BattlenetOperation] D4 tab control not found");
            return false;
        }
        if (BattlenetRegionJudge.ContainsAny(byName.Name, C.GameTabExcludedNameSubstrings))
            return false;
        ColorPrinter.Blue($"[D4BattlenetOperation] CN Click D4 tab: name={byName.Name}");
        return T.ClickControl(byName);
    }

    /// <summary>1:1 Python D4BattlenetOperation.is_game_starting (CN).</summary>
    public override bool IsD4Starting()
    {
        var ctrl = FindPlay(T.Enumerate(), C.StartGameAutomationIdsCn, C.StartGameNameKeywordsFallbackCn);
        return ctrl != null && PlayButtonIndicatesStarting(ctrl);
    }

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
