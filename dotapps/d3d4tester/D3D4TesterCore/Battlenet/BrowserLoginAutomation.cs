// PY-REF: pyapps/d3-check/d3utils/browser_login_ocr_flow.py
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.UIInspect;
using DotCore.Utils.Input;
using FlaUI.Core.AutomationElements;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Web login step (B11) by UI Automation instead of OCR clicks and the Tampermonkey callback. Targets the Battle.net login window
/// account form (Phoenix::LoginWindow), the CN login popup (Phoenix::LoginPopupWindow) and external browser login windows.
/// One poll: security check / verification code page -> NeedUser (never clicked; the code only reaches the user); success text
/// -> Success; login form -> type the saved credentials, tick "Keep me logged in", submit; EULA -> tick; Agree / Login -> invoke.
/// The confirm page sometimes turns into the login form, so the form is checked first.
/// </summary>
public static class BrowserLoginAutomation
{
    public enum PollResult { Success, Acted, NeedCredentials, NeedUser, Waiting, NoWindow }

    private const string LogTag = "[BrowserLogin]";
    private const string EditType = "Edit";
    private const string ButtonType = "Button";
    private const string CheckBoxType = "CheckBox";
    private const string HyperlinkType = "Hyperlink";
    private const int AfterActionMs = 500;

    private static readonly FieldInputOptions FieldOptions = new()
    {
        ClearMode = FieldClearMode.Replace,
        IntervalMinSec = C.AsiaFieldInputIntervalMinSec,
        IntervalMaxSec = C.AsiaFieldInputIntervalMaxSec,
        AfterFocusDelaySec = C.AsiaFieldAfterFocusSec,
    };

    /// <summary>One poll over every login window (Battle.net CN popup first, then browsers).</summary>
    public static PollResult RunOnePoll()
    {
        var targets = FindTargets();
        if (targets.Count == 0)
        {
            ColorPrinter.Gray($"{LogTag} no login popup / browser login window, wait");
            return PollResult.NoWindow;
        }
        var result = PollResult.Waiting;
        foreach (var (hwnd, region) in targets)
        {
            UIOperations.RunWithWindowRoot(hwnd, root =>
            {
                if (root != null) result = Step(hwnd, root, region);
                return true;
            });
            if (result is PollResult.Success or PollResult.Acted or PollResult.NeedCredentials or PollResult.NeedUser) break;
        }
        return result;
    }

    private static List<(IntPtr Hwnd, string Region)> FindTargets()
    {
        var targets = new List<(IntPtr, string)>();
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        string accountRegion = snapshot.BattlenetUiRegion ?? BattlenetManager.Instance.GetConfiguredRegion() ?? snapshot.BattlenetRegion ?? C.RegionAsia;
        foreach (var w in BattlenetManager.Instance.FindWindows())
        {
            if (w.ClassName == C.CnBrowserConfirmWindowClassName || w.ClassName == C.LoginWindowClassName)
                targets.Add((w.Hwnd, accountRegion));
        }
        string browserRegion = accountRegion;
        foreach (var w in BrowserWindowFinder.FindBrowserLoginWindows(C.CnBrowserLoginWindowTitleKeywords))
            targets.Add((w.Hwnd, browserRegion));
        return targets;
    }

    private static PollResult Step(IntPtr hwnd, AutomationElement root, string region)
    {
        if (UIOperations.FindFirstByNameContainsAny(root, C.SecurityCheckKeywords) != null
            || UIOperations.FindFirstByNameContainsAny(root, C.VerificationCodeKeywords) != null)
        {
            ColorPrinter.Yellow($"{LogTag} security check / verification code page: waiting for the user");
            return PollResult.NeedUser;
        }
        if (UIOperations.FindFirstByNameContainsAny(root, C.BrowserLoginSuccessKeywords) != null)
        {
            ColorPrinter.Green($"{LogTag} success text found, login done");
            return PollResult.Success;
        }

        var password = UIOperations.FindFirst(root, IsPasswordEdit);
        if (password != null)
            return FillLoginForm(hwnd, root, password, region);

        var eula = UIOperations.FindFirst(root, el => IsType(el, CheckBoxType) && ContainsAny(el, C.BrowserLoginEulaKeywords));
        if (eula != null && UIOperations.GetToggleState(eula) == false)
        {
            bool ticked = UIOperations.Toggle(eula) || ClickFallback(hwnd, eula);
            ColorPrinter.Blue($"{LogTag} EULA checkbox ticked={ticked}");
            Thread.Sleep(AfterActionMs);
            return PollResult.Acted;
        }

        var agree = UIOperations.FindFirst(root, el => IsClickable(el) && ContainsAny(el, C.BrowserLoginAgreeKeywords) && !ContainsAny(el, C.BrowserLoginRejectKeywords));
        if (agree != null)
            return Invoke(hwnd, agree, "agree");

        var login = UIOperations.FindFirst(root, el => IsType(el, ButtonType) && ContainsAny(el, C.BrowserLoginSubmitKeywords) && !ContainsAny(el, C.BrowserLoginRejectKeywords));
        if (login != null)
            return Invoke(hwnd, login, "login");

        ColorPrinter.Gray($"{LogTag} page loaded but no form / agree / login control yet, wait");
        return PollResult.Waiting;
    }

