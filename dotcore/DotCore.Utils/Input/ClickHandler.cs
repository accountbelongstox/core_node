// PY-REF: pyapps/d3-check/d3utils/click_handler_singleton.py
// PY-REF: pyapps/d3-check/d3utils/state_aware_click_handler.py
// PY-REF: pyapps/d3-check/utils/_obsolete_click_handler.py
using System.Runtime.InteropServices;
using DotCore.Foundations;

namespace DotCore.Utils.Input;

/// <summary>Mouse button for ClickHandler. 1:1 Python button 'left' / 'right'.</summary>
public enum MouseButton
{
    Left,
    Right
}

/// <summary>Curve shape for ClickHandler.MoveMouseCurve. 1:1 Python curve_type 'bezier' / 'arc' / 'sine'.</summary>
public enum MouseCurveType
{
    Bezier,
    Arc,
    Sine
}

/// <summary>
/// SendInput-based humanized mouse and keyboard (singleton). 1:1 Python pycore/pyctl/desktop/click_handler.py
/// (generic part: move/click/game-coord click/post-message click), pycore/pyutils/input/mouse_movement.py and
/// pyapps/d3-check/d3utils/click_handler_singleton.py. pyautogui moveTo tween, PAUSE (0.1 s after each primitive)
/// and the top-left fail-safe skip are reproduced. Fixes Python bug: StateAwareClickHandler called double_click/drag
/// which ClickHandler did not implement; both are implemented here.
/// </summary>
public sealed class ClickHandler
{
    private const string LogTag = "[ClickHandler]";
    private const int FailSafeCorner = 5;
    private const double DefaultPauseSec = 0.1;
    private const double TweenMinimumDurationSec = 0.1;
    private const double TweenMinimumSleepSec = 0.05;
    private const double DirectClickPauseSec = 0.05;
    private const double MovedClickPauseSec = 0.1;
    private const double PostMessageClickDelaySec = 0.1;
    private const int CurveStepPixels = 50;
    private const int CurveMinSteps = 10;
    private const double CurveBaseDurationSec = 0.1;
    private const double CurveDistancePerSec = 3000;
    private const double CurveMaxDurationSec = 0.2;
    private const double CurveOffsetRatio = 0.2;
    private const int WM_LBUTTONDOWN = 0x0201;
    private const int WM_LBUTTONUP = 0x0202;
    private const int MK_LBUTTON = 0x0001;

    private static readonly Lazy<ClickHandler> LazyInstance = new(() => new ClickHandler());

    private readonly Random _random = new();

    private ClickHandler()
    {
    }

    /// <summary>Global instance. 1:1 Python get_click_handler().</summary>
    public static ClickHandler Instance => LazyInstance.Value;

    /// <summary>Seconds slept after each primitive (pyautogui.PAUSE, default 0.1).</summary>
    public double Pause { get; set; } = DefaultPauseSec;

    /// <summary>Current cursor position (screen). 1:1 Python get_mouse_position.</summary>
    public (int X, int Y) GetMousePosition()
    {
        return InputNative.TryGetCursorPos(out int x, out int y) ? (x, y) : (0, 0);
    }

    /// <summary>Record cursor before an operation. 1:1 Python save_mouse_position.</summary>
    public (int X, int Y)? SaveMousePosition()
    {
        return InputNative.TryGetCursorPos(out int x, out int y) ? (x, y) : null;
    }

    /// <summary>Instant move back to a recorded position. 1:1 Python restore_mouse_position.</summary>
    public bool RestoreMousePosition((int X, int Y)? position)
    {
        if (position == null) return false;
        if (MoveTo(position.Value.X, position.Value.Y, 0)) return true;
        ColorPrinter.Red($"[MouseMovement] Error restoring mouse position to {position.Value}");
        return false;
    }

    /// <summary>Move cursor to (x, y) over duration seconds (0 = instant). 1:1 Python move_mouse_to.</summary>
    public bool MoveMouseTo(int x, int y, double duration = 0.0)
    {
        if (IsFailSafeCorner(x, y))
        {
            ColorPrinter.Gray($"{LogTag} Skip moveTo ({x},{y}) to avoid PyAutoGUI fail-safe");
            return false;
        }
        if (MoveTo(x, y, duration)) return true;
        ColorPrinter.Red($"Error moving mouse to ({x}, {y})");
        return false;
    }

