using FlaUI.Core.AutomationElements;
using DotCore.Foundations;
using DotCore.UIInspect;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// Battle.net operations for Asia region only. 1:1 with Python d3utils.battlenet_operation_asia.BattlenetOperationAsia.
/// </summary>
public sealed class BattlenetOperationAsia : IBattlenetOperation
{
    public string Region => "asia";

    public bool Start() => BattlenetManager.Instance.Start();
    public bool Close() => BattlenetManager.Instance.Close();
    public bool ActivateWindow() => BattlenetManager.Instance.ActivateWindow();

    /// <summary>AutomationId first; only when no AutomationId found fall back to keyword.</summary>
    public bool IsOnLoginScreen()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null) return false;
        if (UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.LoginWindowAutomationIdMarkersAsia))
            return true;
        return UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.LoginScreenKeywordsFallbackAsia);
    }

    public bool IsLoggedIn()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null) return false;
        if (UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.LoginWindowAutomationIdMarkersAsia))
            return false;
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var d3 = FindD3TabAsia(window);
        var play = FindPlayButtonAsia(window);
        return d3 != null && play != null;
    }

    public bool PerformCnLoginFlow(double waitAfterNetEaseSec = 0.5) => false;

    public bool PerformAsiaLoginFillAndSubmit(string? email, string? password)
    {
        ColorPrinter.Gray($"[DEBUG][BattlenetOperationAsia] PerformAsiaLoginFillAndSubmit email={(string.IsNullOrEmpty(email) ? "null" : "set")} password={(string.IsNullOrEmpty(password) ? "null" : "set")}");
        ActivateWindow();
        Thread.Sleep(200);
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null || !UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.LoginWindowAutomationIdMarkersAsia))
        {
            ColorPrinter.Yellow("[BattlenetOperation] Not Asia login UI (no markers), skip fill_and_submit");
            return false;
        }
        var accountEl = FindAccountControl(window);
        var passwordEl = FindPasswordControl(window);
        var submitEl = FindSubmitButton(window);
        if (submitEl == null)
        {
            ColorPrinter.Yellow("[BattlenetOperation] No submit button, skip");
            return false;
        }
        if (!string.IsNullOrEmpty(email) && accountEl != null)
        {
            UIOperations.SetValue(accountEl, email);
            Thread.Sleep(150);
        }
        if (!string.IsNullOrEmpty(password) && passwordEl != null)
        {
            UIOperations.SetValue(passwordEl, password);
            Thread.Sleep(150);
        }
        ColorPrinter.Blue("[BattlenetOperation] Click submit (Asia)");
        return UIOperations.Invoke(submitEl);
    }

    /// <summary>AutomationId first; fall back to name (any control), then TabItem/ListItem by name. 1:1 Python click_d3_tab (exact AutomationId, then find_control_by_name excluding Playing Now/Game Version).</summary>
    public bool ClickD3Tab()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        foreach (var aid in BattlenetConstants.D3TabAutomationIdsAsia)
        {
            var el = UIOperations.FindFirstByAutomationId(window, aid);
            if (el != null)
            {
                ColorPrinter.Blue("[BattlenetOperation] Asia Click D3 tab: automation_id=" + aid);
                return UIOperations.Invoke(el);
            }
        }
        var byName = UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.D3TabNameKeywordsFallbackAsia);
        if (byName != null)
        {
            var name = byName.Properties.Name.ValueOrDefault ?? "";
            if (!name.Contains("Playing Now", StringComparison.OrdinalIgnoreCase) && !name.Contains("Game Version", StringComparison.OrdinalIgnoreCase))
            {
                ColorPrinter.Blue("[BattlenetOperation] Asia Click D3 tab: fallback name=" + name);
                return UIOperations.Invoke(byName);
            }
        }
        var byTabItem = UIOperations.FindFirstTabItemByNameContainsAny(window, BattlenetConstants.D3TabNameKeywordsFallbackAsia);
        if (byTabItem != null)
        {
            var name = byTabItem.Properties.Name.ValueOrDefault ?? "";
            if (!name.Contains("Playing Now", StringComparison.OrdinalIgnoreCase) && !name.Contains("Game Version", StringComparison.OrdinalIgnoreCase))
            {
                ColorPrinter.Blue("[BattlenetOperation] Asia Click D3 tab: TabItem name=" + name);
                return UIOperations.SelectSelectionItem(byTabItem) || UIOperations.Invoke(byTabItem);
            }
        }
        ColorPrinter.Yellow("[BattlenetOperation] D3 tab control not found (Asia)");
        return false;
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    public bool ClickStartGame()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        foreach (var aid in BattlenetConstants.StartGameAutomationIdsAsia)
        {
            var el = UIOperations.FindFirstByAutomationIdContains(window, aid);
            if (el != null)
            {
                ColorPrinter.Blue("[BattlenetOperation] Asia Click start game: automation_id=" + aid);
                return UIOperations.Invoke(el);
            }
        }
        var byName = UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.StartGameNameKeywordsFallbackAsia);
        if (byName != null)
        {
            ColorPrinter.Blue("[BattlenetOperation] Asia Click start game: fallback name=" + (byName.Properties.Name.ValueOrDefault ?? ""));
            return UIOperations.Invoke(byName);
        }
        ColorPrinter.Yellow("[BattlenetOperation] Start game button not found (Asia)");
        return false;
    }

    /// <summary>1:1 Python try_close_popup.</summary>
    public bool TryClosePopup() => BattlenetPopupDismiss.TryDismissPopupOrReconnect();

    /// <summary>1:1 Python is_login_failed_screen.</summary>
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

    /// <summary>1:1 Python is_login_screen_ready (Asia): account/password/submit present.</summary>
    public bool IsLoginScreenReady()
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        return FindAccountControl(window) != null || FindPasswordControl(window) != null || FindSubmitButton(window) != null;
    }

    /// <summary>1:1 Python click_play_button_if_visible.</summary>
    public bool ClickPlayButtonIfVisible(bool forceRefresh = true)
    {
        var window = BattlenetUiHelper.GetWindow();
        if (window == null) return false;
        var play = FindPlayButtonAsia(window);
        if (play == null) return false;
        ColorPrinter.Gray("[BattlenetOperation] Play button visible, click (Asia)");
        return UIOperations.Invoke(play);
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    private static AutomationElement? FindAccountControl(AutomationElement window)
    {
        var el = UIOperations.FindFirstByAutomationIdContains(window, BattlenetConstants.AsiaLoginAccountAutomationId);
        if (el != null) return el;
        return UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.AsiaLoginAccountKeywordsFallback);
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    private static AutomationElement? FindPasswordControl(AutomationElement window)
    {
        var el = UIOperations.FindFirstByAutomationIdContains(window, BattlenetConstants.AsiaLoginPasswordAutomationId);
        if (el != null) return el;
        return UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.AsiaLoginPasswordKeywordsFallback);
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    private static AutomationElement? FindSubmitButton(AutomationElement window)
    {
        var el = UIOperations.FindFirstByAutomationIdContains(window, BattlenetConstants.AsiaLoginSubmitAutomationId);
        if (el != null) return el;
        return UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.AsiaLoginSubmitKeywordsFallback);
    }

    /// <summary>AutomationId first; then name (any control); then TabItem/ListItem by name. Exclude Playing Now/Game Version for name matches. 1:1 Python get_dynamic_state_asia D3 tab detection.</summary>
    private static AutomationElement? FindD3TabAsia(AutomationElement window)
    {
        foreach (var aid in BattlenetConstants.D3TabAutomationIdsAsia)
        {
            var el = UIOperations.FindFirstByAutomationId(window, aid);
            if (el != null) return el;
        }
        var byName = UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.D3TabNameKeywordsFallbackAsia);
        if (byName != null)
        {
            var n = byName.Properties.Name.ValueOrDefault ?? "";
            if (!n.Contains("Playing Now", StringComparison.OrdinalIgnoreCase) && !n.Contains("Game Version", StringComparison.OrdinalIgnoreCase))
                return byName;
        }
        var byTab = UIOperations.FindFirstTabItemByNameContainsAny(window, BattlenetConstants.D3TabNameKeywordsFallbackAsia);
        if (byTab != null)
        {
            var n = byTab.Properties.Name.ValueOrDefault ?? "";
            if (!n.Contains("Playing Now", StringComparison.OrdinalIgnoreCase) && !n.Contains("Game Version", StringComparison.OrdinalIgnoreCase))
                return byTab;
        }
        return null;
    }

    /// <summary>AutomationId first; fall back to keyword only when not found.</summary>
    private static AutomationElement? FindPlayButtonAsia(AutomationElement window)
    {
        foreach (var aid in BattlenetConstants.StartGameAutomationIdsAsia)
        {
            var el = UIOperations.FindFirstByAutomationIdContains(window, aid);
            if (el != null) return el;
        }
        return UIOperations.FindFirstByNameContainsAny(window, BattlenetConstants.StartGameNameKeywordsFallbackAsia);
    }

    /// <summary>Asia: same shape as CN get_dynamic_state; region "asia".</summary>
    public BattlenetDynamicState GetDynamicState()
    {
        var process = BattlenetManager.Instance.GetProcess();
        if (process == null)
            return new BattlenetDynamicState(false, false, false, null, false, null);
        var window = BattlenetUiHelper.GetWindow();
        if (window == null)
            return new BattlenetDynamicState(false, false, false, null, false, null);
        bool loginAsia = UIOperations.ContainsAnyAutomationIdInTree(process, BattlenetConstants.LoginWindowAutomationIdMarkersAsia)
            || UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.LoginScreenKeywordsFallbackAsia);
        bool disconnect = UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.DisconnectKeywords);
        bool connecting = UIOperations.ContainsAnyKeywordInTree(process, BattlenetConstants.ConnectingKeywords);
        var d3Tab = FindD3TabAsia(window);
        var play = FindPlayButtonAsia(window);
        bool d3Asia = d3Tab != null;
        bool playAsia = play != null;
        string? playName = play?.Properties.Name.ValueOrDefault;
        if (d3Asia && playAsia && !loginAsia)
        {
            if (connecting)
                return new BattlenetDynamicState(false, false, false, null, true, "asia");
            return new BattlenetDynamicState(false, false, true, playName ?? "Play", false, "asia");
        }
        if (disconnect)
            return new BattlenetDynamicState(false, true, false, null, false, "asia");
        if (loginAsia)
            return new BattlenetDynamicState(true, false, false, null, false, "asia");
        return new BattlenetDynamicState(false, false, false, null, false, null);
    }
}
