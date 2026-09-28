using System.Drawing;
using System.Runtime.InteropServices;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils.Ocr;
using DotApps.d3check.Core;

namespace DotApps.d3check.Core.Battlenet;

/// <summary>
/// CN browser login OCR flow (B11). 1:1 Python browser_login_ocr_flow:
/// find browser by title -> activate -> capture center 80% -> OCR -> success or click EULA/同意/登录.
/// </summary>
public static class BrowserLoginOcrFlow
{
    private static IOcrEngine? _defaultEngine;
    private static readonly object _engineLock = new();

    /// <summary>Optional default OCR engine for B11. Set by app or use GetOrCreateDefaultEngine().</summary>
    public static IOcrEngine? DefaultEngine
    {
        get => _defaultEngine;
        set => _defaultEngine = value;
    }

    /// <summary>Lazy-create PaddleOcrEngine once for B11. Returns null if init fails.</summary>
    public static IOcrEngine? GetOrCreateDefaultEngine()
    {
        if (_defaultEngine != null && _defaultEngine.IsInitialized) return _defaultEngine;
        lock (_engineLock)
        {
            if (_defaultEngine != null && _defaultEngine.IsInitialized) return _defaultEngine;
            var engine = new PaddleOcrEngine();
            if (!engine.Init()) return null;
            _defaultEngine = engine;
            return engine;
        }
    }

    /// <summary>One poll result: Success, Timeout, Continue.</summary>
    public enum PollResult { Success, Timeout, Continue }

    /// <summary>
    /// One poll: find browser, activate, capture center 80%, OCR, click or success.
    /// Returns Success when success text found (call notifyOauthDone); Timeout when past deadline; Continue otherwise.
    /// </summary>
    public static PollResult RunOnePoll(
        DateTime deadlineUtc,
        IOcrEngine? engine,
        Action? notifyOauthDone = null)
    {
        if (DateTime.UtcNow >= deadlineUtc)
            return PollResult.Timeout;

        var win = BrowserWindowFinder.GetFrontmostBrowserLoginWindow(BattlenetConstants.CnBrowserLoginWindowTitleKeywords);
        if (win == null)
        {
            ColorPrinter.Gray("[BrowserLoginOCR] B11: no browser window matching title, skip this poll");
            return PollResult.Continue;
        }

        var (winLeft, winTop, winRight, winBottom) = win.Rect;
        if (win.Hwnd != IntPtr.Zero)
        {
            SetForegroundWindow(win.Hwnd);
            Thread.Sleep((int)(BattlenetConstants.BrowserOcrActivateDelaySec * 1000));
        }

        (int capLeft, int capTop, int capRight, int capBottom) = CenterRegion(
            winLeft, winTop, winRight, winBottom,
            BattlenetConstants.BrowserOcrCenterWidthRatio,
            BattlenetConstants.BrowserOcrCenterHeightRatio);

        using var bitmap = ScreenCaptureService.GetScreenshotProvider().CaptureRegionBitBlt(capLeft, capTop, capRight - capLeft, capBottom - capTop);
        if (bitmap == null)
            return PollResult.Continue;

        string? tempPath = null;
        try
        {
            tempPath = Path.Combine(Path.GetTempPath(), "browser_login_ocr_" + Guid.NewGuid().ToString("N") + ".png");
            ScreenCaptureService.SaveToFile(bitmap, tempPath);
        }
        catch
        {
            return PollResult.Continue;
        }

        if (engine == null || !engine.IsInitialized)
        {
            ColorPrinter.Yellow("[BrowserLoginOCR] OCR engine not available, skip this poll");
            return PollResult.Continue;
        }

        var result = engine.Ocr(tempPath, null);
        try { File.Delete(tempPath); } catch { /* ignore */ }

        if (result == null)
            return PollResult.Continue;

        var text = result.Text ?? "";
        if (BattlenetConstants.CnBrowserSuccessOcrKeywords.Any(kw => text.Contains(kw, StringComparison.Ordinal)))
        {
            ColorPrinter.Blue("[BrowserLoginOCR] Success text found, consider OAuth done");
            notifyOauthDone?.Invoke();
            return PollResult.Success;
        }

        var raw = result.RawResult ?? Array.Empty<OcrWordBox>();
        var eulaBoxes = OcrHelper.FindKeywordBoxes(result, BattlenetConstants.BrowserOcrEulaKeywords).ToList();
        var agreeBoxes = OcrHelper.FindKeywordBoxes(result, BattlenetConstants.BrowserOcrAgreeKeywords)
            .Where(b => !(b.Text ?? "").Contains("取消", StringComparison.Ordinal)).ToList();
        var agreeBtn = PickBestButton(agreeBoxes, "同意", 5);
        var loginBoxes = OcrHelper.FindKeywordBoxes(result, BattlenetConstants.BrowserOcrLoginKeywords).ToList();
        var loginBtn = PickBestButton(loginBoxes, "登录", 5);

        if (eulaBoxes.Count > 0 && agreeBtn != null)
        {
            var eula = eulaBoxes[0];
            var (minX, minY, maxX, maxY) = eula.Bbox;
            double checkCx = minX - 24;
            double checkCy = (minY + maxY) / 2;
            if (checkCx < 0) checkCx = minX / 2;
            int screenCheckX = capLeft + (int)checkCx;
            int screenCheckY = capTop + (int)checkCy;
            GameInputHelper.SendMouseClick(screenCheckX, screenCheckY);
            Thread.Sleep(300);
            ClickBboxCenter(capLeft, capTop, agreeBtn.Bbox);
            ColorPrinter.Blue("[BrowserLoginOCR] B11 OCR: EULA+同意 -> clicked");
            return PollResult.Continue;
        }

        if (agreeBtn != null && eulaBoxes.Count == 0)
        {
            ClickBboxCenter(capLeft, capTop, agreeBtn.Bbox);
            ColorPrinter.Blue("[BrowserLoginOCR] B11 OCR: 同意 -> clicked");
            return PollResult.Continue;
        }

        if (loginBtn != null)
        {
            ClickBboxCenter(capLeft, capTop, loginBtn.Bbox);
            ColorPrinter.Blue("[BrowserLoginOCR] B11 OCR: 登录 -> clicked");
            return PollResult.Continue;
        }

        ColorPrinter.Gray("[BrowserLoginOCR] B11 OCR: center 80% no 登录/同意/EULA, next poll");
        return PollResult.Continue;
    }