    /// <summary>Move with visible trajectory. 1:1 Python move_mouse_visible.</summary>
    public bool MoveMouseVisible(int x, int y, double duration = 0.5)
    {
        if (IsFailSafeCorner(x, y))
        {
            ColorPrinter.Gray($"{LogTag} Skip move_mouse_visible ({x},{y}) to avoid PyAutoGUI fail-safe");
            return false;
        }
        if (MoveTo(x, y, duration)) return true;
        ColorPrinter.Red($"Error moving mouse to ({x}, {y})");
        return false;
    }

    /// <summary>Human-like curved move (bezier/arc/sine); duration auto 100-200 ms when null. 1:1 Python move_mouse_curve.</summary>
    public bool MoveMouseCurve(int targetX, int targetY, double? duration = null, MouseCurveType curveType = MouseCurveType.Bezier)
    {
        if (IsFailSafeCorner(targetX, targetY))
        {
            ColorPrinter.Gray($"{LogTag} Skip move_mouse_curve to ({targetX},{targetY}) to avoid PyAutoGUI fail-safe");
            return false;
        }
        var (startX, startY) = GetMousePosition();
        double distance = Math.Sqrt(Math.Pow(targetX - startX, 2) + Math.Pow(targetY - startY, 2));
        int steps = Math.Max((int)(distance / CurveStepPixels), CurveMinSteps);
        double totalSec = duration ?? Math.Min(CurveBaseDurationSec + distance / CurveDistancePerSec, CurveMaxDurationSec);
        var points = BuildCurvePoints(startX, startY, targetX, targetY, distance, steps, curveType);

        var started = DateTime.UtcNow;
        bool ok = true;
        double timePerStep = totalSec / points.Count;
        for (int i = 0; i < points.Count; i++)
        {
            ok &= InputNative.MoveCursor(points[i].X, points[i].Y);
            if (i < points.Count - 1)
            {
                double sleepSec = (i + 1) * timePerStep - (DateTime.UtcNow - started).TotalSeconds;
                if (sleepSec > 0) SleepSec(sleepSec);
            }
        }
        ok &= MoveTo(targetX, targetY, 0);
        if (!ok)
        {
            ColorPrinter.Red($"{LogTag} Error moving mouse with curve to ({targetX}, {targetY})");
            return false;
        }
        double actualMs = (DateTime.UtcNow - started).TotalMilliseconds;
        ColorPrinter.Gray($"{LogTag} Moved mouse with {curveType.ToString().ToLowerInvariant()} curve from ({startX},{startY}) to ({targetX},{targetY}) in {actualMs:F0}ms");
        return true;
    }

    /// <summary>Instant move with log (no true virtual move on Windows). 1:1 Python move_mouse_virtual.</summary>
    public bool MoveMouseVirtual(int x, int y)
    {
        var current = GetMousePosition();
        if (!MoveTo(x, y, 0))
        {
            ColorPrinter.Red($"{LogTag} Error in virtual mouse move to ({x}, {y})");
            return false;
        }
        ColorPrinter.Gray($"{LogTag} Virtual move from ({current.X}, {current.Y}) to ({x},{y})");
        return true;
    }

    /// <summary>Straight-line move (visible tween or instant). 1:1 Python move_mouse_straight.</summary>
    public bool MoveMouseStraight(int targetX, int targetY, double duration = 0.2, bool visible = true)
    {
        if (!MoveTo(targetX, targetY, visible ? duration : 0))
        {
            ColorPrinter.Red($"{LogTag} Error moving mouse straight to ({targetX}, {targetY})");
            return false;
        }
        ColorPrinter.Gray(visible
            ? $"{LogTag} Straight move to ({targetX},{targetY}) in {duration}s"
            : $"{LogTag} Instant move to ({targetX},{targetY})");
        return true;
    }

