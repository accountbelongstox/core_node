// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Globalization;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.Services.Monitor;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// ROSBOT's own keys (F6 pause, F7 start / stop, F9 pause) only work when ROSBOT owns them: RegisterHotKey is exclusive, so another
/// program holding one of them first leaves that ROSBOT key dead. CheckBeforeRosbotStart probes them while no ROSBOT runs and warns
/// with the taken keys. Function-key presses seen by the app's pass-through keyboard hook are logged with physical / injected and the
/// foreground process; an F-key scan code arriving as another virtual key (keyboard F Lock / Fn mapping) is flagged, because ROSBOT then
/// never receives the F key. A physical F6 (ROSBOT's pause key, passed on to ROSBOT untouched) pauses / resumes monitoring with ROSBOT.
/// </summary>
public static class RosbotHotkeyCheck
{
    private const string LogTag = "[RosbotKeys]";
    private const uint VkF1 = 0x70;
    private const uint VkF12 = 0x7B;
    private const uint ScanF1 = 0x3B;
    private const uint ScanF10 = 0x44;
    private const uint ScanF11 = 0x57;
    private const uint ScanF12 = 0x58;

    private static readonly (ushort Vk, string Name)[] RosbotKeys =
    {
        (RosbotConstants.VkF6, "F6"), (RosbotConstants.VkF7, "F7"), (RosbotConstants.VkF9, "F9"),
    };

    public static void Install(WindowsGlobalHotkeyService hotkeys) => hotkeys.FunctionKeyObserver = OnFunctionKey;

    /// <summary>Probe ROSBOT's keys while ROSBOT is not running; false (and a warning) when another program holds one.</summary>
    public static bool CheckBeforeRosbotStart()
    {
        if (RosbotManager.Instance.FindRosbotProcesses().Count > 0) return true;
        var taken = RosbotKeys.Where(k => GlobalHotkeyProbe.IsTaken(k.Vk)).Select(k => k.Name).ToList();
        if (taken.Count == 0)
        {
            ColorPrinter.Gray($"{LogTag} ROSBOT keys F6 / F7 / F9 are free");
            return true;
        }
        MonitorLog.Warn($"{LogTag} {string.Join(", ", taken)} already held by another program: ROSBOT cannot register them, pressing them will not reach ROSBOT");
        return false;
    }

    private static void OnFunctionKey(uint vk, uint scan, bool injected)
    {
        string name = vk >= VkF1 && vk <= VkF12 ? "F" + (vk - VkF1 + 1).ToString(CultureInfo.InvariantCulture) : $"vk 0x{vk:X2}";
        string source = injected ? "injected" : "physical";
        string foreground = ForegroundProcess();
        uint? scanF = scan >= ScanF1 && scan <= ScanF10 ? scan - ScanF1 + 1 : scan == ScanF11 ? 11u : scan == ScanF12 ? 12u : null;
        if (!injected && scanF is { } f && vk != VkF1 + f - 1)
        {
            ColorPrinter.Yellow($"{LogTag} physical F{f} key arrived as {name} (keyboard F Lock / Fn mapping): ROSBOT does not receive F{f}; foreground {foreground}");
            return;
        }
        ColorPrinter.Gray($"{LogTag} {source} {name} (scan 0x{scan:X2}), foreground {foreground}");
        if (!injected && vk == RosbotConstants.VkF6) RosbotTaskProcessor.Instance.OnUserPauseKey();
    }

    private static string ForegroundProcess()
    {
        try
        {
            IntPtr hwnd = WindowInputHelper.GetForegroundWindowHandle();
            return ProcessUtil.GetPidFromHwnd(hwnd) is { } pid ? Process.GetProcessById(pid).ProcessName : "-";
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException)
        {
            return "-";
        }
    }
}
