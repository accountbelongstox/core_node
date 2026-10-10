// PY-REF: none (DOT-only)
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.TemplateMatcher;
using DotCore.Utils;
using DotCore.Utils.Ocr;
using DotCore.Utils.Text;
using OpenCvSharp;
using OpenCvSharp.Extensions;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>How the skill switch reads the hero's current skills: the ROSBOT plugin (exact skills / runes / passives / level) or images only.</summary>
public enum SkillSwitchMethod { Plugin, Image }

/// <summary>Result of a switch run; Outcome drives the UI text, the counts the detail.</summary>
public enum SkillSwitchOutcome { Done, Partial, NoGameWindow, LevelTooLow, ActionBarNotFound, ChooserNotOpen, SkillNotInList, PluginUnavailable, Stopped }

/// <summary>Plugin skills_check answer: hero level (0 = unknown) and per target true / false / null (unknown) for skills (incl. rune) and passives.</summary>
public sealed record SkillCheckResult(int Level, IReadOnlyList<bool?> Skills, IReadOnlyList<bool?> Passives);

public sealed record SkillSwitchResult(SkillSwitchOutcome Outcome, int SkillsChanged, int PassivesChanged, int Mismatches, string Detail);

/// <summary>
/// Puts the hero's skills, runes and passives to a maxroll gear set through the D3 UI (ROSBOT has no skill API; both methods click the
/// same way). Flow verified on the live client: the skill pane opens with the skills key S posted to the D3 window (D3 ignores
/// SendInput keys; mouse clicks via SendInput work); clicking an action bar slot only shows a tooltip. In the pane the six skill boxes
/// sit in reading order LMB, RMB, 1, 2, 3, 4 (= maxroll order); clicking a box opens the skill chooser: one category per page between
/// two arrows (templates in Templates/skill_switch), the rune row below, the assigned-skill box, Accept / Cancel. The planned skill is
/// searched in the icon row only (the assigned box shows the current skill), page by page; a gray-zone icon score is settled by the
/// OCR'd name. The rune is OCR'd on a 2x upscale and matched typo-tolerantly (regex normalize + LCS, FuzzyText); an unreadable rune is
/// found by elimination (every other rune name of the skill assigned to a word, the one word left is the planned rune). Passives: a
/// pane passive slot opens the passive chooser (four slots on top, every passive below as icon + name, Accept): each planned passive
/// not on top yet goes into a top slot not holding a planned one, then Accept.
/// Geometry is in client pixels of the 1072x603 reference client, scaled with the client height and centered horizontally (D3 scales
/// its UI that way); every capture first makes D3 the foreground window (idempotent) and maps client points through the capture offset.
/// Plugin method: skills_check first (level 70 required; a slot is skipped when its pane icon is the planned skill and the plugin reports
/// that skill with the planned rune) and again at the end. Image method: every slot is set (runes cannot be read from icons) and the end
/// check compares the pane icons.
/// </summary>
public static class D3SkillSwitcher
{
    public const int RequiredLevel = 70;
    public const int SlotCount = 6;
    private const int PassiveCount = 4;
    private const string LogTag = "[SkillSwitch]";

    private const double RefClientWidth = 1072.0;
    private const double RefClientHeight = 603.0;
    /// <summary>Skill pane, reference client px: box click points and icon centers per maxroll slot (LMB, RMB, 1-4).</summary>
    private static readonly (int X, int Y)[] PaneSlotClick = { (435, 109), (642, 109), (435, 212), (642, 212), (435, 292), (642, 292) };
    private static readonly (int X, int Y)[] PaneSlotIcon = { (354, 109), (562, 109), (354, 212), (562, 212), (354, 292), (562, 292) };
    private static readonly (int X, int Y) PanePassiveSlot = (354, 381);
    /// <summary>Passive chooser, reference client px: the four slots on top and the grid of available passives.</summary>
    private static readonly (int X, int Y)[] PassiveTopSlots = { (390, 102), (487, 102), (584, 102), (681, 102) };
    private static readonly (int Left, int Top, int Right, int Bottom) PassiveGrid = (282, 149, 752, 429);
    private const int SlotProbeHalfPx = 26;