    /// <summary>
    /// Move then click at screen (x, y); restores the cursor afterwards (also on failure) when returnToOriginal.
    /// directClick moves instantly; pauseAfterMove defaults to 0.05 s (direct) or 0.1 s. 1:1 Python click.
    /// </summary>
    public bool Click(
        int x,
        int y,
        MouseButton button = MouseButton.Left,
        double duration = 0.3,
        bool returnToOriginal = true,
        bool directClick = false,
        double? pauseAfterMove = null)
    {
        if (IsFailSafeCorner(x, y))
        {
            ColorPrinter.Gray($"{LogTag} Skip click at ({x},{y}) to avoid PyAutoGUI fail-safe");
            return false;
        }
        double moveDuration = directClick ? 0.0 : duration;
        double pause = pauseAfterMove ?? (directClick ? DirectClickPauseSec : MovedClickPauseSec);
        var original = returnToOriginal ? SaveMousePosition() : null;
        try
        {
            bool ok = MoveTo(x, y, moveDuration);
            if (pause > 0) SleepSec(pause);
            ok = ok && ClickAt(x, y, button, 1);
            if (!ok)
                ColorPrinter.Red($"{LogTag} click failed (x={x}, y={y}, button={ButtonName(button)}): SendInput rejected");
            return ok;
        }
        finally
        {
            if (returnToOriginal && original != null)
                RestoreMousePosition(original);
        }
    }

    /// <summary>Left click. 1:1 Python left_click.</summary>
    public bool LeftClick(int x, int y, double duration = 0.3, bool returnToOriginal = true, bool directClick = false, double? pauseAfterMove = null)
        => Click(x, y, MouseButton.Left, duration, returnToOriginal, directClick, pauseAfterMove);

    /// <summary>Right click. 1:1 Python right_click.</summary>
    public bool RightClick(int x, int y, double duration = 0.3, bool returnToOriginal = true, bool directClick = false, double? pauseAfterMove = null)
        => Click(x, y, MouseButton.Right, duration, returnToOriginal, directClick, pauseAfterMove);

    /// <summary>Click at client-relative game coords using windowOffset (client origin on screen). 1:1 Python click_at_game_coord.</summary>
    public bool ClickAtGameCoord(
        int gameX,
        int gameY,
        (int X, int Y) windowOffset,
        bool returnToOriginal = true,
        bool directClick = true,
        MouseButton button = MouseButton.Left,
        double duration = 0.3,
        double? pauseAfterMove = null)
    {
        return Click(windowOffset.X + gameX, windowOffset.Y + gameY, button, duration, returnToOriginal, directClick, pauseAfterMove);
    }

    /// <summary>Move then double left click; restores the cursor when returnToOriginal (pyautogui doubleClick).</summary>
    public bool DoubleClick(int x, int y, double duration = 0.3, bool returnToOriginal = true)
    {
        if (IsFailSafeCorner(x, y))
        {
            ColorPrinter.Gray($"{LogTag} Skip double click at ({x},{y}) to avoid PyAutoGUI fail-safe");
            return false;
        }
        var original = returnToOriginal ? SaveMousePosition() : null;
        try
        {
            bool ok = MoveTo(x, y, duration) && ClickAt(x, y, MouseButton.Left, 2);
            if (!ok)
                ColorPrinter.Red($"{LogTag} double click failed (x={x}, y={y})");
            return ok;
        }
        finally
        {
            if (returnToOriginal && original != null)
                RestoreMousePosition(original);
        }
    }

    /// <summary>Press at start, tween to end over duration, release (pyautogui moveTo + dragTo).</summary>
    public bool Drag(int startX, int startY, int endX, int endY, double duration = 0.5, MouseButton button = MouseButton.Left)
    {
        if (IsFailSafeCorner(startX, startY) || IsFailSafeCorner(endX, endY))
        {
            ColorPrinter.Gray($"{LogTag} Skip drag ({startX},{startY})->({endX},{endY}) to avoid PyAutoGUI fail-safe");
            return false;
        }
        bool ok = MoveTo(startX, startY, 0) && InputNative.SendMouseButton(button, down: true);
        try
        {
            ok = ok && Tween(endX, endY, duration);
        }
        finally
        {
            ok &= InputNative.SendMouseButton(button, down: false);
            ApplyPause();
        }
        if (!ok)
            ColorPrinter.Red($"{LogTag} drag failed ({startX},{startY})->({endX},{endY})");
        return ok;
    }

