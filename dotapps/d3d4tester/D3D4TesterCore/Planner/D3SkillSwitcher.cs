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
/// Puts the hero's skill bar, runes and passives to a maxroll gear set through the D3 UI (ROSBOT has no skill API; both methods click
/// the same way). Action bar: the class skill icons (planner cache) are matched in the bottom band of the window; six hits sorted
/// left to right are the D3 bar order 1, 2, 3, 4, LMB, RMB (maxroll order LMB, RMB, 1-4). Per slot: click the bar slot, which opens
/// the skill chooser (one skill category per page). Its two page arrows (templates in Templates/skill_switch) give the chooser and the
/// icon row; geometry below the row is relative to the arrows (measured on a 642 px high window, scaled with the height). The planned
/// icon is searched in that row only (the "assigned skill" box further down shows the current skill and must not be clicked); not on
/// this page -> next page arrow, up to MaxPages. A gray-zone icon score is settled by the OCR'd skill name under it. Then the rune area
/// is OCR'd on a 2x upscale and the rune name matched typo-tolerantly (regex normalize + LCS similarity, FuzzyText; OCR misreads
/// characters such as 拳), the assigned box is checked for the planned icon and the Accept button (template) is clicked.
/// Passives: open the skill pane (S), match the class passive icons to find the equipped ones, replace each one not planned by a missing
/// planned passive (click slot, match icon, Accept), close the pane. Other categories are only offered with D3's Elective Mode on; a
/// planned skill on no page stops the run (SkillNotInList).
/// Plugin method: skills_check first (level 70 required; a slot is skipped when its bar icon is already the planned skill and the plugin
/// reports that skill with the planned rune) and again at the end (mismatches). Image method: every slot is set (runes cannot be read
/// from icons), passives from the pane icons, and the end check compares the bar icons.
/// </summary>
public static class D3SkillSwitcher
{
    public const int RequiredLevel = 70;
    private const string LogTag = "[SkillSwitch]";
    public const int SlotCount = 6;
    private const int PassiveCount = 4;
    /// <summary>Bar position (left to right) -> maxroll skill index (0 LMB, 1 RMB, 2-5 keys 1-4).</summary>
    private static readonly int[] BarToPlannerIndex = { 2, 3, 4, 5, 0, 1 };
    private const double BarBandTopFrac = 0.80;
    private const double BarBandLeftFrac = 0.20;
    private const double BarBandRightFrac = 0.80;
    private const double BarIconMinFrac = 0.035;
    private const double BarIconMaxFrac = 0.085;
    private const double ListIconMinFrac = 0.045;
    private const double ListIconMaxFrac = 0.13;
    private const double PassiveIconMinFrac = 0.04;
    private const double PassiveIconMaxFrac = 0.11;
    private const double BarMatchThreshold = 0.70;
    private const double ListMatchThreshold = 0.75;
    private const double PassiveMatchThreshold = 0.75;
    private const int SizeStepDivisor = 300;
    private const int AfterBarClickMs = 700;
    private const int AfterIconClickMs = 450;
    private const int AfterRuneClickMs = 300;
    private const int AfterAcceptMs = 600;
    private const int AfterPaneKeyMs = 900;
    private const ushort VkS = 0x53;
    private const ushort VkEscape = 0x1B;
    private const ushort VkReturn = 0x0D;
    private const int MaxPages = 7;
    private const int AfterPageClickMs = 400;
    private const double ReferenceHeight = 642.0;
    private const double TemplateScaleMin = 0.85;
    private const double TemplateScaleStep = 0.05;
    private const int TemplateScaleSteps = 7;
    private const double ArrowThreshold = 0.85;
    private const double AcceptThreshold = 0.90;
    private const double IconGrayZone = 0.60;
    /// <summary>Chooser geometry relative to the page arrows' center line, in window heights.</summary>
    private const double RowAboveFrac = 0.05;
    private const double RowBelowFrac = 0.065;
    private const double RuneTopFrac = 0.12;
    private const double RuneBottomFrac = 0.33;
    private const double AssignedTopFrac = 0.37;
    private const double AssignedBottomFrac = 0.48;
    private const double OcrUpscale = 2.0;
    private const double RuneMinSimilarity = 0.5;
    private const string TemplateDir = "skill_switch";
    private const string TemplatePagePrev = "skill_page_prev";
    private const string TemplatePageNext = "skill_page_next";
    private const string TemplateAccept = "skill_accept";
    private static readonly string[] AcceptWords = { "接受", "Accept" };