    private const double IconMinFrac = 0.04;
    private const double IconMaxFrac = 0.09;
    private const double IconThreshold = 0.75;
    private const double IconGrayZone = 0.60;
    private const int PaneOpenMinIcons = 3;
    private const int SizeStepDivisor = 300;
    private const int AfterKeyMs = 900;
    private const int AfterClickMs = 800;
    private const int AfterIconClickMs = 450;
    private const int AfterRuneClickMs = 300;
    private const int AfterAcceptMs = 800;
    private const int AfterPageClickMs = 450;
    private const int MaxPages = 7;
    private const uint VkS = 0x53;
    private const uint VkEscape = 0x1B;

    private const double TemplateScaleMin = 0.85;
    private const double TemplateScaleStep = 0.05;
    private const int TemplateScaleSteps = 7;
    private const double ArrowThreshold = 0.85;
    private const double AcceptThreshold = 0.90;
    /// <summary>Chooser geometry relative to the page arrows' center line, in client heights.</summary>
    private const double RowAboveFrac = 0.05;
    private const double RowBelowFrac = 0.065;
    private const double RuneTopFrac = 0.12;
    private const double RuneBottomFrac = 0.33;
    private const double AssignedTopFrac = 0.37;
    private const double AssignedBottomFrac = 0.48;
    private const double OcrUpscale = 2.0;
    private const double NameMinSimilarity = 0.5;
    private const string TemplateDir = "skill_switch";
    private const string TemplatePagePrev = "skill_page_prev";
    private const string TemplatePageNext = "skill_page_next";
    private const string TemplateAccept = "skill_accept";
    private static readonly string[] NoRuneNames = { "无符文", "No Rune" };
    private static readonly string[] AcceptWords = { "接受", "Accept" };

    public static SkillSwitchResult Run(PlannerProfile profile, string cls, string cacheDir, SkillSwitchMethod method,
        Func<SkillCheckResult?>? pluginCheck, Func<bool> shouldStop)
    {
        var skills = new PlannerSkill?[SlotCount];
        foreach (var s in profile.Skills.Where(s => s.SlotIndex is >= 0 and < SlotCount)) skills[s.SlotIndex] = s;
        var passives = profile.Passives.Take(PassiveCount).ToList();
        SkillCheckResult? before = null;
        if (method == SkillSwitchMethod.Plugin)
        {
            before = pluginCheck?.Invoke();
            if (before == null) return Result(SkillSwitchOutcome.PluginUnavailable, 0, 0, 0, "skills_check got no answer");
            if (before.Level > 0 && before.Level < RequiredLevel) return Result(SkillSwitchOutcome.LevelTooLow, 0, 0, 0, $"level {before.Level}");
        }
        if (!OpenPane(cls, cacheDir)) return Result(SkillSwitchOutcome.ActionBarNotFound, 0, 0, 0, "skill pane not open (D3 in game and visible?)");
        int skillsChanged = 0, passivesChanged = 0;
        try
        {
            for (int slot = 0; slot < SlotCount; slot++)
            {
                if (shouldStop()) return Result(SkillSwitchOutcome.Stopped, skillsChanged, 0, 0, "stopped");
                if (skills[slot] is not { } target) continue;
                bool pluginOk = before != null && slot < before.Skills.Count && before.Skills[slot] == true;
                if (pluginOk && SlotShows(slot, target.Id, cls, cacheDir))
                {
                    ColorPrinter.Gray($"{LogTag} slot {slot}: {target.Id}/{target.Rune} already set");
                    continue;
                }
                var step = SetSkill(slot, target, cls, cacheDir);
                if (step is SkillSwitchOutcome.SkillNotInList or SkillSwitchOutcome.ChooserNotOpen or SkillSwitchOutcome.NoGameWindow)
                    return Result(step, skillsChanged, 0, 0, target.Id);
                if (step == SkillSwitchOutcome.Done) skillsChanged++;
                if (!OpenPane(cls, cacheDir)) return Result(SkillSwitchOutcome.ActionBarNotFound, skillsChanged, 0, 0, "skill pane closed");
            }
            bool passivesOk = before != null && before.Passives.Count == passives.Count && before.Passives.All(p => p == true);
            if (passives.Count > 0 && !passivesOk && !shouldStop())
            {
                passivesChanged = SetPassives(passives, cls, cacheDir);
                OpenPane(cls, cacheDir);
            }
            int mismatches = Verify(method, pluginCheck, skills, cls, cacheDir);
            var outcome = mismatches == 0 ? SkillSwitchOutcome.Done : SkillSwitchOutcome.Partial;
            return Result(outcome, skillsChanged, passivesChanged, mismatches, $"{skillsChanged} skill(s), {passivesChanged} passive(s) set, {mismatches} mismatch(es)");
        }
        finally
        {
            ClosePane(cls, cacheDir);
        }
    }