    private static PollResult FillLoginForm(IntPtr hwnd, AutomationElement root, AutomationElement password, string region)
    {
        var creds = BattlenetFlowHooks.GetLoginCredentials?.Invoke(region);
        if (creds is not { } c || string.IsNullOrEmpty(c.Account) || string.IsNullOrEmpty(c.Password))
        {
            ColorPrinter.Yellow($"{LogTag} login form shown but no saved {region} credentials; open the credentials dialog");
            BattlenetFlowHooks.ScheduleLoginCredentialsDialog?.Invoke(region);
            return PollResult.NeedCredentials;
        }
        var account = UIOperations.FindFirst(root, el => IsType(el, EditType) && !IsPasswordEdit(el));
        if (account != null && !Fill(hwnd, account, c.Account)) return PollResult.Waiting;
        if (!Fill(hwnd, password, c.Password)) return PollResult.Waiting;
        var persist = UIOperations.FindFirstByAutomationId(root, C.PersistLoginAutomationId);
        if (persist != null && UIOperations.GetToggleState(persist) == false) UIOperations.Toggle(persist);
        var submit = UIOperations.FindFirst(root, el => IsType(el, ButtonType) && ContainsAny(el, C.BrowserLoginSubmitKeywords) && !ContainsAny(el, C.BrowserLoginRejectKeywords));
        ColorPrinter.Blue($"{LogTag} login form filled ({region}), submit found={submit != null}");
        return submit != null ? Invoke(hwnd, submit, "submit") : PollResult.Acted;
    }

    /// <summary>
    /// Web inputs (React in the login web view) ignore a UIA ValuePattern write — the form keeps the field empty — so focus the
    /// field and type real keystrokes first; ValuePattern only as a fallback when typing fails.
    /// </summary>
    private static bool Fill(IntPtr hwnd, AutomationElement edit, string text) =>
        FieldInput.FillFieldWithFallback(
            text,
            t => UIOperations.SetValue(edit, t),
            () =>
            {
                ScreenCaptureService.ActivateWindow(hwnd);
                return UIOperations.SetFocus(edit) || UIOperations.ClickAtControlRect(edit);
            },
            focusXy: null,
            preferSetValue: false,
            options: FieldOptions);

    private static PollResult Invoke(IntPtr hwnd, AutomationElement element, string what)
    {
        bool ok = UIOperations.Invoke(element) || ClickFallback(hwnd, element);
        ColorPrinter.Blue($"{LogTag} {what} '{element.Properties.Name.ValueOrDefault}' clicked={ok}");
        Thread.Sleep(AfterActionMs);
        return PollResult.Acted;
    }

    private static bool ClickFallback(IntPtr hwnd, AutomationElement element)
    {
        ScreenCaptureService.ActivateWindow(hwnd);
        return UIOperations.ClickAtControlRect(element);
    }

    private static bool IsPasswordEdit(AutomationElement el) =>
        IsType(el, EditType) && (el.Properties.IsPassword.ValueOrDefault || ContainsAny(el, C.BrowserLoginPasswordKeywords));

    private static bool IsClickable(AutomationElement el) => IsType(el, ButtonType) || IsType(el, HyperlinkType);

    private static bool IsType(AutomationElement el, string typeName) =>
        UIOperations.GetControlTypeName(el).StartsWith(typeName, StringComparison.Ordinal);

    private static bool ContainsAny(AutomationElement el, IReadOnlyList<string> keywords)
    {
        string name = el.Properties.Name.ValueOrDefault ?? "";
        return keywords.Any(k => name.Contains(k, StringComparison.OrdinalIgnoreCase));
    }
}