    private sealed record Hit(string Key, Rect Box, double Score);

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
        if (Capture() is not { } first) return Result(SkillSwitchOutcome.NoGameWindow, 0, 0, 0, "D3 window not captured");
        ScreenCaptureService.ActivateWindow(first.Hwnd);
        var bar = FindActionBar(first.Image, cls, cacheDir);
        first.Image.Dispose();
        if (bar.Count != SlotCount) return Result(SkillSwitchOutcome.ActionBarNotFound, 0, 0, 0, $"{bar.Count} of {SlotCount} bar icons found");

        int skillsChanged = 0;
        for (int pos = 0; pos < SlotCount; pos++)
        {
            if (shouldStop()) return Result(SkillSwitchOutcome.Stopped, skillsChanged, 0, 0, "stopped");
            int index = BarToPlannerIndex[pos];
            if (skills[index] is not { } target) continue;
            bool onSlot = bar[pos].Key == target.Id;
            bool pluginOk = before != null && index < before.Skills.Count && before.Skills[index] == true;
            if (onSlot && pluginOk)
            {
                ColorPrinter.Gray($"{LogTag} slot {index}: {target.Id}/{target.Rune} already set");
                continue;
            }
            var step = SetSkill(first.Offset, bar[pos], target, cls, cacheDir);
            if (step == SkillSwitchOutcome.SkillNotInList)
                return Result(SkillSwitchOutcome.SkillNotInList, skillsChanged, 0, 0, target.Id);
            if (step == SkillSwitchOutcome.Done) skillsChanged++;
        }

        int passivesChanged = 0;
        bool passivesOk = before != null && before.Passives.Count == passives.Count && before.Passives.All(p => p == true);
        if (passives.Count > 0 && !passivesOk && !shouldStop())
            passivesChanged = SetPassives(passives.Select(p => p.Id).ToList(), cls, cacheDir);

