using System.Diagnostics;
using FlaUI.Core.AutomationElements;
using DotApps.d3check.Core.Battlenet;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Battle.net operations for CN (China) region only. 1:1 with Python d3utils.battlenet_operation_cn.BattlenetOperationCN.
/// </summary>
public sealed class BattlenetOperationCn : IBattlenetOperation
{
    public string Region => "cn";

    public bool Start() => BattlenetManager.Instance.Start();
    public bool Close() => BattlenetManager.Instance.Close();
    public bool ActivateWindow() => BattlenetManager.Instance.ActivateWindow();

    /// <summary>AutomationId first; only when no AutomationId found fall back to keyword (uidocs have AutomationId).</summary>
    public bool IsOnLoginScreen()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null) return false;
        if (UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.LoginWindowAutomationIdMarkersCn))
            return true;
        return UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.LoginScreenKeywordsFallbackCn);
    }

    public bool IsLoggedIn()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null) return false;
        if (UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.LoginWindowAutomationIdMarkersCn))
            return false;
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var d3 = FindD3TabCn(window);
        var play = FindPlayButtonCn(window);
        return d3 != null && play != null;
    }

    public bool PerformCnLoginFlow(double waitAfterNetEaseSec = 0.5)
    {
        ActivateWindow();
        Thread.Sleep(200);
        if (!EnsureAgreeCheckboxChecked())
        {
            ColorPrinter.Yellow("[BattlenetOperation] legalAcceptance checkbox not found or failed");
            return false;
        }
        Thread.Sleep(200);
        if (!ClickNetEaseLoginButton())
        {
            ColorPrinter.Yellow("[BattlenetOperation] NetEase login button not found");
            return false;
        }
        ColorPrinter.Blue("[BattlenetOperation] Web agreement: poll every 2s, 30s timeout (BN_Login2)");
        Thread.Sleep((int)(waitAfterNetEaseSec * 1000));
        return true;
    }

    public bool PerformAsiaLoginFillAndSubmit(string? email, string? password) => false;

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    public bool ClickD3Tab()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        foreach (var aid in BattlenetConstants.D3TabAutomationIdsCn)
        {
            var el = UIOperations.FindFirstByAutomationId(window, aid);
            if (el != null)
            {
                ColorPrinter.Blue("[BattlenetOperation] CN Click D3 tab: automation_id=" + aid);
                return UIOperations.Invoke(el);
            }
        }
        var byName = UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.D3TabNameKeywordsFallbackCn);
        if (byName != null)
        {
            var name = byName.Properties.Name.ValueOrDefault ?? "";
            if (name.Contains("Playing Now", StringComparison.OrdinalIgnoreCase) || name.Contains("Game Version", StringComparison.OrdinalIgnoreCase))
                return false;
            ColorPrinter.Blue("[BattlenetOperation] CN Click D3 tab: fallback name=" + name);
            return UIOperations.Invoke(byName);
        }
        ColorPrinter.Yellow("[BattlenetOperation] D3 tab control not found");
        return false;
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    public bool ClickStartGame()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        foreach (var aid in BattlenetConstants.StartGameAutomationIdsCn)
        {
            var el = UIOperations.FindFirstByAutomationIdContains(window, aid);
            if (el != null)
            {
                ColorPrinter.Blue("[BattlenetOperation] CN Click start game: automation_id=" + aid);
                return UIOperations.Invoke(el);
            }
        }
        var byName = UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.StartGameNameKeywordsFallbackCn);
        if (byName != null)
        {
            ColorPrinter.Blue("[BattlenetOperation] CN Click start game: fallback name=" + (byName.Properties.Name.ValueOrDefault ?? ""));
            return UIOperations.Invoke(byName);
        }
        ColorPrinter.Yellow("[BattlenetOperation] Start game button not found");
        return false;
    }

    /// <summary>Login button in BN client. No AutomationId in uidocs; use only if AutomationId added later.</summary>
    public bool ClickCnLoginButton()
    {
        return false;
    }

    /// <summary>1:1 Python try_close_popup: dismiss in-UI popup or reconnect banner.</summary>
    public bool TryClosePopup() => BattlenetPopupDismiss.TryDismissPopupOrReconnect();

    /// <summary>1:1 Python is_login_failed_screen: primary and secondary keywords present; exclude browser-wait.</summary>
    public bool IsLoginFailedScreen()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null) return false;
        if (IsOnBrowserLoginWaitScreen()) return false;
        bool hasPrimary = UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.LoginFailedPrimaryKeywords);
        bool hasSecondary = UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.LoginFailedSecondaryKeywords);
        return hasPrimary && hasSecondary;
    }

    /// <summary>1:1 Python is_on_browser_login_wait_screen.</summary>
    public bool IsOnBrowserLoginWaitScreen()
    {
        var process = BattlenetManager.Instance.GetProcess();
        return process != null && UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.BrowserLoginWaitMainKeywords);
    }

    /// <summary>1:1 Python is_login_screen_ready (CN): agree or NetEase control present.</summary>
    public bool IsLoginScreenReady()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var agree = UIOperations.FindFirstByAutomationId(window, BattlenetConstants.CnAgreeAutomationId);
        if (agree != null) return true;
        var ntes = UIOperations.FindFirstByAutomationId(window, BattlenetConstants.CnNetEaseAutomationId);
        return ntes != null;
    }

    /// <summary>1:1 Python click_play_button_if_visible: find Play and Invoke.</summary>
    public bool ClickPlayButtonIfVisible(bool forceRefresh = true)
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var play = FindPlayButtonCn(window);
        if (play == null) return false;
        ColorPrinter.Gray("[BattlenetOperation] Play button visible, click");
        return UIOperations.Invoke(play);
    }

    /// <summary>AutomationId first; fall back to keyword (CheckBox name) only when not found.</summary>
    private bool EnsureAgreeCheckboxChecked()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var raw = UIOperations.FindFirstByAutomationId(window, BattlenetConstants.CnAgreeAutomationId);
        if (raw == null)
            raw = UIOperations.FindFirst(window, e =>
            {
                var ctype = (e.ControlType.ToString() ?? "").ToLowerInvariant();
                if (!ctype.Contains("checkbox", StringComparison.Ordinal)) return false;
                var name = e.Properties.Name.ValueOrDefault ?? "";
                foreach (var kw in BattlenetConstants.CnAgreeKeywordsFallback)
                    if (!string.IsNullOrEmpty(kw) && name.Contains(kw, StringComparison.OrdinalIgnoreCase))
                        return true;
                return false;
            });
        if (raw == null) return false;
        try
        {
            if (raw.Patterns.Toggle.IsSupported)
            {
                var state = UIOperations.GetToggleState(raw);
                if (state == false)
                {
                    UIOperations.Toggle(raw);
                    Thread.Sleep(200);
                }
                ColorPrinter.Blue("[BattlenetOperation] Agree checkbox ensured checked (AutomationId=" + BattlenetConstants.CnAgreeAutomationId + ")");
                return true;
            }
        }
        catch (Exception ex)
        {
            ColorPrinter.Gray("[BattlenetOperation] TogglePattern not used: " + ex.Message);
        }
        return UIOperations.Invoke(raw);
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    private bool ClickNetEaseLoginButton()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var el = UIOperations.FindFirstByAutomationId(window, BattlenetConstants.CnNetEaseAutomationId);
        if (el == null)
        {
            el = UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.CnNetEaseLoginKeywordsFallback);
            if (el == null) return false;
            ColorPrinter.Blue("[BattlenetOperation] Click NetEase login: fallback by name");
        }
        else
            ColorPrinter.Blue("[BattlenetOperation] Click NetEase login: automation_id=" + BattlenetConstants.CnNetEaseAutomationId);
        return UIOperations.Invoke(el);
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    private static AutomationElement? FindD3TabCn(AutomationElement window)
    {
        foreach (var aid in BattlenetConstants.D3TabAutomationIdsCn)
        {
            var el = UIOperations.FindFirstByAutomationId(window, aid);
            if (el != null) return el;
        }
        return UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.D3TabNameKeywordsFallbackCn);
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    private static AutomationElement? FindPlayButtonCn(AutomationElement window)
    {
        foreach (var aid in BattlenetConstants.StartGameAutomationIdsCn)
        {
            var el = UIOperations.FindFirstByAutomationIdContains(window, aid);
            if (el != null) return el;
        }
        return UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.StartGameNameKeywordsFallbackCn);
    }

    /// <summary>1:1 Python _get_dynamic_state_cn: walk BN window tree, return (on_login, disconnected, normal_available, play_name, connecting, region).</summary>
    public BattlenetDynamicState GetDynamicState()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null)
            return new BattlenetDynamicState(false, false, false, null, false, null);
        var window = BattlenetUiHelper.GetWindow();
        if (window == null)
            return new BattlenetDynamicState(false, false, false, null, false, null);
        bool loginCn = UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.LoginWindowAutomationIdMarkersCn)
            || UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.LoginScreenKeywordsFallbackCn);
        bool disconnect = UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.DisconnectKeywords);
        bool connecting = UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.ConnectingKeywords);
        var d3Tab = FindD3TabCn(window);
        var play = FindPlayButtonCn(window);
        bool d3Cn = d3Tab != null;
        bool playCn = play != null;
        string? playName = play?.Properties.Name.ValueOrDefault;
        if (d3Cn && playCn && !loginCn)
        {
            if (connecting)
                return new BattlenetDynamicState(false, false, false, null, true, "cn");
            return new BattlenetDynamicState(false, false, true, playName ?? "Play", false, "cn");
        }
        if (disconnect)
            return new BattlenetDynamicState(false, true, false, null, false, "cn");
        if (loginCn)
            return new BattlenetDynamicState(true, false, false, null, false, "cn");
        return new BattlenetDynamicState(false, false, false, null, false, null);
    }
}
