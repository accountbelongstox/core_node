// PY-REF: pyapps/d3-check/d3utils/d3_start_game_and_teleport_waiter.py
// PY-REF: pyapps/d3-check/d3utils/rosbot_flow/action_groups/map_teleport.py
// PY-REF: pyapps/d3-check/share/scaled_template_matcher_base.py
// PY-REF: pyapps/d3-check/d3utils/d3u_common/image_annotator_helper.py
using System.Drawing;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;
using DotCore.Utils.Input;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// D3 start game and teleport (ROSBOT_FLOW_MERMAID C branch): C3 state detection (one capture, all templates),
/// C5 Start Game click, C10 M-key similarity online check, C7a M + bounty verify, C7b minimize / teleport clicks
/// (unified scaled coordinates, click debug images) and the blocking fragment helpers used by the login-try controller.
/// 1:1 Python d3utils/d3_start_game_and_teleport_waiter.py.
/// </summary>
public static class D3StartGameAndTeleport
{
    public const string StateDisconnect = "disconnect";
    public const string StateStart = "start";
    public const string StateGameTool = "game_tool";
    public const string StateWait = "wait";

    private const string LogPrefix = "[D3StartGameWaiter]";
    private const int ClickDebugRadius = 12;
    private const double ClickDebugFontScale = 0.5;
    private const int ClickDebugLabelOffsetX = 10;
    private const int ClickDebugLabelOffsetY = 4;
    private const string ClickDebugTimestampFormat = D3PathConstants.FileTimestampMsFormat;

    private static readonly D3StatesMatch NoStates = new(false, false, false, false);
    private static readonly object C10Lock = new();
    private static Bitmap? _c10ImgA;

    private static D3Manager D3 => D3Manager.Instance;

    private static string MatchDebugDir => Path.Combine(D3InterfaceConstants.TmpRootDir, D3InterfaceConstants.MatchDebugSubdir);

    // ---------- C7b (tick-driven: minimize on tick N, teleport on tick N+1) ----------

    /// <summary>True when a fresh D3 game window capture succeeds (Python map_teleport _ensure_screenshot_context).</summary>
    public static bool HasGameWindowCapture() => D3.CaptureGameWindow() != null;

    /// <summary>[C7b] One tick: minimize map click only. 1:1 Python step_c7b_minimize_only.</summary>
    public static bool StepC7bMinimizeOnly()
    {
        ClickStandardPoint(D3InterfaceConstants.D3MapMinimizeClick, "minimize", "start_game_teleport_minimize",
            "[C7b] Minimize map click");
        return true;
    }

    /// <summary>[C7b] Teleport: large/small map click, interval, secret camp minimap click, interval. 1:1 Python step_c7b_teleport_only.</summary>
    public static bool StepC7bTeleportOnly()
    {
        ClickStandardPoint(D3InterfaceConstants.D3TeleportClick, "teleport1_big_small_map", "start_game_teleport_click",
            "[C7b] Teleport 1 large/small map");
        SleepSec(D3InterfaceConstants.C7bTeleportClickIntervalSec);
        ClickStandardPoint(D3InterfaceConstants.D3TeleportClick2, "teleport2_camp_small_map", "start_game_teleport_click_2",
            "[C7b] Teleport 2 secret camp minimap");
        SleepSec(D3InterfaceConstants.C7bTeleportClickIntervalSec);
        ColorPrinter.Green($"{LogPrefix}[C7b] Teleport done, starting ROSBOT flow");
        return true;
    }

    /// <summary>[C7b] Minimize then teleport in one call (legacy/blocking path). 1:1 Python _do_c7b_teleport.</summary>
    private static bool DoC7bTeleport()
    {
        if (!StepC7bMinimizeOnly()) return false;
        return StepC7bTeleportOnly();
    }

    private static void ClickStandardPoint((int X, int Y) standard, string label, string filePrefix, string logStep)
    {
        var (sx, sy) = GameInterfaceData.Instance.CalculateUnifiedScaledCoordinate(standard.X, standard.Y);
        var sd = D3.CaptureGameWindow();
        var (ox, oy) = sd?.WindowOffset ?? (0, 0);
        int screenX = ox + sx;
        int screenY = oy + sy;
        if (sd?.GameWindowImage != null)
            SaveClickDebugImage(sd.GameWindowImage, new[] { (sx, sy, label) }, filePrefix);
        ColorPrinter.Green($"{LogPrefix}{logStep} ({standard.X}, {standard.Y}) -> ({sx},{sy}) screen ({screenX},{screenY})");
        ClickAt(screenX, screenY);
    }

    // ---------- Detection ----------