    private static SkillSwitchResult Result(SkillSwitchOutcome outcome, int skills, int passives, int mismatches, string detail)
    {
        ColorPrinter.Blue($"{LogTag} {outcome}: {detail}");
        return new SkillSwitchResult(outcome, skills, passives, mismatches, detail);
    }

    // ---------- skill pane ----------

    /// <summary>Skill pane open (idempotent): already open when the slot icons show class skills, else press S once.</summary>
    private static bool OpenPane(string cls, string cacheDir)
    {
        if (PaneOpen(cls, cacheDir)) return true;
        if (Capture() is not { } shot) return false;
        if (FindChooser(shot) != null) PressKey(shot, VkEscape);
        PressKey(shot, VkS);
        shot.Image.Dispose();
        Thread.Sleep(AfterKeyMs);
        bool open = PaneOpen(cls, cacheDir);
        if (!open) ColorPrinter.Yellow($"{LogTag} skill pane did not open with the skills key (S)");
        return open;
    }

    private static void ClosePane(string cls, string cacheDir)
    {
        for (int i = 0; i < 2 && PaneOpen(cls, cacheDir); i++)
        {
            if (Capture() is not { } shot) return;
            PressKey(shot, VkEscape);
            shot.Image.Dispose();
            Thread.Sleep(AfterKeyMs);
        }
    }

    /// <summary>At least PaneOpenMinIcons of the six pane slot spots show a class skill icon (and no chooser covers the pane).</summary>
    private static bool PaneOpen(string cls, string cacheDir)
    {
        if (Capture() is not { } shot) return false;
        using var image = shot.Image;
        if (FindChooser(shot) != null) return false;
        var keys = SkillKeys(cls, cacheDir).ToList();
        int found = Enumerable.Range(0, SlotCount).Count(slot => BestIconAt(shot, PaneSlotIcon[slot], keys, key => D3SkillIcons.SkillIconPath(cacheDir, cls, key)).Score >= IconThreshold);
        return found >= PaneOpenMinIcons;
    }

    /// <summary>The pane slot shows the given skill icon.</summary>
    private static bool SlotShows(int slot, string skill, string cls, string cacheDir)
    {
        if (Capture() is not { } shot) return false;
        using var image = shot.Image;
        return BestIconAt(shot, PaneSlotIcon[slot], new[] { skill }, key => D3SkillIcons.SkillIconPath(cacheDir, cls, key)).Score >= IconThreshold;
    }

