// PY-REF: none (DOT-only)
using System.Drawing;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.TemplateMatcher;
using DotCore.Utils;
using DotCore.Utils.Ocr;
using OpenCvSharp;
using OpenCvSharp.Extensions;

namespace DotApps.d3d4tester.Core.Planner;

/// <summary>How the skill switch reads the hero's current skills: the ROSBOT plugin (exact skills / runes / passives / level) or images only.</summary>
public enum SkillSwitchMethod { Plugin, Image }

/// <summary>Result of a switch run; Outcome drives the UI text, the counts the detail.</summary>
public enum SkillSwitchOutcome { Done, Partial, NoGameWindow, LevelTooLow, ActionBarNotFound, SkillNotInList, PluginUnavailable, Stopped }

/// <summary>Plugin skills_check answer: hero level (0 = unknown) and per target true / false / null (unknown) for skills (incl. rune) and passives.</summary>
public sealed record SkillCheckResult(int Level, IReadOnlyList<bool?> Skills, IReadOnlyList<bool?> Passives);

public sealed record SkillSwitchResult(SkillSwitchOutcome Outcome, int SkillsChanged, int PassivesChanged, int Mismatches, string Detail);

/// <summary>
/// Puts the hero's skill bar, runes and passives to a maxroll gear set through the D3 UI (ROSBOT has no skill API; both methods click
/// the same way). Action bar: the class skill icons (planner cache) are matched in the bottom band of the window; six hits sorted
/// left to right are the D3 bar order 1, 2, 3, 4, LMB, RMB (maxroll order LMB, RMB, 1-4). Per slot: click the bar slot (opens its skill
/// list), match and click the planned skill icon, OCR the window for the planned rune name (Chinese or English) and the Accept button,
/// click both. Passives: open the skill pane (S), match the class passive icons to find the equipped ones, replace each one not planned
/// by a missing planned passive (click slot, match icon, Accept), close the pane. The skill list only offers every skill with D3's
/// Elective Mode on; a planned skill not found there stops the run (SkillNotInList).
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
    private static readonly string[] AcceptWords = { "接受", "接收", "Accept" };

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

    /// <summary>Open the slot's skill list, click the planned skill, its rune (OCR) and Accept.</summary>
    private static SkillSwitchOutcome SetSkill((int X, int Y) offset, Hit slot, PlannerSkill target, string cls, string cacheDir)
    {
        Click(offset, Center(slot.Box));
        Thread.Sleep(AfterBarClickMs);
        if (Capture() is not { } shot) return SkillSwitchOutcome.NoGameWindow;
        using var image = shot.Image;
        using var icon = LoadIcon(D3SkillIcons.SkillIconPath(cacheDir, cls, target.Id));
        if (icon == null) return SkillSwitchOutcome.SkillNotInList;
        int listBottom = (int)(image.Rows * BarBandTopFrac);
        using var list = new Mat(image, new Rect(0, 0, image.Cols, listBottom));
        var match = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(list, icon, Widths(image.Rows, ListIconMinFrac, ListIconMaxFrac), ListMatchThreshold, target.Id);
        if (!match.Success)
        {
            ColorPrinter.Yellow($"{LogTag} {target.Id} not in the skill list (score {match.Score:F2}); turn on Elective Mode in D3's gameplay options");
            WindowInputHelper.SendSystemKey(VkEscape);
            return SkillSwitchOutcome.SkillNotInList;
        }
        Click(shot.Offset, (match.CenterX, match.CenterY));
        Thread.Sleep(AfterIconClickMs);
        var words = Ocr();
        if (FindWord(words, target.RuneNameZh, target.RuneNameEn) is { } rune)
        {
            Click(shot.Offset, rune);
            Thread.Sleep(AfterRuneClickMs);
        }
        else if (target.Rune.Length > 0)
            ColorPrinter.Yellow($"{LogTag} rune '{target.RuneNameZh}' / '{target.RuneNameEn}' not read on screen, skill set without it");
        Accept(shot.Offset, words);
        ColorPrinter.Green($"{LogTag} slot {target.SlotIndex}: {target.NameEn} / {target.RuneNameEn}");
        return SkillSwitchOutcome.Done;
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
                Accept(list.Offset, Ocr());
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

    private static IReadOnlyList<OcrWordBox> Ocr()
    {
        var data = ScreenCaptureService.GetScreenshotProvider().Gen(new ScreenCaptureOptions
        {
            WindowTitles = D3WindowConstants.DiabloIIIWindowTitles,
            WindowOnly = true,
            FindWindows = _ => D3WindowFinder.FindWindows(),
        });
        if (data?.GameWindowImage is not { } bitmap) return Array.Empty<OcrWordBox>();
        using (bitmap) return OcrHelper.GetResult(bitmap)?.RawResult ?? Array.Empty<OcrWordBox>();
    }

    /// <summary>Center (window coordinates) of the first OCR box containing one of the names (spaces ignored, case-insensitive).</summary>
    private static (int X, int Y)? FindWord(IReadOnlyList<OcrWordBox> words, params string[] names)
    {
        var wanted = names.Select(Normalize).Where(n => n.Length > 0).ToList();
        foreach (var w in words)
        {
            string text = Normalize(w.Text);
            if (text.Length == 0 || !wanted.Any(n => text.Contains(n, StringComparison.Ordinal))) continue;
            if (OcrBbox.FromPosition(w.Position) is not { } box) continue;
            var (x, y) = OcrBbox.Center(box);
            return ((int)x, (int)y);
        }
        return null;
    }

    private static void Accept((int X, int Y) offset, IReadOnlyList<OcrWordBox> words)
    {
        if (FindWord(words, AcceptWords) is { } accept) Click(offset, accept);
        else
        {
            ColorPrinter.Yellow($"{LogTag} Accept button not read on screen, pressing Enter");
            WindowInputHelper.SendSystemKey(VkReturn);
        }
        Thread.Sleep(AfterAcceptMs);
    }

    private static string Normalize(string s) => new string((s ?? "").Where(c => !char.IsWhiteSpace(c)).ToArray()).ToLowerInvariant();

    private static (int X, int Y) Center(Rect r) => (r.X + r.Width / 2, r.Y + r.Height / 2);

    private static void Click((int X, int Y) offset, (int X, int Y) point) =>
        StateAwareClickHandler.Instance.LeftClick(offset.X + point.X, offset.Y + point.Y, 0);
}
