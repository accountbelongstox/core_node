using DotCore.Foundations;
using DotCore.Utils.Input;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;
using T = DotApps.d3d4tester.Core.Battlenet.BattlenetControlTree;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>
/// Asia Battle.net login steps: email step (Continue), password step (Log in), combined form, fill-whatever-present + submit.
/// Field fill: UIA ValuePattern first, keyboard fallback (focus, replace, type 0.05-0.15 s per char, clipboard for unicode).
/// 1:1 Python d3utils/battlenet_asia_ops.py.
/// </summary>
public sealed class BattlenetAsiaOps
{
    private const string LogTag = "[BattlenetAsiaOps]";
    private const int LogSampleCount = 50;
    private const int LogSampleShown = 20;

    private static readonly FieldInputOptions FieldOptions = new()
    {
        ClearMode = FieldClearMode.Replace,
        IntervalMinSec = C.AsiaFieldInputIntervalMinSec,
        IntervalMaxSec = C.AsiaFieldInputIntervalMaxSec,
        AfterFocusDelaySec = C.AsiaFieldAfterFocusSec,
        UseClipboardForUnicode = true
    };

    private readonly BattlenetOperationBase _op;

    public BattlenetAsiaOps(BattlenetOperationBase op)
    {
        _op = op;
    }

    public bool IsOnAsiaEmailStep(IReadOnlyList<BattlenetControl>? controls = null) => Judge(controls).IsAsiaEmailStep();

    public bool IsOnAsiaPasswordStep(IReadOnlyList<BattlenetControl>? controls = null) => Judge(controls).IsAsiaPasswordStep();

    public bool IsOnAsiaLoginScreen(IReadOnlyList<BattlenetControl>? controls = null) => Judge(controls).IsAsiaLoginUi();

    public bool IsOnAsiaCombinedLoginUi(IReadOnlyList<BattlenetControl>? controls = null) => Judge(controls).IsAsiaCombinedLoginUi();

    /// <summary>Fill email then click Continue (submit). 1:1 Python perform_asia_email_step.</summary>
    public bool PerformAsiaEmailStep(string email)
    {
        _op.ActivateWindow();
        Thread.Sleep(C.ActivateSettleMs);
        var controls = T.Enumerate();
        if (!IsOnAsiaEmailStep(controls))
        {
            ColorPrinter.Yellow($"{LogTag} Not on Asia email step, skip");
            return false;
        }
        var account = FindAccountControl(controls);
        if (account != null)
        {
            FillField(account, email, isPassword: false);
            SleepSec(C.AsiaAfterFieldFillSec);
        }
        var submit = FindSubmitButton(controls);
        if (submit == null)
        {
            ColorPrinter.Yellow($"{LogTag} Continue button (submit) not found");
            return false;
        }
        ColorPrinter.Blue($"{LogTag} Click Continue (submit)");
        return T.ClickControl(submit);
    }

    /// <summary>Fill password (if given, re-enumerate once after 0.5 s) then click submit (Log in). 1:1 Python perform_asia_password_step.</summary>
    public bool PerformAsiaPasswordStep(string? password)
    {
        _op.ActivateWindow();
        Thread.Sleep(C.ActivateSettleMs);
        var controls = T.Enumerate();
        if (!IsOnAsiaPasswordStep(controls))
        {
            ColorPrinter.Yellow($"{LogTag} Not on Asia password step, skip");
            return false;
        }
        if (!string.IsNullOrEmpty(password))
        {
            var passwordCtrl = FindPasswordControl(controls);
            if (passwordCtrl == null)
            {
                SleepSec(C.AsiaPasswordReenumerateDelaySec);
                controls = T.Enumerate();
                passwordCtrl = FindPasswordControl(controls);
            }
            if (passwordCtrl != null)
            {
                FillField(passwordCtrl, password, isPassword: true);
                SleepSec(C.AsiaAfterFieldFillSec);
            }
        }
        var submit = T.FindByAnyAutomationId(controls, C.AsiaLoginSubmitAutomationIds);
        if (submit == null)
        {
            ColorPrinter.Yellow($"{LogTag} Submit (automation_id=submit) not found");
            return false;
        }
        ColorPrinter.Blue($"{LogTag} Click submit (Log in)");
        return T.ClickControl(submit);
    }