    /// <summary>Best of the icons in a small box around a reference client point: (key, score).</summary>
    private static (string? Key, double Score) BestIconAt(Shot shot, (int X, int Y) refPoint, IEnumerable<string> keys, Func<string, string> iconPath)
    {
        var (cx, cy) = shot.ToImage(refPoint);
        int half = shot.Px(SlotProbeHalfPx);
        var box = new Rect(cx - half, cy - half, half * 2, half * 2).Intersect(new Rect(0, 0, shot.Image.Cols, shot.Image.Rows));
        if (box.Width <= 0 || box.Height <= 0) return (null, 0);
        using var area = new Mat(shot.Image, box);
        var widths = Widths(shot.ClientHeight, IconMinFrac, IconMaxFrac).Where(w => w <= box.Width).ToList();
        (string? Key, double Score) best = (null, 0);
        foreach (var key in keys)
        {
            using var icon = LoadImage(iconPath(key));
            if (icon == null) continue;
            var m = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(area, icon, widths, IconThreshold, key);
            if (m.Score > best.Score) best = (key, m.Score);
        }
        return best;
    }

    // ---------- skill chooser ----------

    /// <summary>Click the pane slot, find the planned skill page by page, click it, its rune and Accept (back to the pane).</summary>
    private static SkillSwitchOutcome SetSkill(int slot, PlannerSkill target, string cls, string cacheDir)
    {
        using var icon = LoadImage(D3SkillIcons.SkillIconPath(cacheDir, cls, target.Id));
        if (icon == null) return SkillSwitchOutcome.SkillNotInList;
        if (Capture() is not { } paneShot) return SkillSwitchOutcome.NoGameWindow;
        Click(paneShot, paneShot.ToImage(PaneSlotClick[slot]));
        paneShot.Image.Dispose();
        Thread.Sleep(AfterClickMs);
        Shot? shot = null;
        Chooser? chooser = null;
        try
        {
            for (int page = 0; page < MaxPages; page++)
            {
                shot?.Image.Dispose();
                shot = Capture();
                if (shot == null) return SkillSwitchOutcome.NoGameWindow;
                chooser = FindChooser(shot);
                if (chooser == null)
                {
                    ColorPrinter.Yellow($"{LogTag} slot {slot}: skill chooser did not open (page arrows not found)");
                    return SkillSwitchOutcome.ChooserNotOpen;
                }
                if (FindInRow(shot, chooser, icon, target) is { } at)
                {
                    Click(shot, at);
                    break;
                }
                if (page == MaxPages - 1)
                {
                    ColorPrinter.Yellow($"{LogTag} {target.Id} on no chooser page; turn on Elective Mode in D3's gameplay options");
                    PressKey(shot, VkEscape);
                    return SkillSwitchOutcome.SkillNotInList;
                }
                Click(shot, chooser.Next);
                Thread.Sleep(AfterPageClickMs);
            }
            Thread.Sleep(AfterIconClickMs);
            shot!.Image.Dispose();
            shot = Capture();
            if (shot == null) return SkillSwitchOutcome.NoGameWindow;
            chooser = FindChooser(shot) ?? chooser!;
            if (target.Rune.Length > 0) SelectRune(shot, chooser, target, cls, cacheDir);
            using (var box = new Mat(shot.Image, Band(shot, chooser, AssignedTopFrac, AssignedBottomFrac)))
            {
                var check = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(box, icon, Widths(shot.ClientHeight, IconMinFrac, IconMaxFrac), IconThreshold, target.Id);
                if (!check.Success) ColorPrinter.Yellow($"{LogTag} assigned box does not show {target.Id} (score {check.Score:F2})");
            }
            Accept(shot);
            ColorPrinter.Green($"{LogTag} slot {slot}: {target.NameEn} / {target.RuneNameEn}");
            return SkillSwitchOutcome.Done;
        }
        finally
        {
            shot?.Image.Dispose();
        }
    }

