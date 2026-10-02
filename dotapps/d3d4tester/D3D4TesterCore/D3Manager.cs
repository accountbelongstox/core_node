// PY-REF: pyapps/d3-check/d3utils/d3_manager.py
// PY-REF: pyapps/d3-check/d3utils/d3_start_game_and_teleport_waiter.py
// PY-REF: pyapps/d3-check/d3utils/screenshot_provider.py
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Diablo III window management on <see cref="GameWindowManager"/> (find, poll, kill, activate): windows by exe first, then
/// title via D3WindowFinder; prime the capture window cache, capture the game window, send keys.
/// 1:1 Python d3utils/d3_manager.py (+ _activate_d3_window / provider.gen(window_titles=D3) of d3_start_game_and_teleport_waiter.py).
/// </summary>
public sealed class D3Manager : GameWindowManager
{
    public static D3Manager Instance { get; } = new();

    private D3Manager()
    {
    }

    protected override string LogPrefix => "[D3Manager]";

    protected override string GameLabel => "D3";

    /// <summary>Titles passed to provider/analyzer after prime. 1:1 Python get_capture_titles.</summary>
    public IReadOnlyList<string> GetCaptureTitles() => D3WindowConstants.DiabloIIIWindowTitles;

    /// <summary>D3 windows: by exe when d3.d3_path is set, else by title. 1:1 Python find_windows.</summary>
    public override IReadOnlyList<WindowFinder.WindowInfo> FindWindows() => D3WindowFinder.FindWindows();

    /// <summary>Find the window and prime the capture window cache. 1:1 Python prime_window_cache_for_capture.</summary>
    public bool PrimeWindowCacheForCapture()
    {
        var w = FindFirstWindow();
        if (w == null) return false;
        var title = string.IsNullOrEmpty(w.Title) ? GetCaptureTitles()[0] : w.Title;
        ScreenCaptureService.GetScreenshotProvider().CacheWindow(GetCaptureTitles(), w.Hwnd, title, w.ClassName);
        return true;
    }

    /// <summary>Clear the capture window cache (Python WindowFinder.invalidate_window_cache(D3 titles)).</summary>
    public void InvalidateWindowCache() => ScreenCaptureService.GetScreenshotProvider().ClearWindowCache();

    /// <summary>
    /// Capture the D3 game window and update global scale; null when no window or capture failed.
    /// 1:1 Python get_screenshot_provider().gen(use_optimized_capture=True, window_titles=D3 titles).
    /// </summary>
    public ScreenshotData? CaptureGameWindow(bool activateFirst = false)
    {
        if (activateFirst) ActivateWindow();
        var w = FindFirstWindow();
        if (w == null || w.Hwnd == IntPtr.Zero) return null;
        var sd = ScreenshotAndScaleHelper.CaptureGameWindowAndUpdateScale(w.Hwnd);
        return sd?.GameWindowImage == null ? null : sd;
    }

    /// <summary>Send one key (down, short hold, up) to the D3 window via PostMessage. 1:1 Python window_send_key press/release.</summary>
    public bool SendKeyToWindow(ushort vk)
    {
        var w = FindFirstWindow();
        if (w == null || w.Hwnd == IntPtr.Zero) return false;
        WindowInputHelper.SendKey(w.Hwnd, vk, true);
        Thread.Sleep(D3InterfaceConstants.SendKeyHoldMs);
        WindowInputHelper.SendKey(w.Hwnd, vk, false);
        return true;
    }
}