    /// <summary>Account and password on one screen: fill both then submit. 1:1 Python perform_asia_combined_login.</summary>
    public bool PerformAsiaCombinedLogin(string email, string? password)
    {
        _op.ActivateWindow();
        Thread.Sleep(C.ActivateSettleMs);
        var controls = T.Enumerate();
        if (!IsOnAsiaCombinedLoginUi(controls))
        {
            ColorPrinter.Yellow($"{LogTag} Not on Asia combined login UI, skip");
            return false;
        }
        var account = FindAccountControl(controls);
        if (account != null)
        {
            FillField(account, email, isPassword: false);
            SleepSec(C.AsiaAfterFieldFillSec);
        }
        var passwordCtrl = FindPasswordControl(controls);
        if (passwordCtrl != null && !string.IsNullOrEmpty(password))
        {
            FillField(passwordCtrl, password, isPassword: true);
            SleepSec(C.AsiaAfterFieldFillSec);
        }
        var submit = FindSubmitButton(controls) ?? T.FindByName(controls, C.AsiaLoginSubmitKeywordsFallback);
        if (submit == null)
        {
            ColorPrinter.Yellow($"{LogTag} Submit button not found (combined)");
            return false;
        }
        ColorPrinter.Blue($"{LogTag} Click submit (combined login)");
        return T.ClickControl(submit);
    }

    /// <summary>
    /// Fill whatever fields are present, then submit. Log in button with missing password field or missing password: skip submit
    /// (no empty login). Submit must be clickable. 1:1 Python perform_asia_login_fill_and_submit.
    /// </summary>
    public bool PerformAsiaLoginFillAndSubmit(string? email, string? password)
    {
        _op.ActivateWindow();
        Thread.Sleep(C.ActivateSettleMs);
        var controls = T.Enumerate();
        if (!Judge(controls).HasAsiaLoginMarkers())
        {
            ColorPrinter.Yellow($"{LogTag} Not Asia login UI (no markers), skip fill_and_submit");
            return false;
        }
        var account = T.FindByAnyAutomationId(controls, C.AsiaLoginAccountAutomationIds);
        var passwordCtrl = FindPasswordControl(controls);
        if (passwordCtrl == null)
        {
            SleepSec(C.AsiaPasswordReenumerateDelaySec);
            controls = T.Enumerate();
            passwordCtrl = FindPasswordControl(controls);
        }
        var submit = T.FindByAnyAutomationId(controls, C.AsiaLoginSubmitAutomationIds);
        LogFoundElements(account, passwordCtrl, submit);
        if (submit == null)
        {
            LogControlIdsWhenMissing(controls, "submit");
            ColorPrinter.Yellow($"{LogTag} No submit (automation_id=submit) button, skip");
            return false;
        }
        if (passwordCtrl == null && !string.IsNullOrEmpty(password))
        {
            LogControlIdsWhenMissing(controls, "password");
            ColorPrinter.Gray($"{LogTag} Password field not in control tree; enumerate count={controls.Count}");
        }
        bool isLogIn = BattlenetRegionJudge.ContainsAny(submit.Name, C.AsiaLoginSubmitKeywordsFallback);
        if (account != null && !string.IsNullOrEmpty(email))
        {
            FillField(account, email, isPassword: false);
            SleepSec(C.AsiaAfterFieldFillSec);
        }
        if (passwordCtrl != null && !string.IsNullOrEmpty(password))
        {
            FillField(passwordCtrl, password, isPassword: true);
            SleepSec(C.AsiaAfterFieldFillSec);
        }
        else if (isLogIn && !string.IsNullOrEmpty(password))
        {
            ColorPrinter.Yellow($"{LogTag} Password step but password field not found, skip submit (avoid empty login)");
            return false;
        }
        else if (isLogIn)
        {
            ColorPrinter.Yellow($"{LogTag} Password step but no password in credentials, skip submit");
            return false;
        }
        if (!submit.IsClickable)
        {
            var clickable = T.GetClickableButtons(controls).Take(10).Select(c => Truncate(c.Name.Length > 0 ? c.Name : c.AutomationId.Length > 0 ? c.AutomationId : "?", 16));
            ColorPrinter.Gray($"{LogTag} Submit not clickable (enabled={submit.IsEnabled}, offscreen={submit.IsOffscreen}); clickable buttons: [{string.Join(", ", clickable)}]");
            return false;
        }
        ColorPrinter.Blue($"{LogTag} Click submit (automation_id={(submit.AutomationId.Length > 0 ? submit.AutomationId : "submit")} name={(submit.Name.Length > 0 ? submit.Name : "?")})");
        return T.ClickControl(submit, requireClickable: true);
    }