    /// <summary>
    /// Click the planned rune: OCR the rune row, assign words to the skill's rune names (plus "no rune") greedily by similarity; the
    /// planned rune's word, else the single word left over when every other name found its word (elimination).
    /// </summary>
    private static void SelectRune(Shot shot, Chooser chooser, PlannerSkill target, string cls, string cacheDir)
    {
        var words = OcrArea(shot, Band(shot, chooser, RuneTopFrac, RuneBottomFrac)).Where(w => FuzzyText.Normalize(w.Text).Length > 0).ToList();
        int rowY = words.Count == 0 ? 0 : words.GroupBy(w => w.Center.Y / shot.Px(10)).OrderByDescending(g => g.Count()).First().First().Center.Y;
        words = words.Where(w => Math.Abs(w.Center.Y - rowY) <= shot.Px(12)).ToList();
        var names = MaxrollD3PlannerClient.RuneNames(cacheDir, cls, target.Id)
            .Select(r => (r.Letter, Names: (IReadOnlyCollection<string>)new[] { r.Zh, r.En }.Where(n => n.Length > 0).ToArray())).ToList();
        names.Add(("", NoRuneNames));
        var pairs = (from w in words from n in names select (Word: w, n.Letter, Score: n.Names.Max(x => FuzzyText.Similarity(w.Text, x))))
            .Where(p => p.Score >= NameMinSimilarity).OrderByDescending(p => p.Score).ToList();
        var assigned = new Dictionary<string, Word>();
        var used = new HashSet<Word>();
        foreach (var p in pairs)
            if (!assigned.ContainsKey(p.Letter) && used.Add(p.Word)) assigned[p.Letter] = p.Word;
        Word? pick = assigned.GetValueOrDefault(target.Rune);
        string how = "read";
        if (pick == null && words.Except(used).ToList() is [var left] && names.Count(n => !assigned.ContainsKey(n.Letter)) == 1)
        {
            pick = left;
            how = "elimination";
        }
        if (pick == null)
        {
            ColorPrinter.Yellow($"{LogTag} rune '{target.RuneNameZh}' / '{target.RuneNameEn}' not found in [{string.Join(", ", words.Select(w => w.Text))}]");
            return;
        }
        ColorPrinter.Gray($"{LogTag} rune '{target.RuneNameZh}' by {how}: '{pick.Text}'");
        Click(shot, pick.Center);
        Thread.Sleep(AfterRuneClickMs);
    }

    /// <summary>Open chooser: page arrows (templates) -> icon row center line, row bounds and the next-page point (image px).</summary>
    private sealed record Chooser(int RowY, int Left, int Right, (int X, int Y) Next);

    private static Chooser? FindChooser(Shot shot)
    {
        var prev = MatchTemplate(shot, TemplatePagePrev, ArrowThreshold);
        var next = MatchTemplate(shot, TemplatePageNext, ArrowThreshold);
        if (prev is not { } p || next is not { } n || n.CenterX <= p.CenterX) return null;
        return new Chooser((p.CenterY + n.CenterY) / 2, p.X + p.Width, n.X, (n.CenterX, n.CenterY));
    }

    /// <summary>The planned icon in the chooser's icon row; a gray-zone score counts when the OCR'd name under it matches. Click point or null.</summary>
    private static (int X, int Y)? FindInRow(Shot shot, Chooser chooser, Mat icon, PlannerSkill target)
    {
        var row = new Rect(chooser.Left, chooser.RowY - (int)(shot.ClientHeight * RowAboveFrac), chooser.Right - chooser.Left,
            (int)(shot.ClientHeight * (RowAboveFrac + RowBelowFrac))).Intersect(new Rect(0, 0, shot.Image.Cols, shot.Image.Rows));
        if (row.Width <= 0 || row.Height <= 0) return null;
        using var band = new Mat(shot.Image, row);
        var m = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(band, icon, Widths(shot.ClientHeight, IconMinFrac, IconMaxFrac), IconThreshold, target.Id);
        var point = (row.X + m.CenterX, row.Y + m.CenterY);
        if (m.Success) return point;
        if (m.Score < IconGrayZone) return null;
        if (FuzzyText.Best(OcrArea(shot, row), w => w.Text, new[] { target.NameZh, target.NameEn }) is { } label && Math.Abs(label.Item.Center.X - point.Item1) < m.Width)
        {
            ColorPrinter.Gray($"{LogTag} {target.Id}: icon {m.Score:F2} + name '{label.Item.Text}' ({label.Score:F2})");
            return point;
        }
        return null;
    }

