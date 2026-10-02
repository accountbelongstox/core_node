// PY-REF: pyapps/d3-check/d4utils/d4_operation_base.py
using DotCore.Foundations;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Base of D4 mouse/keyboard operations: one title-bar click to activate a windowed client per run, humanized clicks
/// (standard -> screen, random 100–500 ms, cursor returned), key press, typing 50–100 ms per char, tick wait.
/// 1:1 Python pyapps/d3-check/d4utils/d4_operation_base.py.
/// Fixes Python bug: region helpers read detected_regions['region_coords'] (never set); they take standard regions instead.
/// </summary>
public abstract class D4OperationBase
{
    private const string LogPrefix = "[D4OperationBase]";

    private bool _windowActivated;

    protected D4OperationBase()
    {
        Data = D4InterfaceData.Instance;
        Clicker = ClickHandler.Instance;
    }

    protected D4InterfaceData Data { get; }
    protected ClickHandler Clicker { get; }

    /// <summary>Operation body. Must be implemented by subclasses.</summary>
    public abstract bool Execute();

    /// <summary>Activate the window (windowed only), execute, reset the activation flag. 1:1 run.</summary>
    public bool Run()
    {
        if (!EnsureWindowActive())
            ColorPrinter.Yellow($"{LogPrefix} Window activation failed, attempting operation anyway");
        bool result = Execute();
        _windowActivated = false;
        return result;
    }

    /// <summary>Click the title bar once per run in windowed mode. 1:1 _ensure_window_active.</summary>
    protected bool EnsureWindowActive()
    {
        ColorPrinter.Blue($"{LogPrefix} _ensure_window_active called, _window_activated={_windowActivated}");
        if (_windowActivated)
        {
            ColorPrinter.Blue($"{LogPrefix} Window already activated, skipping");
            return true;
        }
        bool windowed = Data.IsWindowedMode();
        ColorPrinter.Blue($"{LogPrefix} is_windowed_mode={windowed}");
        ColorPrinter.Blue($"{LogPrefix} fullscreen_size={Data.FullscreenSize}, game_window_size={Data.GameWindowSize}");
        if (!windowed)
        {
            ColorPrinter.Blue($"{LogPrefix} Fullscreen mode detected, no activation needed");
            _windowActivated = true;
            return true;
        }
        ColorPrinter.Blue($"{LogPrefix} Windowed mode detected, will click title bar");
        if (!ClickTitleBar())
        {
            ColorPrinter.Yellow($"{LogPrefix} Failed to activate window, continuing anyway");
            return false;
        }
        _windowActivated = true;
        Thread.Sleep(D4Constants.WindowActivationDelayMs);
        ColorPrinter.Blue($"{LogPrefix} Window activated");
        return true;
    }

    /// <summary>Click a random title-bar point. 1:1 _click_title_bar.</summary>
    protected bool ClickTitleBar()
    {
        if (D4CoordinateHelper.GetTitleBarRandomPoint(Data) is not { } p)
        {
            ColorPrinter.Yellow($"{LogPrefix} No window size available for title bar click");
            return false;
        }
        ColorPrinter.Blue($"{LogPrefix} Clicking title bar at screen ({p.X}, {p.Y})");
        Clicker.Click(p.X, p.Y, MouseButton.Left, D3InterfaceConstants.ClickMoveDurationSec, returnToOriginal: true, directClick: true,
            pauseAfterMove: D3InterfaceConstants.ClickPauseAfterMoveSec);
        ColorPrinter.Green($"{LogPrefix} Title bar clicked successfully");
        return true;
    }

    /// <summary>Click a game point (standard or actual coordinates). duration null = random 100–500 ms. 1:1 _click_point.</summary>
    protected bool ClickPoint((int X, int Y) point, MouseButton button = MouseButton.Left, double? duration = null, bool useStandardResolution = true)
    {
        var s = D4CoordinateHelper.CalculateScreenCoordinate(Data, point, useStandardResolution);
        double d = duration ?? D4CoordinateHelper.CalculateRandomDelay();
        ColorPrinter.Gray($"{LogPrefix} Clicking point at screen ({s.X}, {s.Y})");
        return Clicker.Click(s.X, s.Y, button, d, returnToOriginal: true, directClick: true, pauseAfterMove: D3InterfaceConstants.ClickPauseAfterMoveSec);
    }