    /// <summary>Background click via WM_LBUTTONDOWN/UP at client (x, y). 1:1 Python click_element_by_post_message.</summary>
    public bool ClickElementByPostMessage(IntPtr windowHandle, int x, int y)
    {
        var lparam = (IntPtr)((y << 16) | (x & 0xFFFF));
        bool downOk = WindowInputNative.PostMessage(windowHandle, WM_LBUTTONDOWN, (IntPtr)MK_LBUTTON, lparam);
        SleepSec(PostMessageClickDelaySec);
        bool upOk = WindowInputNative.PostMessage(windowHandle, WM_LBUTTONUP, IntPtr.Zero, lparam);
        if (!(downOk && upOk))
        {
            ColorPrinter.Red($"{LogTag} PostMessage click failed (hwnd={windowHandle}, x={x}, y={y})");
            return false;
        }
        ColorPrinter.Green($"{LogTag} Posted click message to hwnd {windowHandle} at ({x}, {y})");
        return true;
    }

    /// <summary>Key down by pyautogui key name (e.g. "ctrl", "a", "f7", "enter").</summary>
    public bool KeyDown(string key)
    {
        bool ok = TryResolveKey(key, out ushort vk) && InputNative.SendKey(vk, down: true);
        ApplyPause();
        return ok;
    }

    /// <summary>Key up by pyautogui key name.</summary>
    public bool KeyUp(string key)
    {
        bool ok = TryResolveKey(key, out ushort vk) && InputNative.SendKey(vk, down: false);
        ApplyPause();
        return ok;
    }

    /// <summary>Mouse button down at the current cursor, no pause (held until MouseButtonUp).</summary>
    public static bool MouseButtonDown(MouseButton button) => InputNative.SendMouseButton(button, down: true);

    /// <summary>Mouse button up at the current cursor, no pause.</summary>
    public static bool MouseButtonUp(MouseButton button) => InputNative.SendMouseButton(button, down: false);

    /// <summary>Current cursor position in screen coordinates.</summary>
    public static bool TryGetCursorPos(out int x, out int y) => InputNative.TryGetCursorPos(out x, out y);

    /// <summary>Move the cursor to screen (x, y) immediately, no pause.</summary>
    public static bool MoveCursor(int x, int y) => InputNative.MoveCursor(x, y);

    /// <summary>Virtual-key down or up, no pause.</summary>
    public static bool SendVirtualKey(ushort vk, bool down) => InputNative.SendKey(vk, down);

    /// <summary>Press and release a key presses times (pyautogui.press).</summary>
    public bool PressKey(string key, int presses = 1, double intervalSec = 0.0)
    {
        if (!TryResolveKey(key, out ushort vk))
        {
            ColorPrinter.Yellow($"{LogTag} Unknown key '{key}'");
            return false;
        }
        bool ok = PressVirtualKeyNoPause(vk, presses, intervalSec);
        ApplyPause();
        return ok;
    }

    /// <summary>Press and release a virtual-key code (pyautogui.press by VK).</summary>
    public bool PressVirtualKey(ushort vk, int presses = 1, double intervalSec = 0.0)
    {
        bool ok = PressVirtualKeyNoPause(vk, presses, intervalSec);
        ApplyPause();
        return ok;
    }

    /// <summary>Hold keys in order, release in reverse (pyautogui.hotkey, e.g. "ctrl", "v").</summary>
    public bool Hotkey(params string[] keys)
    {
        var vks = new List<ushort>();
        foreach (var key in keys)
        {
            if (!TryResolveKey(key, out ushort vk))
            {
                ColorPrinter.Yellow($"{LogTag} Unknown key '{key}'");
                return false;
            }
            vks.Add(vk);
        }
        bool ok = true;
        foreach (var vk in vks)
            ok &= InputNative.SendKey(vk, down: true);
        for (int i = vks.Count - 1; i >= 0; i--)
            ok &= InputNative.SendKey(vks[i], down: false);
        ApplyPause();
        return ok;
    }

    /// <summary>Type text as Unicode key events with a random delay in [intervalMinSec, intervalMaxSec] after each char (pyautogui.write).</summary>
    public bool TypeText(string text, double intervalMinSec = 0.0, double intervalMaxSec = 0.0)
    {
        if (string.IsNullOrEmpty(text)) return true;
        bool ok = true;
        foreach (char c in text)
        {
            ok &= c switch
            {
                '\n' => InputNative.TapKey(InputNative.VK_RETURN),
                '\r' => true,
                '\t' => InputNative.TapKey(InputNative.VK_TAB),
                _ => InputNative.TapUnicode(c)
            };
            double delay = intervalMaxSec > intervalMinSec
                ? intervalMinSec + _random.NextDouble() * (intervalMaxSec - intervalMinSec)
                : intervalMinSec;
            if (delay > 0) SleepSec(delay);
        }
        ApplyPause();
        return ok;
    }