    private static Rect Band(Shot shot, Chooser chooser, double topFrac, double bottomFrac) =>
        new Rect(chooser.Left, chooser.RowY + (int)(shot.ClientHeight * topFrac), chooser.Right - chooser.Left, (int)(shot.ClientHeight * (bottomFrac - topFrac)))
            .Intersect(new Rect(0, 0, shot.Image.Cols, shot.Image.Rows));

    // ---------- passives ----------

    /// <summary>Passive chooser from a pane passive slot: put each planned passive not on top yet into a top slot without a planned one, Accept.</summary>
    private static int SetPassives(IReadOnlyList<PlannerNamed> planned, string cls, string cacheDir)
    {
        if (Capture() is not { } pane) return 0;
        Click(pane, pane.ToImage(PanePassiveSlot));
        pane.Image.Dispose();
        Thread.Sleep(AfterClickMs);
        if (Capture() is not { } shot) return 0;
        using var image = shot.Image;
        if (MatchTemplate(shot, TemplateAccept, AcceptThreshold) == null)
        {
            ColorPrinter.Yellow($"{LogTag} passive chooser did not open");
            return 0;
        }
        string Path(string key) => D3SkillIcons.PassiveIconPath(cacheDir, cls, key);
        var plannedKeys = planned.Select(p => p.Id).ToList();
        var onTop = PassiveTopSlots.Select(slot => BestIconAt(shot, slot, plannedKeys, Path)).Select(b => b.Score >= IconThreshold ? b.Key : null).ToList();
        var missing = planned.Where(p => !onTop.Contains(p.Id)).ToList();
        ColorPrinter.Gray($"{LogTag} passives on top: [{string.Join(", ", onTop.Select(k => k ?? "-"))}], missing: [{string.Join(", ", missing.Select(p => p.Id))}]");
        var freeSlots = Enumerable.Range(0, PassiveTopSlots.Length).Where(i => onTop[i] == null).ToList();
        if (missing.Count == 0)
        {
            PressKey(shot, VkEscape);
            Thread.Sleep(AfterKeyMs);
            return 0;
        }
        int changed = 0;
        foreach (var (passive, slot) in missing.Zip(freeSlots))
        {
            using var icon = LoadImage(Path(passive.Id));
            if (icon == null) continue;
            Click(shot, shot.ToImage(PassiveTopSlots[slot]));
            Thread.Sleep(AfterRuneClickMs);
            // the list reflows once a passive is placed: locate on a fresh capture every time
            if (Capture() is not { } now) break;
            using var nowImage = now.Image;
            var (gl, gt) = now.ToImage((PassiveGrid.Left, PassiveGrid.Top));
            var (gr, gb) = now.ToImage((PassiveGrid.Right, PassiveGrid.Bottom));
            var grid = new Rect(gl, gt, gr - gl, gb - gt).Intersect(new Rect(0, 0, nowImage.Cols, nowImage.Rows));
            using var area = new Mat(nowImage, grid);
            var m = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(area, icon, Widths(now.ClientHeight, IconMinFrac, IconMaxFrac), IconThreshold, passive.Id);
            (int X, int Y)? at = m.Success ? (grid.X + m.CenterX, grid.Y + m.CenterY) : null;
            if (at == null && FuzzyText.Best(OcrArea(now, grid), w => w.Text, new[] { passive.NameZh, passive.NameEn }) is { } label)
                at = label.Item.Center;
            if (at is not { } point)
            {
                ColorPrinter.Yellow($"{LogTag} passive {passive.Id} not found in the passive list (icon {m.Score:F2})");
                continue;
            }
            Click(now, point);
            Thread.Sleep(AfterRuneClickMs);
            changed++;
            ColorPrinter.Green($"{LogTag} passive slot {slot} -> {passive.NameEn} (icon {m.Score:F2})");
        }
        if (Capture() is { } after)
        {
            using (after.Image) Accept(after);
        }
        return changed;
    }