    /// <summary>Click a random point inside a region. 1:1 _click_region.</summary>
    protected bool ClickRegion((int X, int Y) regionStart, (int X, int Y) regionEnd, MouseButton button = MouseButton.Left,
        double? duration = null, bool useStandardResolution = true, int margin = D4Constants.ClickMarginRegion)
    {
        var s = D4CoordinateHelper.CalculateRandomPointInRegion(Data, regionStart, regionEnd, useStandardResolution, margin);
        double d = duration ?? D4CoordinateHelper.CalculateRandomDelay();
        ColorPrinter.Gray($"{LogPrefix} Clicking region at random screen ({s.X}, {s.Y})");
        return Clicker.Click(s.X, s.Y, button, d, returnToOriginal: true, directClick: true, pauseAfterMove: D3InterfaceConstants.ClickPauseAfterMoveSec);
    }

    /// <summary>Move the cursor. 1:1 _move_to.</summary>
    protected bool MoveTo(int x, int y, double duration = 0.2) => Clicker.MoveMouseTo(x, y, duration);

    /// <summary>Press a key then wait. 1:1 _press_key.</summary>
    protected bool PressKey(string key, double delaySec = D4Constants.PressKeyDefaultDelaySec)
    {
        ColorPrinter.Blue($"{LogPrefix} Pressing key: '{key}'");
        bool ok = Clicker.PressKey(key);
        if (delaySec > 0) Wait(delaySec, silent: true);
        return ok;
    }

    /// <summary>Sleep. 1:1 _wait.</summary>
    protected void Wait(double seconds, bool silent = false)
    {
        if (!silent) ColorPrinter.Gray($"{LogPrefix} Waiting {seconds}s");
        Thread.Sleep(TimeSpan.FromSeconds(seconds));
    }

    /// <summary>Wait one D4 tick. 1:1 _wait_for_next_tick.</summary>
    protected void WaitForNextTick()
    {
        double tick = Data.TickIntervalSec;
        Wait(tick);
        ColorPrinter.Gray($"{LogPrefix} Waited for next tick ({tick}s)");
    }

    /// <summary>Click a random point near a standard region's center, then a random delay. 1:1 click_region_center_random.</summary>
    protected bool ClickRegionCenterRandom(D4StdRegion region, int margin = 5, int delayMinMs = 100, int delayMaxMs = 300)
    {
        int cx = (region.X1 + region.X2) / 2 + D4CoordinateHelper.RandomInclusive(-margin, margin);
        int cy = (region.Y1 + region.Y2) / 2 + D4CoordinateHelper.RandomInclusive(-margin, margin);
        ColorPrinter.Blue($"{LogPrefix} Clicking region '{region.Name}' at ({cx}, {cy})");
        if (!ClickPoint((cx, cy), useStandardResolution: true)) return false;
        Thread.Sleep(TimeSpan.FromSeconds(D4CoordinateHelper.CalculateRandomDelay(delayMinMs, delayMaxMs)));
        ColorPrinter.Green($"{LogPrefix} Region clicked");
        return true;
    }

    /// <summary>Type text char by char with a random delay. 1:1 type_text.</summary>
    protected bool TypeText(string text, int charDelayMinMs = D4Constants.TypeCharDelayMinMs, int charDelayMaxMs = D4Constants.TypeCharDelayMaxMs)
    {
        ColorPrinter.Blue($"{LogPrefix} Typing text: '{text}'");
        bool ok = Clicker.TypeText(text, charDelayMinMs / 1000.0, charDelayMaxMs / 1000.0);
        ColorPrinter.Green($"{LogPrefix} Text typed");
        return ok;
    }

    /// <summary>Type a number. 1:1 type_number.</summary>
    protected bool TypeNumber(int number, int charDelayMinMs = D4Constants.TypeCharDelayMinMs, int charDelayMaxMs = D4Constants.TypeCharDelayMaxMs) =>
        TypeText(number.ToString(), charDelayMinMs, charDelayMaxMs);

    /// <summary>Standard point of row targetRow (1-based) of totalRows in a region, centered with a random offset. 1:1 calculate_region_row_point.</summary>
    protected (int X, int Y) CalculateRegionRowPoint(D4StdRegion region, int totalRows, int targetRow, int randomOffset = 5)
    {
        double rowHeight = (region.Y2 - region.Y1) / (double)totalRows;
        double targetY = region.Y1 + (targetRow - 0.5) * rowHeight;
        int centerX = (region.X1 + region.X2) / 2;
        int x = centerX + D4CoordinateHelper.RandomInclusive(-randomOffset, randomOffset);
        int y = (int)(targetY + D4CoordinateHelper.RandomInclusive(-randomOffset, randomOffset));
        ColorPrinter.Blue($"{LogPrefix} Calculated row {targetRow}/{totalRows} point: ({x}, {y})");
        return (x, y);
    }
}