    /// <summary>Resolve a pyautogui key name or single character to a virtual-key code.</summary>
    public static bool TryResolveKey(string key, out ushort vk)
    {
        vk = 0;
        if (string.IsNullOrEmpty(key)) return false;
        if (InputNative.NamedKeys.TryGetValue(key.ToLowerInvariant(), out vk)) return true;
        if (key.Length != 1) return false;
        char c = key[0];
        if (c is >= 'a' and <= 'z') { vk = (ushort)char.ToUpperInvariant(c); return true; }
        if (c is >= 'A' and <= 'Z' or >= '0' and <= '9') { vk = c; return true; }
        short scan = InputNative.VkKeyScanChar(c);
        if (scan == -1) return false;
        vk = (ushort)(scan & 0xFF);
        return true;
    }

    private bool PressVirtualKeyNoPause(ushort vk, int presses, double intervalSec)
    {
        bool ok = true;
        for (int i = 0; i < Math.Max(1, presses); i++)
        {
            ok &= InputNative.TapKey(vk);
            if (intervalSec > 0) SleepSec(intervalSec);
        }
        return ok;
    }

    private List<(int X, int Y)> BuildCurvePoints(int startX, int startY, int targetX, int targetY, double distance, int steps, MouseCurveType curveType)
    {
        var points = new List<(int X, int Y)>(steps + 1);
        switch (curveType)
        {
            case MouseCurveType.Bezier:
            {
                int offsetRange = (int)(distance * CurveOffsetRatio);
                double controlX = (startX + targetX) / 2.0 + _random.Next(-offsetRange, offsetRange + 1);
                double controlY = (startY + targetY) / 2.0 + _random.Next(-offsetRange, offsetRange + 1);
                for (int i = 0; i <= steps; i++)
                {
                    double t = (double)i / steps;
                    double x = Math.Pow(1 - t, 2) * startX + 2 * (1 - t) * t * controlX + t * t * targetX;
                    double y = Math.Pow(1 - t, 2) * startY + 2 * (1 - t) * t * controlY + t * t * targetY;
                    points.Add(((int)x, (int)y));
                }
                break;
            }
            case MouseCurveType.Arc:
            {
                double arcHeight = distance * CurveOffsetRatio * (_random.Next(2) == 0 ? -1 : 1);
                for (int i = 0; i <= steps; i++)
                {
                    double t = (double)i / steps;
                    double x = startX + (targetX - startX) * t;
                    double y = startY + (targetY - startY) * t + 4 * arcHeight * t * (1 - t);
                    points.Add(((int)x, (int)y));
                }
                break;
            }
            case MouseCurveType.Sine:
            {
                double frequency = 1 + _random.NextDouble() * 2;
                int amplitude = _random.Next(5, 21);
                for (int i = 0; i <= steps; i++)
                {
                    double t = (double)i / steps;
                    double x = startX + (targetX - startX) * t;
                    double y = startY + (targetY - startY) * t + amplitude * Math.Sin(frequency * Math.PI * t);
                    points.Add(((int)x, (int)y));
                }
                break;
            }
        }
        return points;
    }

    private bool MoveTo(int x, int y, double duration)
    {
        bool ok = Tween(x, y, duration);
        ApplyPause();
        return ok;
    }

    private static bool Tween(int x, int y, double duration)
    {
        if (duration <= TweenMinimumDurationSec)
            return InputNative.MoveCursor(x, y);
        var (startX, startY) = InputNative.TryGetCursorPos(out int sx, out int sy) ? (sx, sy) : (x, y);
        int numSteps = Math.Max(Math.Abs(x - startX), Math.Abs(y - startY));
        if (numSteps == 0)
            return InputNative.MoveCursor(x, y);
        double sleepSec = duration / numSteps;
        if (sleepSec < TweenMinimumSleepSec)
        {
            numSteps = Math.Max(1, (int)(duration / TweenMinimumSleepSec));
            sleepSec = duration / numSteps;
        }
        bool ok = true;
        for (int n = 0; n < numSteps; n++)
        {
            double t = (double)n / numSteps;
            SleepSec(sleepSec);
            ok &= InputNative.MoveCursor((int)Math.Round(startX + (x - startX) * t), (int)Math.Round(startY + (y - startY) * t));
        }
        SleepSec(sleepSec);
        return InputNative.MoveCursor(x, y) && ok;
    }