    /// <summary>Mismatches after the run: plugin check (skills incl. runes + passives), or the pane slot icons against the planned skills.</summary>
    private static int Verify(SkillSwitchMethod method, Func<SkillCheckResult?>? pluginCheck, PlannerSkill?[] skills, string cls, string cacheDir)
    {
        if (method == SkillSwitchMethod.Plugin && pluginCheck?.Invoke() is { } after)
            return after.Skills.Count(s => s == false) + after.Passives.Count(p => p == false);
        return Enumerable.Range(0, SlotCount).Count(slot => skills[slot] is { } s && !SlotShows(slot, s.Id, cls, cacheDir));
    }

    // ---------- capture, input, matching ----------

    /// <summary>
    /// D3 capture after making D3 the foreground window (idempotent). Image = outer window, Offset = its screen origin, Client = the
    /// client origin inside the image; reference client points map through <see cref="ToImage"/>.
    /// </summary>
    private sealed record Shot(Mat Image, (int X, int Y) Offset, IntPtr Hwnd, (int X, int Y) Client, int ClientWidth, int ClientHeight)
    {
        public double Scale => ClientHeight / RefClientHeight;

        public int Px(int refPx) => Math.Max(1, (int)Math.Round(refPx * Scale));

        /// <summary>Reference client point -> image point (UI scales with the height, centered horizontally).</summary>
        public (int X, int Y) ToImage((int X, int Y) refPoint) =>
            (Client.X + (int)Math.Round(ClientWidth / 2.0 + (refPoint.X - RefClientWidth / 2) * Scale), Client.Y + (int)Math.Round(refPoint.Y * Scale));
    }

    private static Shot? Capture()
    {
        var hwnd = D3WindowFinder.FindWindows().FirstOrDefault()?.Hwnd ?? IntPtr.Zero;
        if (hwnd == IntPtr.Zero) return null;
        ScreenCaptureService.EnsureForeground(hwnd);
        var data = ScreenCaptureService.GetScreenshotProvider().Gen(new ScreenCaptureOptions
        {
            WindowTitles = D3WindowConstants.DiabloIIIWindowTitles,
            WindowOnly = true,
            FindWindows = _ => D3WindowFinder.FindWindows(),
        });
        if (data?.GameWindowImage is not { } bitmap) return null;
        var offset = data.GameWindowRect is { } rect ? (rect.X, rect.Y) : data.WindowOffset;
        using (bitmap)
        {
            var image = BitmapConverter.ToMat(bitmap);
            var client = WindowInputHelper.GetWindowClientRectScreen(hwnd) is { } c
                ? (X: c.Left - offset.Item1, Y: c.Top - offset.Item2, W: c.Right - c.Left, H: c.Bottom - c.Top)
                : (X: 0, Y: 0, W: image.Cols, H: image.Rows);
            return new Shot(image, offset, hwnd, (client.X, client.Y), client.W, client.H);
        }
    }

    private static void Click(Shot shot, (int X, int Y) imagePoint) =>
        StateAwareClickHandler.Instance.LeftClick(shot.Offset.X + imagePoint.X, shot.Offset.Y + imagePoint.Y, 0);

    /// <summary>Key to D3 as window messages (D3 reads posted WM_KEYDOWN / WM_KEYUP; it ignores SendInput keys).</summary>
    private static void PressKey(Shot shot, uint vk) => WindowInputHelper.PressKey(shot.Hwnd, vk);