    /// <summary>Activate D3, capture and match d3_start_game_button. Returns (capture, center in image) or (capture, null).</summary>
    private static (ScreenshotData? Sd, (int X, int Y)? Center) CaptureAndMatchStartGameButton()
    {
        var sd = D3.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null) return (null, null);
        var center = MatchCenter(sd.GameWindowImage, D3TemplateNames.D3StartGameButton);
        return (sd, center);
    }

    /// <summary>Activate D3, capture and match d3_bounty_progress. 1:1 Python _capture_and_match_bounty_progress.</summary>
    private static (ScreenshotData? Sd, bool Found) CaptureAndMatchBountyProgress()
    {
        var sd = D3.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null) return (null, false);
        return (sd, MatchCenter(sd.GameWindowImage, D3TemplateNames.D3BountyProgress) != null);
    }

    /// <summary>
    /// If d3_start_game_button is visible, click it and return true (C3 loop: Start Game may be stuck; caller resets the deadline).
    /// 1:1 Python click_start_game_button_if_found.
    /// </summary>
    public static bool ClickStartGameButtonIfFound()
    {
        var (sd, center) = CaptureAndMatchStartGameButton();
        if (center == null) return false;
        var (ox, oy) = sd?.WindowOffset ?? (0, 0);
        ColorPrinter.Blue($"{LogPrefix} C3 loop: d3_start_game_button found, clicking (start may be stuck), caller resets 1min");
        ClickAt(ox + center.Value.X, oy + center.Value.Y);
        return true;
    }

    /// <summary>
    /// One D3 capture -> all UI states (disconnected / start_game_button / game_tool / connecting).
    /// Used by C3 and by D3StatusProvider dynamic detection. 1:1 Python capture_and_detect_all_d3_states.
    /// </summary>
    public static (ScreenshotData? Sd, D3StatesMatch States) CaptureAndDetectAllD3States()
    {
        var sd = D3.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null) return (sd, NoStates);
        return (sd, D3ScaledTemplateMatcher.Instance.MatchAllD3States(sd.GameWindowImage));
    }

    /// <summary>
    /// [C3] One capture, all templates. Priority: disconnected -> game_tool -> start -> connecting -> null.
    /// Returns disconnect | start | game_tool | wait | null. 1:1 Python detect_d3_already_running_state.
    /// </summary>
    public static string? DetectD3AlreadyRunningState()
    {
        var (_, s) = CaptureAndDetectAllD3States();
        if (s.Disconnected) return StateDisconnect;
        if (s.GameTool) return StateGameTool;
        if (s.StartGameButton) return StateStart;
        if (s.Connecting) return StateWait;
        return null;
    }

    // ---------- C10 (M-key online check) ----------

    /// <summary>Resize both to 64x64 gray and return 1 - mean_abs_diff / 255 (1 = identical). 1:1 Python _image_similarity_0_1.</summary>
    private static double ImageSimilarity01(Bitmap a, Bitmap b)
    {
        try
        {
            using var bgrA = ImageConvert.NormalizeToBgr(a);
            using var bgrB = ImageConvert.NormalizeToBgr(b);
            if (bgrA == null || bgrB == null) return 0.0;
            var size = new OpenCvSharp.Size(D3InterfaceConstants.D3OnlineSimilarityResize, D3InterfaceConstants.D3OnlineSimilarityResize);
            using var rA = bgrA.Resize(size);
            using var rB = bgrB.Resize(size);
            using var gA = rA.CvtColor(ColorConversionCodes.BGR2GRAY);
            using var gB = rB.CvtColor(ColorConversionCodes.BGR2GRAY);
            using var fA = new Mat();
            using var fB = new Mat();
            gA.ConvertTo(fA, MatType.CV_32F);
            gB.ConvertTo(fB, MatType.CV_32F);
            using var diff = new Mat();
            Cv2.Absdiff(fA, fB, diff);
            double mean = Cv2.Mean(diff).Val0;
            return 1.0 - Math.Min(mean / 255.0, 1.0);
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogPrefix} similarity error: {ex.Message}");
            return 0.0;
        }
    }

    /// <summary>[C10a] One tick: capture (before) -> send M; next tick StepC10Compare. 1:1 Python step_c10_send_m.</summary>
    public static bool StepC10SendM()
    {
        var sd = D3.CaptureGameWindow(activateFirst: true);
        if (sd?.GameWindowImage == null) return false;
        lock (C10Lock)
        {
            _c10ImgA?.Dispose();
            _c10ImgA = new Bitmap(sd.GameWindowImage);
        }
        return D3.SendKeyToWindow(D3InterfaceConstants.VkM);
    }

    /// <summary>
    /// [C10b] One tick: compare after-M capture with the C10a capture. High similarity = M no response = disconnect.
    /// Returns true = online, false = disconnect, null = error. 1:1 Python step_c10_compare.
    /// </summary>
    public static bool? StepC10Compare()
    {
        Bitmap? imgA;
        lock (C10Lock) imgA = _c10ImgA;
        if (imgA == null) return null;
        var sd = D3.CaptureGameWindow();
        if (sd?.GameWindowImage == null) return null;
        double sim = ImageSimilarity01(imgA, sd.GameWindowImage);
        double thresh = D3InterfaceConstants.D3OnlineSimilarityThreshold;
        lock (C10Lock)
        {
            _c10ImgA?.Dispose();
            _c10ImgA = null;
        }
        if (sim >= thresh)
        {
            ColorPrinter.Yellow($"{LogPrefix}[C10b] Disconnect check: similarity={sim:F3} >= {thresh} -> before/after M almost same -> M no response -> disconnect");
            return false;
        }
        ColorPrinter.Green($"{LogPrefix}[C10b] Disconnect check: similarity={sim:F3} < {thresh} -> M response -> online (separate from C7 map/teleport)");
        return true;
    }

    /// <summary>[C10] Blocking: capture, M, wait, capture, compare. 1:1 Python check_d3_online_by_m_similarity.</summary>
    public static bool CheckD3OnlineByMSimilarity()
    {
        if (!StepC10SendM()) return false;
        SleepSec(D3InterfaceConstants.D3GameToolAfterMDelaySec);
        return StepC10Compare() == true;
    }

    // ---------- C7a ----------

    /// <summary>[C7a] One tick: send M (toggle map). 1:1 Python step_c7a_send_m.</summary>
    public static bool StepC7aSendM() => D3.SendKeyToWindow(D3InterfaceConstants.VkM);

    /// <summary>[C7a verify] True when bounty progress UI is visible (map open). 1:1 Python step_c7a_verify_bounty_progress.</summary>
    public static bool StepC7aVerifyBountyProgress() => CaptureAndMatchBountyProgress().Found;

    private static void SendMOnceThenWaitForCapture()
    {
        if (!D3.SendKeyToWindow(D3InterfaceConstants.VkM)) return;
        SleepSec(D3InterfaceConstants.D3GameToolAfterMDelaySec);
    }

    /// <summary>
    /// [C7] Blocking: pre-check bounty, else up to two rounds of M + bounty check; then C7b. Never kills D3 for missing bounty.
    /// 1:1 Python _ensure_map_open_then_c7b_teleport.
    /// </summary>
    private static bool EnsureMapOpenThenC7bTeleport()
    {
        var (sd0, bounty0) = CaptureAndMatchBountyProgress();
        if (bounty0)
        {
            ColorPrinter.Green($"{LogPrefix}[C7] Pre-check found bounty, map open -> wait {D3InterfaceConstants.C7bAfterBountyStableSec}s stable then zoom+teleport");
            if (sd0 == null) return false;
            SleepSec(D3InterfaceConstants.C7bAfterBountyStableSec);
            return DoC7bTeleport();
        }
        bool haveCapture = sd0 != null;
        for (int roundNo = 1; roundNo <= 2; roundNo++)
        {
            ColorPrinter.Gray($"{LogPrefix}[C7] Round {roundNo}: map not confirmed open -> press M, wait, check bounty");
            SendMOnceThenWaitForCapture();
            var (sd, found) = CaptureAndMatchBountyProgress();
            if (sd != null) haveCapture = true;
            if (found)
            {
                ColorPrinter.Green($"{LogPrefix}[C7] Round {roundNo} found bounty, map open -> wait {D3InterfaceConstants.C7bAfterBountyStableSec}s stable then zoom+teleport");
                if (sd == null) return false;
                SleepSec(D3InterfaceConstants.C7bAfterBountyStableSec);
                return DoC7bTeleport();
            }
            ColorPrinter.Gray($"{LogPrefix}[C7] Round {roundNo} no bounty" + (roundNo == 1 ? ", try second M" : ", still run C7b"));
        }
        ColorPrinter.Yellow($"{LogPrefix}[C7] No bounty after two M rounds; per doc do not kill D3, still run C7b");
        if (!haveCapture && D3.CaptureGameWindow() == null) return false;
        return DoC7bTeleport();
    }

    /// <summary>After fragment 1 (game_tool appeared): C10 similarity check then C7a/C7w/C7b. 1:1 Python send_m_then_teleport_three_clicks.</summary>
    public static bool SendMThenTeleportThreeClicks()
    {
        if (!CheckD3OnlineByMSimilarity()) return false;
        return EnsureMapOpenThenC7bTeleport();
    }

    /// <summary>
    /// [C5] Fragment 1: if d3_start_game_button found, click; then [C5w] poll states until game_tool / disconnect / timeout.
    /// Returns true = game_tool appeared; false = timeout or disconnect (caller C12); null = no start button (try fragment 2).
    /// 1:1 Python try_fragment1_click_start_game_wait_game_tool.
    /// </summary>
    public static bool? TryFragment1ClickStartGameWaitGameTool(
        double intervalSec = D3InterfaceConstants.D3StartGameWaitIntervalSec,
        int maxWaitGameToolAttempts = D3InterfaceConstants.D3Fragment1WaitGameToolAttempts)
    {
        var (sd, center) = CaptureAndMatchStartGameButton();
        if (center == null) return null;
        var (cx, cy) = center.Value;
        var (ox, oy) = sd?.WindowOffset ?? (0, 0);
        ColorPrinter.Green($"{LogPrefix}[Fragment1] Found d3_start_game_button at ({cx},{cy}); clicking then waiting {maxWaitGameToolAttempts}x{intervalSec}s for d3_game_tool");
        ClickAt(ox + cx, oy + cy);
        var deadline = DateTime.UtcNow.AddSeconds(maxWaitGameToolAttempts * intervalSec);
        while (DateTime.UtcNow < deadline)
        {
            SleepSec(intervalSec);
            var state = DetectD3AlreadyRunningState();
            if (state == StateGameTool)
            {
                ColorPrinter.Green($"{LogPrefix}[Fragment1] d3_game_tool appeared after Start Game click");
                return true;
            }
            if (state == StateDisconnect)
            {
                ColorPrinter.Yellow($"{LogPrefix}[Fragment1] d3_disconnected during C5w -> caller F1d/C12");
                return false;
            }
        }
        ColorPrinter.Yellow($"{LogPrefix}[Fragment1] C5w timeout -> C12");
        return false;
    }

    /// <summary>[C6] game_tool path: C7 ensure map open (pre-check + two M rounds) then C7b. 1:1 Python try_fragment2_game_tool_press_m_then_clicks.</summary>
    public static bool TryFragment2GameToolPressMThenClicks()
    {
        if (DetectD3AlreadyRunningState() != StateGameTool) return false;
        ColorPrinter.Green($"{LogPrefix}[Fragment2] d3_game_tool visible; C7 ensure map open (precheck+two M rounds+bounty) then C7b teleport");
        return EnsureMapOpenThenC7bTeleport();
    }

    // ---------- Matcher / click / debug helpers ----------

    /// <summary>Center of the first match of templateName in image coordinates, or null. 1:1 Python match_template total_matches >= 1.</summary>
    private static (int X, int Y)? MatchCenter(Bitmap image, string templateName)
    {
        var r = D3ScaledTemplateMatcher.Instance.MatchTemplate(image, templateName);
        var m = r.FirstMatch;
        if (r.TotalMatches < 1 || m == null) return null;
        return (m.CenterX, m.CenterY);
    }

    private static void ClickAt(int screenX, int screenY) =>
        ClickHandler.Instance.Click(screenX, screenY,
            duration: D3InterfaceConstants.ClickMoveDurationSec,
            returnToOriginal: true,
            directClick: true,
            pauseAfterMove: D3InterfaceConstants.ClickPauseAfterMoveSec);

    private static void SleepSec(double sec) => Thread.Sleep(TimeSpan.FromSeconds(sec));

    /// <summary>Draw labelled click points on the capture and save under match_debug. 1:1 Python save_click_debug_image.</summary>
    private static void SaveClickDebugImage(Bitmap image, IReadOnlyList<(int X, int Y, string Label)> points, string filenamePrefix)
    {
        try
        {
            using var mat = ImageConvert.NormalizeToBgr(image);
            if (mat == null) return;
            for (int i = 0; i < points.Count; i++)
            {
                var (x, y, label) = points[i];
                var color = ImageAnnotate.GetAutoColor(i);
                ImageAnnotate.DrawCircle(mat, new OpenCvSharp.Point(x, y), ClickDebugRadius, color, 2);
                ImageAnnotate.DrawText(mat, label,
                    new OpenCvSharp.Point(Math.Max(0, x - ClickDebugLabelOffsetX), Math.Max(0, y - ClickDebugRadius - ClickDebugLabelOffsetY)),
                    color, ClickDebugFontScale, 1, new Scalar(0, 0, 0));
            }
            Directory.CreateDirectory(MatchDebugDir);
            var path = Path.Combine(MatchDebugDir, $"{filenamePrefix}_{DateTime.Now.ToString(ClickDebugTimestampFormat)}.png");
            mat.SaveImage(path);
            ColorPrinter.Blue($"[ImageAnnotatorHelper] Click debug image saved: {path}");
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"[ImageAnnotatorHelper] Click debug save error: {ex.Message}");
        }
    }
}