    private bool ClickAt(int x, int y, MouseButton button, int clicks)
    {
        bool ok = InputNative.MoveCursor(x, y);
        for (int i = 0; i < clicks; i++)
        {
            ok &= InputNative.SendMouseButton(button, down: true);
            ok &= InputNative.SendMouseButton(button, down: false);
        }
        ApplyPause();
        return ok;
    }

    private void ApplyPause()
    {
        if (Pause > 0) SleepSec(Pause);
    }

    private static bool IsFailSafeCorner(int x, int y) => x <= FailSafeCorner && y <= FailSafeCorner;

    private static string ButtonName(MouseButton button) => button == MouseButton.Right ? "right" : "left";

    private static void SleepSec(double seconds) => Thread.Sleep(TimeSpan.FromSeconds(seconds));
}

/// <summary>SendInput / cursor P/Invoke for ClickHandler. No-ops returning false on non-Windows.</summary>
internal static class InputNative
{
    private const string User32 = "user32.dll";
    private const uint INPUT_MOUSE = 0;
    private const uint INPUT_KEYBOARD = 1;
    private const uint MOUSEEVENTF_MOVE = 0x0001;
    private const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
    private const uint MOUSEEVENTF_LEFTUP = 0x0004;
    private const uint MOUSEEVENTF_RIGHTDOWN = 0x0008;
    private const uint MOUSEEVENTF_RIGHTUP = 0x0010;
    private const uint MOUSEEVENTF_VIRTUALDESK = 0x4000;
    private const uint MOUSEEVENTF_ABSOLUTE = 0x8000;
    private const uint KEYEVENTF_EXTENDEDKEY = 0x0001;
    private const uint KEYEVENTF_KEYUP = 0x0002;
    private const uint KEYEVENTF_UNICODE = 0x0004;
    private const uint MAPVK_VK_TO_VSC = 0;
    private const int SM_XVIRTUALSCREEN = 76;
    private const int SM_YVIRTUALSCREEN = 77;
    private const int SM_CXVIRTUALSCREEN = 78;
    private const int SM_CYVIRTUALSCREEN = 79;

    public const ushort VK_RETURN = 0x0D;
    public const ushort VK_TAB = 0x09;

    private static readonly HashSet<ushort> ExtendedKeys = new()
    {
        0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x5B, 0x5C, 0x6F, 0x90
    };

    public static readonly IReadOnlyDictionary<string, ushort> NamedKeys = BuildNamedKeys();

    public static bool TryGetCursorPos(out int x, out int y)
    {
        x = 0; y = 0;
        return OperatingSystem.IsWindows() && WindowInputNative.GetCursorPos(out x, out y);
    }

    /// <summary>Absolute SendInput move on the virtual desktop; corrects rounding with SetCursorPos.</summary>
    public static bool MoveCursor(int x, int y)
    {
        if (!OperatingSystem.IsWindows()) return false;
        int vx = GetSystemMetrics(SM_XVIRTUALSCREEN), vy = GetSystemMetrics(SM_YVIRTUALSCREEN);
        int vw = Math.Max(2, GetSystemMetrics(SM_CXVIRTUALSCREEN)), vh = Math.Max(2, GetSystemMetrics(SM_CYVIRTUALSCREEN));
        var input = new INPUT
        {
            type = INPUT_MOUSE,
            U = new InputUnion
            {
                mi = new MOUSEINPUT
                {
                    dx = (int)Math.Round((x - vx) * 65535.0 / (vw - 1)),
                    dy = (int)Math.Round((y - vy) * 65535.0 / (vh - 1)),
                    dwFlags = MOUSEEVENTF_MOVE | MOUSEEVENTF_ABSOLUTE | MOUSEEVENTF_VIRTUALDESK
                }
            }
        };
        if (!Send(input)) return SetCursorPos(x, y);
        if (TryGetCursorPos(out int cx, out int cy) && (cx != x || cy != y))
            return SetCursorPos(x, y);
        return true;
    }

