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
/// Redundancy: D3 drops a click that only activates it, and other programs may take the foreground meanwhile, so every click / key is
/// followed by a fresh capture that must show the expected screen (<see cref="UiState"/>: game menu, skill chooser, passive chooser,
/// skill pane, world) and is repeated up to Attempts times; opening / closing goes state by state (game menu -> Return, chooser -> Escape,
/// pane -> Escape / S), never by a blind key count. Before every capture that reads the chooser the cursor is parked outside the
/// dialog: the tooltip of the icon just clicked would cover the rune row and the passive list.
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
    private static readonly (int X, int Y)[] PanePassiveSlots = { (354, 381), (474, 381), (594, 381), (714, 381) };
    /// <summary>Cursor rest point outside every skill dialog (reference client px), so no tooltip covers what is read next.</summary>
    private static readonly (int X, int Y) CursorPark = (1040, 560);
    private const int ParkSettleMs = 250;
    private const int CaptureRetryMs = 400;
    private const string DebugTimeFormat = "HHmmss_fff";
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
    private const string TemplateGameMenuReturn = "game_menu_return";
    private const double GameMenuThreshold = 0.88;
    private const int Attempts = 3;
    private const int MaxStateSteps = 6;
    private static readonly string[] NoRuneNames = { "无符文", "No Rune" };
    private static readonly string[] AcceptWords = { "接受", "Accept" };

    /// <summary>When set, captures of failed recognitions are saved here (diagnostics).</summary>
    public static string? DebugDir { get; set; }

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
            int mismatches = Verify(method, pluginCheck, skills, passives, cls, cacheDir);
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

    /// <summary>What D3 shows: checked in this order (a chooser covers the pane, the game menu covers everything).</summary>
    private enum UiState { GameMenu, SkillChooser, PassiveChooser, Pane, World, NoWindow }

    private static UiState State(string cls, string cacheDir)
    {
        if (Capture() is not { } shot) return UiState.NoWindow;
        using (shot.Image) return State(shot, cls, cacheDir);
    }

    private static UiState State(Shot shot, string cls, string cacheDir)
    {
        if (MatchTemplate(shot, TemplateGameMenuReturn, GameMenuThreshold) != null) return UiState.GameMenu;
        if (FindChooser(shot) != null) return UiState.SkillChooser;
        if (MatchTemplate(shot, TemplateAccept, AcceptThreshold) != null) return UiState.PassiveChooser;
        var keys = SkillKeys(cls, cacheDir).ToList();
        int icons = Enumerable.Range(0, SlotCount).Count(slot => BestIconAt(shot, PaneSlotIcon[slot], keys, key => D3SkillIcons.SkillIconPath(cacheDir, cls, key)).Score >= IconThreshold);
        return icons >= PaneOpenMinIcons ? UiState.Pane : UiState.World;
    }

    /// <summary>
    /// Bring D3 to the wanted screen one step at a time (idempotent): game menu -> Return (Escape when its button is not found),
    /// chooser -> Escape (back to the pane), pane -> Escape (world) or world -> S (pane). False when it is not reached in MaxStateSteps.
    /// </summary>
    private static bool ToState(UiState wanted, string cls, string cacheDir)
    {
        for (int step = 0; step < MaxStateSteps; step++)
        {
            if (Capture() is not { } shot) return false;
            using var image = shot.Image;
            var state = State(shot, cls, cacheDir);
            if (state == wanted) return true;
            switch (state)
            {
                case UiState.GameMenu:
                    if (MatchTemplate(shot, TemplateGameMenuReturn, GameMenuThreshold) is { } ret) Click(shot, (ret.CenterX, ret.CenterY));
                    else PressKey(shot, VkEscape);
                    break;
                case UiState.SkillChooser or UiState.PassiveChooser:
                    PressKey(shot, VkEscape);
                    break;
                case UiState.Pane:
                    PressKey(shot, VkEscape);
                    break;
                case UiState.World:
                    PressKey(shot, VkS);
                    break;
                default:
                    return false;
            }
            ColorPrinter.Gray($"{LogTag} screen {state} -> {wanted}");
            Thread.Sleep(AfterKeyMs);
        }
        ColorPrinter.Yellow($"{LogTag} could not reach {wanted} in {MaxStateSteps} steps");
        return false;
    }

    private static bool OpenPane(string cls, string cacheDir) => ToState(UiState.Pane, cls, cacheDir);

    private static void ClosePane(string cls, string cacheDir) => ToState(UiState.World, cls, cacheDir);

    /// <summary>
    /// Click a point (computed on a fresh capture) until a fresh capture shows the expected screen, at most Attempts times; D3 drops a
    /// click that only activates its window, and another program may take the foreground in between.
    /// </summary>
    private static bool ClickUntil(Func<Shot, (int X, int Y)?> point, UiState expected, string what, string cls, string cacheDir)
    {
        for (int attempt = 1; attempt <= Attempts; attempt++)
        {
            if (Capture() is not { } shot) return false;
            using (shot.Image)
            {
                if (point(shot) is not { } at)
                {
                    ColorPrinter.Yellow($"{LogTag} {what}: target not on screen");
                    return false;
                }
                Click(shot, at);
            }
            Thread.Sleep(AfterClickMs);
            var state = State(cls, cacheDir);
            if (state == expected) return true;
            ColorPrinter.Yellow($"{LogTag} {what}: attempt {attempt} shows {state}, expected {expected}");
        }
        return false;
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
        if (!ClickUntil(sh => sh.ToImage(PaneSlotClick[slot]), UiState.SkillChooser, $"slot {slot} box", cls, cacheDir))
            return SkillSwitchOutcome.ChooserNotOpen;
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
                if (FindInRow(shot, chooser, icon, target) is not null)
                {
                    if (!PickUntilAssigned(icon, target, cls, cacheDir)) return SkillSwitchOutcome.ChooserNotOpen;
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
            Park(shot!);
            shot!.Image.Dispose();
            shot = Capture();
            if (shot == null) return SkillSwitchOutcome.NoGameWindow;
            chooser = FindChooser(shot) ?? chooser!;
            if (target.Rune.Length > 0) SelectRune(shot, chooser, target, cls, cacheDir);
            if (!AcceptUntil(UiState.Pane, cls, cacheDir)) return SkillSwitchOutcome.ChooserNotOpen;
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
    /// planned rune's word, else the single word left over when every other name found its word (elimination). The click goes to the
    /// rune icon above the name (Word.IconAbove), not the name.
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
            SaveDebug(shot, $"rune_{target.Id}");
            return;
        }
        ColorPrinter.Gray($"{LogTag} rune '{target.RuneNameZh}' by {how}: '{pick.Text}'");
        Click(shot, pick.IconAbove);
        Thread.Sleep(AfterRuneClickMs);
    }

    /// <summary>Click the planned icon in the current page's row until the assigned box shows it (fresh capture each attempt).</summary>
    private static bool PickUntilAssigned(Mat icon, PlannerSkill target, string cls, string cacheDir)
    {
        for (int attempt = 1; attempt <= Attempts; attempt++)
        {
            if (Capture() is not { } shot) return false;
            using (shot.Image)
            {
                if (FindChooser(shot) is not { } chooser || FindInRow(shot, chooser, icon, target) is not { } at) return false;
                Click(shot, at);
                Thread.Sleep(AfterIconClickMs);
                Park(shot);
            }
            if (Capture() is not { } after) return false;
            using (after.Image)
            {
                if (FindChooser(after) is not { } chooser) return false;
                using var box = new Mat(after.Image, Band(after, chooser, AssignedTopFrac, AssignedBottomFrac));
                var check = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(box, icon, Widths(after.ClientHeight, IconMinFrac, IconMaxFrac), IconThreshold, target.Id);
                if (check.Success) return true;
                ColorPrinter.Yellow($"{LogTag} {target.Id}: attempt {attempt}, assigned box not updated (score {check.Score:F2})");
            }
        }
        return false;
    }

    /// <summary>Click Accept until the chooser is gone (the expected screen shows).</summary>
    private static bool AcceptUntil(UiState expected, string cls, string cacheDir) =>
        ClickUntil(sh => MatchTemplate(sh, TemplateAccept, AcceptThreshold) is { } b ? (b.CenterX, b.CenterY)
            : FuzzyText.Best(OcrArea(sh, new Rect(0, sh.Image.Rows / 2, sh.Image.Cols, sh.Image.Rows / 2)), w => w.Text, AcceptWords)?.Item.Center,
            expected, "accept", cls, cacheDir);

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

    /// <summary>
    /// Passive chooser from a pane passive slot: put each planned passive not on top yet into a top slot without a planned one, each
    /// placement checked on a fresh capture (the list reflows after every placement) and repeated up to Attempts times; then Accept.
    /// </summary>
    private static int SetPassives(IReadOnlyList<PlannerNamed> planned, string cls, string cacheDir)
    {
        if (!ToState(UiState.Pane, cls, cacheDir)) return 0;
        if (!ClickUntil(sh => sh.ToImage(PanePassiveSlot), UiState.PassiveChooser, "passive slot", cls, cacheDir)) return 0;
        string Path(string key) => D3SkillIcons.PassiveIconPath(cacheDir, cls, key);
        var plannedKeys = planned.Select(p => p.Id).ToList();
        List<string?> onTop;
        if (Capture() is not { } parkShot) return 0;
        using (parkShot.Image) Park(parkShot);
        if (Capture() is not { } first) return 0;
        using (first.Image)
            onTop = PassiveTopSlots.Select(slot => BestIconAt(first, slot, plannedKeys, Path)).Select(b => b.Score >= IconThreshold ? b.Key : null).ToList();
        var missing = planned.Where(p => !onTop.Contains(p.Id)).ToList();
        var freeSlots = Enumerable.Range(0, PassiveTopSlots.Length).Where(i => onTop[i] == null).ToList();
        ColorPrinter.Gray($"{LogTag} passives on top: [{string.Join(", ", onTop.Select(k => k ?? "-"))}], missing: [{string.Join(", ", missing.Select(p => p.Id))}]");
        if (missing.Count == 0)
        {
            ToState(UiState.Pane, cls, cacheDir);
            return 0;
        }
        int changed = 0;
        foreach (var (passive, slot) in missing.Zip(freeSlots))
        {
            using var icon = LoadImage(Path(passive.Id));
            if (icon == null) continue;
            for (int attempt = 1; attempt <= Attempts; attempt++)
            {
                if (PlacePassive(passive, slot, icon, cls, cacheDir))
                {
                    changed++;
                    break;
                }
                ColorPrinter.Yellow($"{LogTag} passive {passive.Id}: attempt {attempt} not on top slot {slot}");
            }
        }
        if (!AcceptUntil(UiState.Pane, cls, cacheDir)) ToState(UiState.Pane, cls, cacheDir);
        return changed;
    }

    /// <summary>Select the top slot, click the passive in the list (icon, else its OCR'd name), true when the top slot then shows it.</summary>
    private static bool PlacePassive(PlannerNamed passive, int slot, Mat icon, string cls, string cacheDir)
    {
        string Path(string key) => D3SkillIcons.PassiveIconPath(cacheDir, cls, key);
        if (Capture() is not { } shot) return false;
        using (shot.Image)
        {
            Click(shot, shot.ToImage(PassiveTopSlots[slot]));
            Thread.Sleep(AfterRuneClickMs);
            Park(shot);
        }
        if (Capture() is not { } now) return false;
        using (now.Image)
        {
            var (gl, gt) = now.ToImage((PassiveGrid.Left, PassiveGrid.Top));
            var (gr, gb) = now.ToImage((PassiveGrid.Right, PassiveGrid.Bottom));
            var grid = new Rect(gl, gt, gr - gl, gb - gt).Intersect(new Rect(0, 0, now.Image.Cols, now.Image.Rows));
            using var area = new Mat(now.Image, grid);
            var m = TemplateMatcherService.GetTemplateMatcher().MatchMultiScale(area, icon, Widths(now.ClientHeight, IconMinFrac, IconMaxFrac), IconThreshold, passive.Id);
            (int X, int Y)? at = m.Success ? (grid.X + m.CenterX, grid.Y + m.CenterY) : null;
            string how = $"icon {m.Score:F2}";
            if (at == null && FuzzyText.Best(OcrArea(now, grid), w => w.Text, new[] { passive.NameZh, passive.NameEn }) is { } label)
            {
                at = label.Item.Center;
                how = $"name '{label.Item.Text}' ({label.Score:F2}), icon {m.Score:F2}";
            }
            if (at is not { } point)
            {
                ColorPrinter.Yellow($"{LogTag} passive {passive.Id} not found in the list (icon {m.Score:F2})");
                SaveDebug(now, $"passive_{passive.Id}");
                return false;
            }
            ColorPrinter.Gray($"{LogTag} passive {passive.Id} by {how}");
            Click(now, point);
            Thread.Sleep(AfterRuneClickMs);
            Park(now);
        }
        if (Capture() is not { } after) return false;
        using (after.Image)
        {
            bool placed = BestIconAt(after, PassiveTopSlots[slot], new[] { passive.Id }, Path).Score >= IconThreshold;
            if (placed) ColorPrinter.Green($"{LogTag} passive slot {slot} -> {passive.NameEn}");
            return placed;
        }
    }

    /// <summary>Mismatches after the run: plugin check (skills incl. runes + passives), or the pane slot icons against the planned skills.</summary>
    private static int Verify(SkillSwitchMethod method, Func<SkillCheckResult?>? pluginCheck, PlannerSkill?[] skills, IReadOnlyList<PlannerNamed> passives, string cls, string cacheDir)
    {
        if (method == SkillSwitchMethod.Plugin && pluginCheck?.Invoke() is { } after)
            return after.Skills.Count(s => s == false) + after.Passives.Count(p => p == false);
        int skillMismatches = Enumerable.Range(0, SlotCount).Count(slot => skills[slot] is { } s && !SlotShows(slot, s.Id, cls, cacheDir));
        if (passives.Count == 0 || Capture() is not { } shot) return skillMismatches;
        using (shot.Image)
        {
            Park(shot);
        }
        if (Capture() is not { } pane) return skillMismatches;
        using (pane.Image)
        {
            var keys = passives.Select(p => p.Id).ToList();
            var shown = PanePassiveSlots.Select(slot => BestIconAt(pane, slot, keys, k => D3SkillIcons.PassiveIconPath(cacheDir, cls, k)))
                .Where(b => b.Score >= IconThreshold).Select(b => b.Key).ToHashSet();
            int passiveMismatches = keys.Count(k => !shown.Contains(k));
            if (passiveMismatches > 0) ColorPrinter.Yellow($"{LogTag} passives missing in the pane: {string.Join(", ", keys.Where(k => !shown.Contains(k)))}");
            return skillMismatches + passiveMismatches;
        }
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

    /// <summary>D3 capture with retries: a capture fails while the window is moved, restored or briefly replaced by another window.</summary>
    private static Shot? Capture()
    {
        for (int attempt = 1; attempt <= Attempts; attempt++)
        {
            if (CaptureOnce() is { } shot) return shot;
            Thread.Sleep(CaptureRetryMs);
        }
        ColorPrinter.Yellow($"{LogTag} D3 window not captured after {Attempts} attempts");
        return null;
    }

    private static Shot? CaptureOnce()
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

    /// <summary>Move the cursor to the rest point outside the dialogs (no click) and let the tooltip fade.</summary>
    private static void Park(Shot shot)
    {
        var (x, y) = shot.ToImage(CursorPark);
        StateAwareClickHandler.Instance.MoveMouse(shot.Offset.X + x, shot.Offset.Y + y, 0);
        Thread.Sleep(ParkSettleMs);
    }

    private static void SaveDebug(Shot shot, string name)
    {
        if (string.IsNullOrEmpty(DebugDir)) return;
        try
        {
            Directory.CreateDirectory(DebugDir);
            Cv2.ImWrite(Path.Combine(DebugDir, $"{name}_{DateTime.Now.ToString(DebugTimeFormat, System.Globalization.CultureInfo.InvariantCulture)}.png"), shot.Image);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException or OpenCVException)
        {
            ColorPrinter.Yellow($"{LogTag} debug capture not saved: {ex.Message}");
        }
    }

    private static void Click(Shot shot, (int X, int Y) imagePoint) =>
        StateAwareClickHandler.Instance.LeftClick(shot.Offset.X + imagePoint.X, shot.Offset.Y + imagePoint.Y, 0);

    /// <summary>Key to D3 as window messages (D3 reads posted WM_KEYDOWN / WM_KEYUP; it ignores SendInput keys).</summary>
    private static void PressKey(Shot shot, uint vk) => WindowInputHelper.PressKey(shot.Hwnd, vk);

    /// <summary>OCR word: text, center and top edge / height of its box (image px).</summary>
    private sealed record Word(string Text, (int X, int Y) Center, int Top, int Height)
    {
        /// <summary>Rune icon above its name: one text height above the text's top edge (the name itself is not clickable).</summary>
        public (int X, int Y) IconAbove => (Center.X, Top - Height);
    }

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
            words.Add(new Word(w.Text, (area.X + (int)(x / OcrUpscale), area.Y + (int)(y / OcrUpscale)),
                area.Y + (int)(box.MinY / OcrUpscale), Math.Max(1, (int)((box.MaxY - box.MinY) / OcrUpscale))));
        }
        return words;
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