        int mismatches = Verify(method, pluginCheck, skills, cls, cacheDir);
        var outcome = mismatches == 0 ? SkillSwitchOutcome.Done : SkillSwitchOutcome.Partial;
        return Result(outcome, skillsChanged, passivesChanged, mismatches, $"{skillsChanged} skill(s), {passivesChanged} passive(s) set, {mismatches} mismatch(es)");
    }

    private static SkillSwitchResult Result(SkillSwitchOutcome outcome, int skills, int passives, int mismatches, string detail)
    {
        ColorPrinter.Blue($"{LogTag} {outcome}: {detail}");
        return new SkillSwitchResult(outcome, skills, passives, mismatches, detail);
    }

    /// <summary>Open the slot's skill chooser, find the planned skill (page by page), click it, its rune and Accept.</summary>
    private static SkillSwitchOutcome SetSkill((int X, int Y) offset, Hit slot, PlannerSkill target, string cls, string cacheDir)
    {
        Click(offset, Center(slot.Box));
        Thread.Sleep(AfterBarClickMs);
        using var icon = LoadIcon(D3SkillIcons.SkillIconPath(cacheDir, cls, target.Id));
        if (icon == null) return SkillSwitchOutcome.SkillNotInList;
        Shot? shot = null;
        Chooser? chooser = null;
        try
        {
            for (int page = 0; page < MaxPages; page++)
            {
                shot?.Image.Dispose();
                shot = Capture();
                if (shot == null) return SkillSwitchOutcome.NoGameWindow;
                chooser = FindChooser(shot.Image);
                if (chooser == null)
                {
                    ColorPrinter.Yellow($"{LogTag} skill chooser did not open (page arrows not found)");
                    return SkillSwitchOutcome.ChooserNotOpen;
                }
                if (FindInRow(shot.Image, chooser, icon, target) is { } at)
                {
                    Click(shot.Offset, at);
                    break;
                }
                if (page == MaxPages - 1)
                {
                    ColorPrinter.Yellow($"{LogTag} {target.Id} on no chooser page; turn on Elective Mode in D3's gameplay options");
                    WindowInputHelper.SendSystemKey(VkEscape);
                    return SkillSwitchOutcome.SkillNotInList;
                }
                Click(shot.Offset, chooser.Next);
                Thread.Sleep(AfterPageClickMs);
            }
            Thread.Sleep(AfterIconClickMs);
            shot!.Image.Dispose();
            shot = Capture();
            if (shot == null) return SkillSwitchOutcome.NoGameWindow;
            int h = shot.Image.Rows;
            var runeArea = Band(shot.Image, chooser!, RuneTopFrac, RuneBottomFrac);
            var runes = OcrArea(shot.Image, runeArea);
            if (target.Rune.Length > 0)
            {
                if (FuzzyText.Best(runes, w => w.Text, new[] { target.RuneNameZh, target.RuneNameEn }, RuneMinSimilarity) is { } rune)
                {
                    ColorPrinter.Gray($"{LogTag} rune read '{rune.Item.Text}' ~ '{target.RuneNameZh}' ({rune.Score:F2})");
                    Click(shot.Offset, rune.Item.Center);
                    Thread.Sleep(AfterRuneClickMs);
                }
                else
                    ColorPrinter.Yellow($"{LogTag} rune '{target.RuneNameZh}' / '{target.RuneNameEn}' not read in [{string.Join(", ", runes.Select(r => r.Text))}]");
            }
            var assigned = Band(shot.Image, chooser!, AssignedTopFrac, AssignedBottomFrac);
            using (var box = new Mat(shot.Image, assigned))
            {
                var check = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(box, icon, Widths(h, ListIconMinFrac, ListIconMaxFrac), ListMatchThreshold, target.Id);
                if (!check.Success) ColorPrinter.Yellow($"{LogTag} assigned box does not show {target.Id} yet (score {check.Score:F2})");
            }
            Accept(shot);
            ColorPrinter.Green($"{LogTag} slot {target.SlotIndex}: {target.NameEn} / {target.RuneNameEn}");
            return SkillSwitchOutcome.Done;
        }
        finally
        {
            shot?.Image.Dispose();
        }
    }

    /// <summary>Open chooser: page arrows (templates) -> icon row center line and the two arrow points.</summary>
    private sealed record Chooser(int RowY, int Left, int Right, (int X, int Y) Next);

    private static Chooser? FindChooser(Mat image)
    {
        var prev = MatchTemplate(image, TemplatePagePrev, ArrowThreshold);
        var next = MatchTemplate(image, TemplatePageNext, ArrowThreshold);
        if (prev is not { } p || next is not { } n || n.CenterX <= p.CenterX) return null;
        return new Chooser((p.CenterY + n.CenterY) / 2, p.X + p.Width, n.X, (n.CenterX, n.CenterY));
    }

    /// <summary>
    /// The planned icon in the chooser's icon row (between the arrows); a gray-zone score is accepted when the OCR'd name under that
    /// spot matches the planned skill name (typo-tolerant). Click point or null (not on this page).
    /// </summary>
    private static (int X, int Y)? FindInRow(Mat image, Chooser chooser, Mat icon, PlannerSkill target)
    {
        int h = image.Rows;
        var row = new Rect(chooser.Left, Math.Max(0, chooser.RowY - (int)(h * RowAboveFrac)), chooser.Right - chooser.Left, (int)(h * (RowAboveFrac + RowBelowFrac)));
        row = row.Intersect(new Rect(0, 0, image.Cols, h));
        if (row.Width <= 0 || row.Height <= 0) return null;
        using var band = new Mat(image, row);
        var m = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(band, icon, Widths(h, ListIconMinFrac, ListIconMaxFrac), ListMatchThreshold, target.Id);
        var point = (row.X + m.CenterX, row.Y + m.CenterY);
        if (m.Success) return point;
        if (m.Score < IconGrayZone) return null;
        var labels = OcrArea(image, row);
        if (FuzzyText.Best(labels, w => w.Text, new[] { target.NameZh, target.NameEn }) is { } label && Math.Abs(label.Item.Center.X - point.Item1) < m.Width)
        {
            ColorPrinter.Gray($"{LogTag} {target.Id}: icon {m.Score:F2} + name '{label.Item.Text}' ({label.Score:F2})");
            return point;
        }
        return null;
    }

    /// <summary>Horizontal band of the chooser between the arrows, from / to fractions of the window height below the icon row.</summary>
    private static Rect Band(Mat image, Chooser chooser, double topFrac, double bottomFrac)
    {
        int h = image.Rows;
        var band = new Rect(chooser.Left, chooser.RowY + (int)(h * topFrac), chooser.Right - chooser.Left, (int)(h * (bottomFrac - topFrac)));
        return band.Intersect(new Rect(0, 0, image.Cols, h));
    }

    private sealed record Word(string Text, (int X, int Y) Center);

    /// <summary>OCR an area of the window on an OcrUpscale enlargement (small game text); words with centers in window coordinates.</summary>
    private static List<Word> OcrArea(Mat image, Rect area)
    {
        if (area.Width <= 0 || area.Height <= 0 || OcrEngineRegistry.Instance.Default() is not { } engine) return new List<Word>();
        using var crop = new Mat(image, area);
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

    /// <summary>Template from Templates/skill_switch scaled with the window height; null below the threshold.</summary>
    private static TemplateMatchResult? MatchTemplate(Mat image, string name, double threshold)
    {
        string path = Path.Combine(D3TemplatePaths.GetTemplateDir(), TemplateDir, name + D3TemplatePaths.TemplateExtension);
        using var template = LoadIcon(path);
        if (template == null) return null;
        double k = image.Rows / ReferenceHeight;
        var widths = Enumerable.Range(0, TemplateScaleSteps).Select(i => (int)Math.Round(template.Cols * k * (TemplateScaleMin + i * TemplateScaleStep))).ToList();
        var m = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(image, template, widths, threshold, name);
        return m.Success ? m : null;
    }

    /// <summary>Skill pane: replace every equipped passive that is not planned by a missing planned one; number replaced.</summary>
    private static int SetPassives(IReadOnlyList<string> planned, string cls, string cacheDir)
    {
        WindowInputHelper.SendSystemKey(VkS);
        Thread.Sleep(AfterPaneKeyMs);
        int changed = 0;
        try
        {
            if (Capture() is not { } shot) return 0;
            List<Hit> equipped;
            using (var image = shot.Image) equipped = FindIcons(image, PassiveKeys(cls, cacheDir), key => D3SkillIcons.PassiveIconPath(cacheDir, cls, key),
                Widths(image.Rows, PassiveIconMinFrac, PassiveIconMaxFrac), PassiveMatchThreshold);
            var missing = planned.Where(p => equipped.All(e => e.Key != p)).ToList();
            var free = equipped.Where(e => !planned.Contains(e.Key)).ToList();
            if (missing.Count > free.Count)
                ColorPrinter.Yellow($"{LogTag} {missing.Count} planned passive(s) missing but only {free.Count} equipped slot(s) found to replace (empty slots are not detected)");
            foreach (var (key, slot) in missing.Zip(free))
            {
                Click(shot.Offset, Center(slot.Box));
                Thread.Sleep(AfterBarClickMs);
                if (Capture() is not { } list) break;
                using var image = list.Image;
                using var icon = LoadIcon(D3SkillIcons.PassiveIconPath(cacheDir, cls, key));
                if (icon == null) continue;
                image.Rectangle(slot.Box, Scalar.Black, -1);
                var match = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(image, icon, Widths(image.Rows, PassiveIconMinFrac, PassiveIconMaxFrac), PassiveMatchThreshold, key);
                if (!match.Success)
                {
                    ColorPrinter.Yellow($"{LogTag} passive {key} not found in the list (score {match.Score:F2})");
                    WindowInputHelper.SendSystemKey(VkEscape);
                    continue;
                }
                Click(list.Offset, (match.CenterX, match.CenterY));
                Thread.Sleep(AfterIconClickMs);
                using (var after = Capture()?.Image)
                    if (after != null) Accept(list with { Image = after });
                changed++;
                ColorPrinter.Green($"{LogTag} passive {slot.Key} -> {key}");
            }
        }
        finally
        {
            WindowInputHelper.SendSystemKey(VkEscape);
        }
        return changed;
    }

    /// <summary>Mismatches after the run: plugin check (skills incl. runes + passives) or the bar icons against the planned skills.</summary>
    private static int Verify(SkillSwitchMethod method, Func<SkillCheckResult?>? pluginCheck, PlannerSkill?[] skills, string cls, string cacheDir)
    {
        if (method == SkillSwitchMethod.Plugin && pluginCheck?.Invoke() is { } after)
            return after.Skills.Count(s => s == false) + after.Passives.Count(p => p == false);
        if (Capture() is not { } shot) return SlotCount;
        using var image = shot.Image;
        var bar = FindActionBar(image, cls, cacheDir);
        if (bar.Count != SlotCount) return SlotCount;
        return Enumerable.Range(0, SlotCount).Count(pos => skills[BarToPlannerIndex[pos]] is { } s && bar[pos].Key != s.Id);
    }

    /// <summary>Six class skill icons in the bottom band, left to right (fewer when not all are recognized).</summary>
    private static List<Hit> FindActionBar(Mat image, string cls, string cacheDir)
    {
        int top = (int)(image.Rows * BarBandTopFrac), left = (int)(image.Cols * BarBandLeftFrac), right = (int)(image.Cols * BarBandRightFrac);
        using var band = new Mat(image, new Rect(left, top, right - left, image.Rows - top));
        var hits = FindIcons(band, SkillKeys(cls, cacheDir), key => D3SkillIcons.SkillIconPath(cacheDir, cls, key),
            Widths(image.Rows, BarIconMinFrac, BarIconMaxFrac), BarMatchThreshold);
        return hits.Select(h => h with { Box = new Rect(h.Box.X + left, h.Box.Y + top, h.Box.Width, h.Box.Height) }).OrderBy(h => h.Box.X).ToList();
    }

    /// <summary>Best match of every icon; overlapping hits keep the higher score (one icon per screen spot).</summary>
    private static List<Hit> FindIcons(Mat area, IEnumerable<string> keys, Func<string, string> iconPath, IReadOnlyList<int> widths, double threshold)
    {
        var matcher = TemplateMatcherService.GetTemplateMatcher();
        var hits = new List<Hit>();
        foreach (var key in keys)
        {
            using var icon = LoadIcon(iconPath(key));
            if (icon == null) continue;
            var m = matcher.MatchMultiScale(area, icon, widths, threshold, key);
            if (m.Success) hits.Add(new Hit(key, new Rect(m.X, m.Y, m.Width, m.Height), m.Score));
        }
        var kept = new List<Hit>();
        foreach (var h in hits.OrderByDescending(h => h.Score))
            if (kept.All(k => (k.Box & h.Box).Width * 2 < Math.Min(k.Box.Width, h.Box.Width))) kept.Add(h);
        return kept;
    }

    private static IEnumerable<string> SkillKeys(string cls, string cacheDir) => IconKeys(Path.GetDirectoryName(D3SkillIcons.SkillIconPath(cacheDir, cls, "_"))!);

    private static IEnumerable<string> PassiveKeys(string cls, string cacheDir) => IconKeys(Path.GetDirectoryName(D3SkillIcons.PassiveIconPath(cacheDir, cls, "_"))!);

    private static IEnumerable<string> IconKeys(string dir) =>
        Directory.Exists(dir) ? Directory.GetFiles(dir, "*.png").Select(f => Path.GetFileNameWithoutExtension(f)!) : Enumerable.Empty<string>();

    private static Mat? LoadIcon(string path)
    {
        if (!File.Exists(path)) return null;
        var icon = Cv2.ImRead(path, ImreadModes.Color);
        if (!icon.Empty()) return icon;
        icon.Dispose();
        return null;
    }

    /// <summary>On-screen icon widths to try: fractions of the window height, about SizeStepDivisor steps per window height.</summary>
    private static IReadOnlyList<int> Widths(int windowHeight, double minFrac, double maxFrac)
    {
        int step = Math.Max(1, windowHeight / SizeStepDivisor);
        int min = Math.Max(8, (int)(windowHeight * minFrac)), max = (int)(windowHeight * maxFrac);
        var widths = new List<int>();
        for (int w = min; w <= max; w += step) widths.Add(w);
        return widths;
    }

    private sealed record Shot(Mat Image, (int X, int Y) Offset, IntPtr Hwnd);

    private static Shot? Capture()
    {
        var hwnd = D3WindowFinder.FindWindows().FirstOrDefault()?.Hwnd ?? IntPtr.Zero;
        var data = ScreenCaptureService.GetScreenshotProvider().Gen(new ScreenCaptureOptions
        {
            WindowTitles = D3WindowConstants.DiabloIIIWindowTitles,
            WindowOnly = true,
            FindWindows = _ => D3WindowFinder.FindWindows(),
        });
        if (data?.GameWindowImage is not { } bitmap) return null;
        var offset = data.GameWindowRect is { } rect ? (rect.X, rect.Y) : data.WindowOffset;
        using (bitmap) return new Shot(BitmapConverter.ToMat(bitmap), offset, hwnd);
    }

    /// <summary>Click Accept: its template, else an OCR'd "Accept" word (typo-tolerant), else Enter.</summary>
    private static void Accept(Shot shot)
    {
        if (MatchTemplate(shot.Image, TemplateAccept, AcceptThreshold) is { } button)
            Click(shot.Offset, (button.CenterX, button.CenterY));
        else if (FuzzyText.Best(OcrArea(shot.Image, new Rect(0, shot.Image.Rows / 2, shot.Image.Cols, shot.Image.Rows / 2)), w => w.Text, AcceptWords) is { } word)
            Click(shot.Offset, word.Item.Center);
        else
        {
            ColorPrinter.Yellow($"{LogTag} Accept button not found, pressing Enter");
            WindowInputHelper.SendSystemKey(VkReturn);
        }
        Thread.Sleep(AfterAcceptMs);
    }

    private static (int X, int Y) Center(Rect r) => (r.X + r.Width / 2, r.Y + r.Height / 2);

    private static void Click((int X, int Y) offset, (int X, int Y) point) =>
        StateAwareClickHandler.Instance.LeftClick(offset.X + point.X, offset.Y + point.Y, 0);
}