    private sealed record Word(string Text, (int X, int Y) Center);

    /// <summary>OCR an image area on an OcrUpscale enlargement (small game text); word centers in image px.</summary>
    private static List<Word> OcrArea(Shot shot, Rect area)
    {
        if (area.Width <= 0 || area.Height <= 0 || OcrEngineRegistry.Instance.Default() is not { } engine) return new List<Word>();
        using var crop = new Mat(shot.Image, area);
        using var big = crop.Resize(new OpenCvSharp.Size(), OcrUpscale, OcrUpscale, InterpolationFlags.Cubic);
        var words = new List<Word>();
        foreach (var w in engine.Ocr(big)?.RawResult ?? Array.Empty<OcrWordBox>())
        {
            if (OcrBbox.FromPosition(w.Position) is not { } box) continue;
            var (x, y) = OcrBbox.Center(box);
            words.Add(new Word(w.Text, (area.X + (int)(x / OcrUpscale), area.Y + (int)(y / OcrUpscale))));
        }
        return words;
    }

    /// <summary>Click Accept: its template, else an OCR'd "Accept" word (typo-tolerant), else Escape (nothing changed).</summary>
    private static void Accept(Shot shot)
    {
        if (MatchTemplate(shot, TemplateAccept, AcceptThreshold) is { } button)
            Click(shot, (button.CenterX, button.CenterY));
        else if (FuzzyText.Best(OcrArea(shot, new Rect(0, shot.Image.Rows / 2, shot.Image.Cols, shot.Image.Rows / 2)), w => w.Text, AcceptWords) is { } word)
            Click(shot, word.Item.Center);
        else
        {
            ColorPrinter.Yellow($"{LogTag} Accept button not found, closing the chooser");
            PressKey(shot, VkEscape);
        }
        Thread.Sleep(AfterAcceptMs);
    }

    /// <summary>Template from Templates/skill_switch scaled with the client height; null below the threshold.</summary>
    private static TemplateMatchResult? MatchTemplate(Shot shot, string name, double threshold)
    {
        using var template = LoadImage(Path.Combine(D3TemplatePaths.GetTemplateDir(), TemplateDir, name + D3TemplatePaths.TemplateExtension));
        if (template == null) return null;
        var widths = Enumerable.Range(0, TemplateScaleSteps)
            .Select(i => (int)Math.Round(template.Cols * shot.Scale * (TemplateScaleMin + i * TemplateScaleStep))).ToList();
        var m = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(shot.Image, template, widths, threshold, name);
        return m.Success ? m : null;
    }

    private static IEnumerable<string> SkillKeys(string cls, string cacheDir) => IconKeys(Path.GetDirectoryName(D3SkillIcons.SkillIconPath(cacheDir, cls, "_"))!);

    private static IEnumerable<string> IconKeys(string dir) =>
        Directory.Exists(dir) ? Directory.GetFiles(dir, "*.png").Select(f => Path.GetFileNameWithoutExtension(f)!) : Enumerable.Empty<string>();

    private static Mat? LoadImage(string path)
    {
        if (!File.Exists(path)) return null;
        var image = Cv2.ImRead(path, ImreadModes.Color);
        if (!image.Empty()) return image;
        image.Dispose();
        return null;
    }

    /// <summary>On-screen icon widths to try: fractions of the client height, about SizeStepDivisor steps per height.</summary>
    private static IReadOnlyList<int> Widths(int clientHeight, double minFrac, double maxFrac)
    {
        int step = Math.Max(1, clientHeight / SizeStepDivisor);
        int min = Math.Max(8, (int)(clientHeight * minFrac)), max = (int)(clientHeight * maxFrac);
        var widths = new List<int>();
        for (int w = min; w <= max; w += step) widths.Add(w);
        return widths;
    }
}