    private static BattlenetRegionJudge Judge(IReadOnlyList<BattlenetControl>? controls) => new(controls ?? T.Enumerate());

    /// <summary>ValuePattern first, then keyboard. 1:1 Python _fill_field.</summary>
    private static bool FillField(BattlenetControl control, string text, bool isPassword)
    {
        if (string.IsNullOrEmpty(text)) return true;
        if (C.AsiaLoginDebugInput)
        {
            if (isPassword)
                ColorPrinter.Gray($"{LogTag} input field=password masked= *** len={text.Length}");
            else
            {
                string preview = text.Length > 4 ? text[..2] + "***" + text[^2..] : "***";
                ColorPrinter.Gray($"{LogTag} input field=account len={text.Length} preview= {preview}");
            }
        }
        bool ok = FieldInput.FillFieldWithFallback(
            text,
            t => T.SetControlValue(control, t),
            () => T.FocusControl(control),
            focusXy: null,
            preferSetValue: true,
            options: FieldOptions);
        if (ok)
            ColorPrinter.Blue($"{LogTag} Field filled ({text.Length} chars)");
        else
            ColorPrinter.Gray($"{LogTag} Field fill failed (ValuePattern and keyboard)");
        return ok;
    }

    private static BattlenetControl? FindSubmitButton(IReadOnlyList<BattlenetControl> controls)
        => T.FindByAnyAutomationId(controls, C.AsiaLoginSubmitAutomationIds);

    private static BattlenetControl? FindAccountControl(IReadOnlyList<BattlenetControl> controls)
        => T.FindByAnyAutomationId(controls, C.AsiaLoginAccountAutomationIds) ?? T.FindByName(controls, C.AsiaLoginAccountKeywordsFallback);

    /// <summary>Automation id, then name, then EditControl with a password name. 1:1 Python _find_password_control.</summary>
    private static BattlenetControl? FindPasswordControl(IReadOnlyList<BattlenetControl> controls)
    {
        var ctrl = T.FindByAnyAutomationId(controls, C.AsiaLoginPasswordAutomationIds) ?? T.FindByName(controls, C.AsiaLoginPasswordKeywordsFallback);
        if (ctrl != null) return ctrl;
        return controls.FirstOrDefault(c => c.Type.Contains("edit", StringComparison.OrdinalIgnoreCase)
            && BattlenetRegionJudge.ContainsAny(c.Name, C.AsiaLoginPasswordKeywordsFallback));
    }

    private static void LogFoundElements(BattlenetControl? account, BattlenetControl? password, BattlenetControl? submit)
    {
        static string Desc(BattlenetControl? c)
        {
            if (c == null) return "None";
            return $"aid={(c.AutomationId.Length > 0 ? c.AutomationId : "?")} name={(c.Name.Length > 0 ? Truncate(c.Name, 24) : "?")}";
        }
        ColorPrinter.Gray($"{LogTag} found: accountName={Desc(account)} | password={Desc(password)} | submit={Desc(submit)}");
    }

    private static void LogControlIdsWhenMissing(IReadOnlyList<BattlenetControl> controls, string missingKey)
    {
        var ids = new List<string>();
        foreach (var c in controls.Take(LogSampleCount))
        {
            string name = Truncate(c.Name, 16);
            if (c.AutomationId.Length > 0 || name.Length > 0)
                ids.Add((c.AutomationId.Length > 0 ? c.AutomationId : "(no-aid)") + (name.Length > 0 ? $" [{name}]" : ""));
        }
        ColorPrinter.Gray($"{LogTag} {missingKey} not found; sample automation_id+name: [{string.Join(", ", ids.Take(LogSampleShown))}]");
    }

    private static string Truncate(string s, int max) => s.Length <= max ? s : s[..max];

    private static void SleepSec(double sec) => Thread.Sleep((int)(sec * 1000));
}
