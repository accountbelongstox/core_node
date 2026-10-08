// PY-REF: pyapps/d3-check/timers/one_shot_tasks.py
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Flow;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// "Test Pause &amp; Resume" button: running -> F7 to the system, wait paused, resume (main profile + Start botting!), wait running;
/// paused -> the same in reverse. Polls every 2 s, 15 s timeout per step. 1:1 Python timers/one_shot_tasks.py do_rosbot_test_pause_resume
/// (Python had no caller; DOT wires it to a RunLog test button).
/// </summary>
public static class RosbotPauseResumeTestService
{
    private const string LogTag = "[RosbotPanel]";
    private const int PollIntervalMs = 2000;
    private const int StepTimeoutMs = 15000;
    private const int AfterSendMs = 1000;
    private static int _running;

    public static void RegisterTestAction() => TestActionRegistry.Register(I18nKeys.RosbotTestPauseResume, RunInBackground);

    public static void RunInBackground()
    {
        if (Interlocked.Exchange(ref _running, 1) == 1) return;
        Task.Run(() =>
        {
            try { Run(); }
            catch (Exception ex) { ColorPrinter.Red($"{LogTag} Test pause/resume: {ex.Message}"); }
            finally { Interlocked.Exchange(ref _running, 0); }
        });
    }

    private static void Run()
    {
        string status = RefreshStatus();
        if (status == RosbotDetection.StatusRunning)
        {
            if (Pause() && WaitFor(RosbotDetection.StatusPaused, "paused OK", "pause timeout"))
                if (Resume()) WaitFor(RosbotDetection.StatusRunning, "resume OK", "resume timeout");
            return;
        }
        if (status == RosbotDetection.StatusPaused)
        {
            if (Resume() && WaitFor(RosbotDetection.StatusRunning, "resumed OK", "resume timeout"))
                if (Pause()) WaitFor(RosbotDetection.StatusPaused, "paused OK", "pause timeout");
            return;
        }
        ColorPrinter.Yellow($"{LogTag} Test pause/resume: ROSBOT not found");
    }

    private static bool Pause()
    {
        ColorPrinter.Blue($"{LogTag} Test: pause (F7 to system)...");
        if (!RosbotManager.SendF7ToSystem())
        {
            ColorPrinter.Red($"{LogTag} Test: F7 send failed");
            return false;
        }
        Thread.Sleep(AfterSendMs);
        return true;
    }

    private static bool Resume()
    {
        ColorPrinter.Blue($"{LogTag} Test: resume (main profile + Start botting!)...");
        if (!RosbotUiAutomation.ResumeRosbotUi(doTab: true, doStartBotting: true))
        {
            ColorPrinter.Red($"{LogTag} Test: resume (UI) failed");
            return false;
        }
        Thread.Sleep(AfterSendMs);
        return true;
    }

    private static bool WaitFor(string target, string okText, string timeoutText)
    {
        var deadline = DateTime.UtcNow.AddMilliseconds(StepTimeoutMs);
        while (DateTime.UtcNow < deadline)
        {
            Thread.Sleep(PollIntervalMs);
            if (RefreshStatus() == target)
            {
                ColorPrinter.Green($"{LogTag} Test: {okText}");
                return true;
            }
        }
        ColorPrinter.Yellow($"{LogTag} Test: {timeoutText}");
        return false;
    }

    private static string RefreshStatus()
    {
        RosbotStatusProvider.Refresh();
        return GameInterfaceData.Instance.GetStateSnapshot().RosbotExtendedStatus;
    }
}