    public static bool SendMouseButton(MouseButton button, bool down)
    {
        if (!OperatingSystem.IsWindows()) return false;
        uint flags = button == MouseButton.Right
            ? (down ? MOUSEEVENTF_RIGHTDOWN : MOUSEEVENTF_RIGHTUP)
            : (down ? MOUSEEVENTF_LEFTDOWN : MOUSEEVENTF_LEFTUP);
        return Send(new INPUT { type = INPUT_MOUSE, U = new InputUnion { mi = new MOUSEINPUT { dwFlags = flags } } });
    }

    public static bool SendKey(ushort vk, bool down)
    {
        if (!OperatingSystem.IsWindows()) return false;
        uint flags = down ? 0 : KEYEVENTF_KEYUP;
        if (ExtendedKeys.Contains(vk)) flags |= KEYEVENTF_EXTENDEDKEY;
        var ki = new KEYBDINPUT { wVk = vk, wScan = (ushort)MapVirtualKey(vk, MAPVK_VK_TO_VSC), dwFlags = flags };
        return Send(new INPUT { type = INPUT_KEYBOARD, U = new InputUnion { ki = ki } });
    }

    public static bool TapKey(ushort vk) => SendKey(vk, down: true) & SendKey(vk, down: false);

    public static bool TapUnicode(char c)
    {
        if (!OperatingSystem.IsWindows()) return false;
        var down = new INPUT { type = INPUT_KEYBOARD, U = new InputUnion { ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE } } };
        var up = new INPUT { type = INPUT_KEYBOARD, U = new InputUnion { ki = new KEYBDINPUT { wScan = c, dwFlags = KEYEVENTF_UNICODE | KEYEVENTF_KEYUP } } };
        return Send(down) & Send(up);
    }

    public static short VkKeyScanChar(char c) => OperatingSystem.IsWindows() ? VkKeyScanW(c) : (short)-1;

    private static bool Send(INPUT input)
    {
        return SendInput(1, new[] { input }, Marshal.SizeOf<INPUT>()) == 1;
    }

    private static Dictionary<string, ushort> BuildNamedKeys()
    {
        var map = new Dictionary<string, ushort>(StringComparer.Ordinal)
        {
            ["enter"] = 0x0D, ["return"] = 0x0D, ["\n"] = 0x0D, ["tab"] = 0x09, ["\t"] = 0x09,
            ["esc"] = 0x1B, ["escape"] = 0x1B, ["space"] = 0x20, [" "] = 0x20,
            ["backspace"] = 0x08, ["delete"] = 0x2E, ["del"] = 0x2E, ["insert"] = 0x2D,
            ["home"] = 0x24, ["end"] = 0x23, ["pageup"] = 0x21, ["pgup"] = 0x21, ["pagedown"] = 0x22, ["pgdn"] = 0x22,
            ["left"] = 0x25, ["up"] = 0x26, ["right"] = 0x27, ["down"] = 0x28,
            ["shift"] = 0x10, ["shiftleft"] = 0xA0, ["shiftright"] = 0xA1,
            ["ctrl"] = 0x11, ["control"] = 0x11, ["ctrlleft"] = 0xA2, ["ctrlright"] = 0xA3,
            ["alt"] = 0x12, ["altleft"] = 0xA4, ["altright"] = 0xA5,
            ["win"] = 0x5B, ["winleft"] = 0x5B, ["winright"] = 0x5C,
            ["capslock"] = 0x14, ["numlock"] = 0x90, ["scrolllock"] = 0x91,
            ["printscreen"] = 0x2C, ["prtsc"] = 0x2C, ["pause"] = 0x13, ["apps"] = 0x5D
        };
        for (int i = 1; i <= 24; i++)
            map["f" + i] = (ushort)(0x70 + i - 1);
        return map;
    }

    [DllImport(User32, SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [DllImport(User32)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetCursorPos(int x, int y);

    [DllImport(User32)]
    private static extern int GetSystemMetrics(int nIndex);

    [DllImport(User32)]
    private static extern uint MapVirtualKey(uint uCode, uint uMapType);

    [DllImport(User32, CharSet = CharSet.Unicode)]
    private static extern short VkKeyScanW(char ch);

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public MOUSEINPUT mi;
        [FieldOffset(0)] public KEYBDINPUT ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MOUSEINPUT
    {
        public int dx;
        public int dy;
        public uint mouseData;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct KEYBDINPUT
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public IntPtr dwExtraInfo;
    }
}