    /// <summary>Block until success or timeout. Polls every pollIntervalSec. Returns true if success.</summary>
    public static bool RunBrowserLoginOcrFlow(
        double timeoutSec = BattlenetConstants.BrowserOcrTimeoutSec,
        double pollIntervalSec = BattlenetConstants.BrowserOcrPollIntervalSec,
        IOcrEngine? engine = null,
        Action? notifyOauthDone = null)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
        while (DateTime.UtcNow < deadline)
        {
            var status = RunOnePoll(deadline, engine, notifyOauthDone);
            if (status == PollResult.Success) return true;
            if (status == PollResult.Timeout) break;
            Thread.Sleep((int)(pollIntervalSec * 1000));
        }
        ColorPrinter.Yellow($"[BrowserLoginOCR] Timeout after {timeoutSec}s");
        return false;
    }

    private static (int Left, int Top, int Right, int Bottom) CenterRegion(
        int left, int top, int right, int bottom, double widthRatio, double heightRatio)
    {
        int w = right - left, h = bottom - top;
        int cw = Math.Max(1, (int)(w * widthRatio));
        int ch = Math.Max(1, (int)(h * heightRatio));
        int cx = left + (w - cw) / 2;
        int cy = top + (h - ch) / 2;
        return (cx, cy, cx + cw, cy + ch);
    }

    private static KeywordBox? PickBestButton(IReadOnlyList<KeywordBox> boxes, string exactText, int maxChars)
    {
        if (boxes == null || boxes.Count == 0) return null;
        var shortList = boxes.Where(b => (b.Text ?? "").Trim().Length <= maxChars).ToList();
        if (shortList.Count == 0) return null;
        var exact = shortList.FirstOrDefault(b => (b.Text ?? "").Trim().Equals(exactText, StringComparison.Ordinal));
        return exact ?? shortList[0];
    }

    private static void ClickBboxCenter(int captureLeft, int captureTop, (double MinX, double MinY, double MaxX, double MaxY) bbox)
    {
        double cx = (bbox.MinX + bbox.MaxX) / 2;
        double cy = (bbox.MinY + bbox.MaxY) / 2;
        int screenX = captureLeft + (int)cx;
        int screenY = captureTop + (int)cy;
        GameInputHelper.SendMouseClick(screenX, screenY);
    }

    [DllImport("user32.dll")]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool SetForegroundWindow(IntPtr hWnd);
}
