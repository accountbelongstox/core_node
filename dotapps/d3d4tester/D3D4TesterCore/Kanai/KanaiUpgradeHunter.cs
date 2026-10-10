// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Globalization;
using DotApps.d3d4tester.Core.Bag;
using DotApps.d3d4tester.Core.Bridge;
using DotApps.d3d4tester.Core.Planner;
using DotCore.Foundations;
using DotCore.ScreenCapture;
using DotCore.Utils.ImagePreprocess;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Kanai;

/// <summary>
/// Kanai's Cube "upgrade rare" until a wanted legendary drops out (or every rare is used). The bag is read from a capture (layout
/// quality per cell), each rare's item type from its art (gems / consumables are skipped; with OnlyCompatibleRares only rares of a
/// target's type are used, otherwise they go first). On the upgrade recipe page each rare is transmuted with the D3KeyHelper sequence
/// (right-click, Fill, Transmute, page away and back). Products are the legendary cells that were not legendary before; each is named
/// by the bridge plugin when it is live (exact item, rank and affixes), else by its icon among the legendaries of its type, and only
/// products whose icon looks like a target are hovered and OCR'd (name, tier line, required affixes). Every step is reported.
/// </summary>
public static class KanaiUpgradeHunter
{
    public const string EventStart = "start";
    public const string EventScan = "scan";
    public const string EventSkip = "skip";
    public const string EventPage = "page";
    public const string EventTransmute = "transmute";
    public const string EventProduct = "product";
    public const string EventTarget = "target";
    public const string EventDone = "done";
    public const string EventError = "error";
    public const string SourcePlugin = "plugin";
    public const string SourceIcon = "icon";
    public const string SourceOcr = "ocr";
    /// <summary>OCR name similarity that confirms a target.</summary>
    public const double OcrNameMin = 0.6;
    private const int SettleAfterPassMs = 300;
    private const string LogTag = "[KanaiUpgrade]";

    /// <summary>Bag overview from a fresh capture (no clicks, no OCR): rares by item type and the targets they can become, legendaries by icon.</summary>
    public static KanaiBagScan Scan(IReadOnlyList<KanaiUpgradeTarget> targets, string cacheDir)
    {
        if (Refresh() is not { } view) return KanaiBagScan.Empty;
        using (view) return Scan(view, targets, cacheDir);
    }

    /// <summary>The same overview of a saved capture (window image BGR, its bag coordinates and layout): offline checks of the recognition.</summary>
    public static KanaiBagScan ScanImage(Mat window, BagCoordinates bag, BagLayout layout, bool kanaiOpen, IReadOnlyList<KanaiUpgradeTarget> targets, string cacheDir)
    {
        using var view = new BagView(window.Clone(), bag, KanaiBagRecognizer.Items(layout, bag), kanaiOpen);
        return Scan(view, targets, cacheDir);
    }

    private static KanaiBagScan Scan(BagView view, IReadOnlyList<KanaiUpgradeTarget> targets, string cacheDir)
    {
        var catalog = D3ItemCatalog.For(cacheDir);
        var wanted = Wanted(targets, catalog);
        var (rares, skipped) = ClassifyRares(view, catalog, wanted);
        var legendaries = view.Items.Where(i => i.IsLegendary).Select(i => IdentifyByIcon(view, i, catalog, wanted, Array.Empty<string>())).ToList();
        return new KanaiBagScan(DateTime.UtcNow, view.KanaiOpen, rares, legendaries, skipped);
    }

    public static KanaiUpgradeRun Run(KanaiUpgradeSettings settings, string build, string profile, Func<bool> shouldStop, Action<KanaiUpgradeEvent>? progress)
    {
        var start = DateTime.UtcNow;
        var watch = Stopwatch.StartNew();
        var products = new List<KanaiUpgradeProduct>();
        var reached = new HashSet<string>(StringComparer.Ordinal);
        int transmutes = 0;
        void Emit(string kind, string detail, bool? ok = null)
        {
            ColorPrinter.Gray($"{LogTag} {kind}: {detail}");
            progress?.Invoke(new KanaiUpgradeEvent(DateTime.Now, kind, detail, ok));
        }
        KanaiUpgradeRun Done(KanaiUpgradeOutcome outcome, string detail)
        {
            Emit(EventDone, $"{outcome}: {detail}, {transmutes} transmute(s), {products.Count} product(s), {watch.Elapsed.TotalSeconds:F1} s",
                outcome is KanaiUpgradeOutcome.TargetReached or KanaiUpgradeOutcome.AllRaresUsed);
            return new KanaiUpgradeRun(start, DateTime.UtcNow, build, profile, transmutes, products, outcome, reached.ToList());
        }

        var catalog = D3ItemCatalog.For(settings.CacheDir);
        var wanted = Wanted(settings.Targets, catalog);
        bool hunting = settings.Stop != KanaiUpgradeStop.Never && wanted.Count > 0;
        Emit(EventStart, hunting
            ? string.Join(", ", wanted.Select(w => $"{w.Target.Item.NameEn} ({TypeLabel(catalog, w.Item?.Type)})"))
            : "upgrade every rare");
        if (Refresh() is not { } first) return Done(KanaiUpgradeOutcome.NotReady, "no D3 capture / bag");
        List<KanaiRareCell> queue;
        HashSet<(int, int)> legendaryCells;
        using (first)
        {
            if (!first.KanaiOpen) return Done(KanaiUpgradeOutcome.NotReady, "Kanai's Cube is not open");
            var (rares, skipped) = ClassifyRares(first, catalog, wanted);
            Emit(EventScan, $"{rares.Count} rare(s), {rares.Count(r => r.TargetKeys.Count > 0)} of a target type, {skipped} gem / consumable cell(s) skipped");
            queue = rares.Where(r => !r.NonGear && (!hunting || !settings.OnlyCompatibleRares || r.TargetKeys.Count > 0))
                .OrderByDescending(r => r.TargetKeys.Count > 0).ThenBy(r => r.Row).ThenBy(r => r.Col).ToList();
            foreach (var r in rares.Except(queue))
                Emit(EventSkip, $"rare ({r.Row},{r.Col}) {(r.NonGear ? "gem / consumable" : r.Group.Length == 0 ? "type unknown" : r.Group)}");
            legendaryCells = first.Items.Where(i => i.IsLegendary).Select(i => (i.Row, i.Col)).ToHashSet();
        }
        if (queue.Count == 0) return Done(KanaiUpgradeOutcome.AllRaresUsed, "no rare to upgrade");
        if (settings.MaxTransmutes > 0 && queue.Count > settings.MaxTransmutes) queue = queue.Take(settings.MaxTransmutes).ToList();

        var shared = GameInterfaceData.Instance;
        if (!KanaiOperations.ResetPanelToFirstPage(shared) || !KanaiOperations.NavigateToPage(shared, KanaiOperations.UpgradePageClicks))
            return Done(KanaiUpgradeOutcome.NotReady, "upgrade recipe page not reached");
        Emit(EventPage, "upgrade rare recipe page");

        var usedGroups = new HashSet<string>(StringComparer.Ordinal);
        bool Check(bool firstCheck, KanaiRareCell? lastRare)
        {
            if (Refresh(detectKanai: false) is not { } view) return false;
            using (view)
            {
                var fresh = view.Items.Where(i => i.IsLegendary && !legendaryCells.Contains((i.Row, i.Col))).ToList();
                if (firstCheck && fresh.Count == 0 && lastRare != null
                    && view.Items.Any(i => i.Row == lastRare.Row && i.Col == lastRare.Col && i.IsRare))
                {
                    Emit(EventError, "the first transmute changed nothing (materials missing or not the upgrade recipe page)", false);
                    return true;
                }
                var groups = usedGroups.Contains("") ? new HashSet<string>() : usedGroups;
                foreach (var cell in fresh)
                {
                    legendaryCells.Add((cell.Row, cell.Col));
                    var product = Evaluate(view, cell, catalog, wanted, settings, groups);
                    products.Add(product);
                    Emit(EventProduct, $"({cell.Row},{cell.Col}) {product.NameEn} {product.NameZh} [{product.Source} {product.Score:F2}] {product.Detail}",
                        product.TargetKey != null ? product.Satisfied : null);
                    if (product is { Satisfied: true, TargetKey: { } key } && reached.Add(key)) Emit(EventTarget, $"{product.NameEn} {product.NameZh}", true);
                }
            }
            usedGroups.Clear();
            return false;
        }

        bool Satisfied() => hunting && (settings.Stop == KanaiUpgradeStop.AnyTarget ? reached.Count > 0 : wanted.All(w => reached.Contains(w.Target.Key)));

        var (ox, oy) = shared.WindowOffset;
        foreach (var rare in queue)
        {
            if (shouldStop()) return Done(KanaiUpgradeOutcome.Stopped, "stopped by the user");
            KeepForeground();
            if (shared.BagCoordinates is not { } bag) return Done(KanaiUpgradeOutcome.NotReady, "bag lost");
            var (sx, sy) = bag.SlotCenter(rare.Row, rare.Col);
            KanaiRecipeHelper.Transmute(shared, sx + ox, sy + oy, settings.HelperDelayMs, returnByPrevFirst: false);
            transmutes++;
            usedGroups.Add(rare.Group);
            Emit(EventTransmute, $"#{transmutes} rare ({rare.Row},{rare.Col}) {rare.Group}");
            bool firstCheck = transmutes == 1;
            if (settings.Check == KanaiUpgradeCheck.EachTransmute || firstCheck)
            {
                if (Check(firstCheck, rare)) return Done(KanaiUpgradeOutcome.NoEffect, "no product");
                if (Satisfied()) return Done(KanaiUpgradeOutcome.TargetReached, string.Join(", ", reached));
            }
        }
        if (settings.Check == KanaiUpgradeCheck.EachPass)
        {
            Thread.Sleep(SettleAfterPassMs);
            Check(false, null);
        }
        if (Satisfied()) return Done(KanaiUpgradeOutcome.TargetReached, string.Join(", ", reached));
        return settings.MaxTransmutes > 0 && transmutes >= settings.MaxTransmutes
            ? Done(KanaiUpgradeOutcome.LimitReached, $"limit {settings.MaxTransmutes}")
            : Done(KanaiUpgradeOutcome.AllRaresUsed, hunting ? "target not obtained" : "every rare upgraded");
    }

    /// <summary>A target with its catalog entry and icon group (null / empty when the game data does not know it).</summary>
    private sealed record Want(KanaiUpgradeTarget Target, D3CatalogItem? Item)
    {
        public string Group => Item?.Group ?? "";
    }

    private static List<Want> Wanted(IReadOnlyList<KanaiUpgradeTarget> targets, D3ItemCatalog catalog) =>
        targets.Select(t => new Want(t, catalog.Of(t.Item))).ToList();

    private static (List<KanaiRareCell> Rares, int Skipped) ClassifyRares(BagView view, D3ItemCatalog catalog, List<Want> wanted)
    {
        var rares = new List<KanaiRareCell>();
        int skipped = 0;
        foreach (var item in view.Items.Where(i => i.IsRare))
        {
            using var crop = view.Crop(item);
            var guess = crop == null ? null : KanaiBagRecognizer.Classify(crop, item.Tall, catalog);
            string group = guess?.Group ?? "";
            if (guess?.NonGear == true) skipped++;
            var keys = group.Length == 0 ? new List<string>() : wanted.Where(w => w.Group == group).Select(w => w.Target.Key).ToList();
            rares.Add(new KanaiRareCell(item.Row, item.Col, item.Tall, group, guess?.Score ?? 0, guess?.NonGear == true, keys));
        }
        return (rares, skipped);
    }

    /// <summary>
    /// Icon guess of a legendary among the items of the possible type groups (all equipment when none is known, or when none of them
    /// scores: the rare's type may have been misread).
    /// </summary>
    private static KanaiLegendaryCell IdentifyByIcon(BagView view, KanaiBagItem item, D3ItemCatalog catalog, List<Want> wanted, IReadOnlyCollection<string> groups)
    {
        using var crop = view.Crop(item);
        if (crop == null) return new KanaiLegendaryCell(item.Row, item.Col, item.Tall, null, 0, null);
        var ranked = groups.Count == 0 ? Array.Empty<KanaiIconGuess>() : KanaiBagRecognizer.RankEquipment(crop, item.Tall, catalog.Equipment.Where(e => groups.Contains(e.Group)));
        if (ranked.Count == 0 || ranked[0].Score < KanaiBagRecognizer.MinScore) ranked = KanaiBagRecognizer.RankEquipment(crop, item.Tall, catalog.Equipment);
        if (ranked.Count == 0 || ranked[0].Score < KanaiBagRecognizer.MinScore) return new KanaiLegendaryCell(item.Row, item.Col, item.Tall, null, ranked.FirstOrDefault()?.Score ?? 0, null);
        double floor = Math.Max(KanaiBagRecognizer.MinScore, ranked[0].Score - KanaiBagRecognizer.TieMargin);
        var target = wanted.FirstOrDefault(w => w.Item != null
            && ranked.Any(r => r.Score >= floor && string.Equals(r.Item?.NameEn, w.Item.NameEn, StringComparison.OrdinalIgnoreCase)));
        return new KanaiLegendaryCell(item.Row, item.Col, item.Tall, ranked[0].Item, ranked[0].Score, target?.Target.Key);
    }

    /// <summary>Name a product and check it against the targets: plugin when live, else icon, then OCR when the icon looks like a target.</summary>
    private static KanaiUpgradeProduct Evaluate(BagView view, KanaiBagItem cell, D3ItemCatalog catalog, List<Want> wanted, KanaiUpgradeSettings settings,
        IReadOnlyCollection<string> groups)
    {
        var now = DateTime.UtcNow;
        if (PluginItem(cell) is { } entity)
        {
            var observed = new ObservedItem(entity.Gbid, entity.InternalName, entity.Name, entity.AncientRank, entity.Attrs);
            var item = catalog.ByName(entity.Name);
            var want = wanted.FirstOrDefault(w => D3PlannerMatcher.IsSameItem(w.Target.Item, observed));
            if (want == null)
                return new KanaiUpgradeProduct(now, cell.Row, cell.Col, item?.NameEn ?? entity.Name, item?.NameZh ?? "", SourcePlugin, 1, null, false, entity.AncientRank, "");
            var match = D3PlannerMatcher.Evaluate(want.Target.Item, observed, settings.Uncheckable);
            var required = match.Stats.Where(s => want.Target.RequiredStats.Contains(s.Stat.Code, StringComparer.Ordinal)).ToList();
            if (required.All(s => s.Ok != null) || !settings.VerifyByOcr)
            {
                bool ok = entity.AncientRank >= want.Target.MinAncientRank && required.All(s => s.Ok == true);
                string detail = string.Join(" ", required.Select(s => $"{s.Stat.Code}={Fmt(s.Actual)}{(s.Ok == true ? "✓" : "✗")}"));
                return new KanaiUpgradeProduct(now, cell.Row, cell.Col, want.Target.Item.NameEn, want.Target.Item.NameZh, SourcePlugin, 1, want.Target.Key, ok, entity.AncientRank, detail);
            }
            return VerifyByTooltip(cell, new[] { want }, SourcePlugin, 1, now, assumeName: true);
        }
        var guess = IdentifyByIcon(view, cell, catalog, wanted, groups);
        string guessEn = guess.Item?.NameEn ?? "?", guessZh = guess.Item?.NameZh ?? "";
        if (guess.TargetKey is { } key && wanted.FirstOrDefault(w => w.Target.Key == key) is { } hit)
        {
            bool needsTooltip = settings.VerifyByOcr || hit.Target.MinAncientRank > 0 || hit.Target.RequiredStats.Count > 0;
            if (!needsTooltip)
                return new KanaiUpgradeProduct(now, cell.Row, cell.Col, hit.Target.Item.NameEn, hit.Target.Item.NameZh, SourceIcon, guess.Score, key, true, -1, "icon only");
            return VerifyByTooltip(cell, new[] { hit }, SourceIcon, guess.Score, now, assumeName: false);
        }
        // The icon cannot rule out a target of the product's type when it is inconclusive or the target has no icon: OCR decides.
        var unseen = wanted.Where(w => (groups.Count == 0 || groups.Contains(w.Group)) && (guess.Item == null || w.Item?.RecognitionIcon == null)).ToList();
        if (settings.VerifyByOcr && unseen.Count > 0)
            return VerifyByTooltip(cell, unseen, SourceIcon, guess.Score, now, assumeName: false, guessEn, guessZh);
        return new KanaiUpgradeProduct(now, cell.Row, cell.Col, guessEn, guessZh, SourceIcon, guess.Score, null, false, -1, "");
    }

    /// <summary>
    /// Hover + OCR once: the name picks the target among the candidates (the plugin's name is trusted), the tier line gives the rank,
    /// required affixes their values. No candidate named: a non-target product under the icon guess (or the first tooltip line).
    /// </summary>
    private static KanaiUpgradeProduct VerifyByTooltip(KanaiBagItem cell, IReadOnlyList<Want> candidates, string source, double score, DateTime now,
        bool assumeName, string guessEn = "?", string guessZh = "")
    {
        var tooltip = KanaiTooltipReader.Read(GameInterfaceData.Instance, cell.Row, cell.Col);
        if (tooltip == null)
            return new KanaiUpgradeProduct(now, cell.Row, cell.Col, candidates[0].Target.Item.NameEn, candidates[0].Target.Item.NameZh, source, score,
                candidates.Count == 1 ? candidates[0].Target.Key : null, false, -1, "tooltip not captured");
        var (want, nameScore) = candidates.Select(c => (Want: c, Score: assumeName ? 1 : tooltip.NameScore(c.Target.Item.NameZh, c.Target.Item.NameEn)))
            .OrderByDescending(c => c.Score).First();
        var item = want.Target.Item;
        if (nameScore < OcrNameMin)
        {
            string line = tooltip.Lines.FirstOrDefault() ?? "";
            return new KanaiUpgradeProduct(now, cell.Row, cell.Col, guessEn == "?" && line.Length > 0 ? line : guessEn, guessZh, SourceOcr, score, null, false,
                tooltip.AncientRank, $"ocr name {nameScore:F2} ({item.NameEn}): {line}");
        }
        var checks = want.Target.Required.Select(s => (Stat: s, Value: tooltip.StatValue(s))).ToList();
        bool statsOk = checks.All(c => c.Value is { } v && v >= c.Stat.Value * D3PlannerMatcher.StatTolerance);
        bool ok = tooltip.AncientRank >= want.Target.MinAncientRank && statsOk;
        string detail = $"ocr name {nameScore:F2} rank {tooltip.AncientRank} " + string.Join(" ",
            checks.Select(c => $"{c.Stat.Code}={Fmt(c.Value)}/{c.Stat.Value.ToString("0.##", CultureInfo.InvariantCulture)}{(c.Value is { } v && v >= c.Stat.Value * D3PlannerMatcher.StatTolerance ? "✓" : "✗")}"));
        return new KanaiUpgradeProduct(now, cell.Row, cell.Col, item.NameEn, item.NameZh, source == SourcePlugin ? SourcePlugin : SourceOcr, score,
            want.Target.Key, ok, tooltip.AncientRank, detail.Trim());
    }

    /// <summary>Backpack item of the live bridge plugin at the cell (top-left cell = column, row), null when the plugin is not live.</summary>
    private static RosbotBridgeEntity? PluginItem(KanaiBagItem cell)
    {
        var snapshot = GameInterfaceData.Instance.GetStateSnapshot();
        if (snapshot.RosbotBridge is not { InventoryCellSupported: true } bridge || !snapshot.RosbotBridgeFresh) return null;
        return bridge.CarriedItems.FirstOrDefault(e => e.Slot == RosbotBridgeEntity.SlotBackpack && e.InvX == cell.Col && e.InvY == cell.Row);
    }

    private static string Fmt(double? v) => v is { } d ? d.ToString("0.##", CultureInfo.InvariantCulture) : "?";

    private static string TypeLabel(D3ItemCatalog catalog, string? type) => type == null ? "?" : catalog.TypeName(type).En;

    /// <summary>The D3 window in front (clicks and captures need it); a no-op when it already is.</summary>
    private static void KeepForeground()
    {
        if (D3WindowFinder.FindWindows().FirstOrDefault()?.Hwnd is { } hwnd && hwnd != IntPtr.Zero) ScreenCaptureService.EnsureForeground(hwnd);
    }

    /// <summary>Fresh capture + bag layout (and whether the cube is open, when asked); null when D3 cannot be captured or no bag is seen.</summary>
    private static BagView? Refresh(bool detectKanai = true)
    {
        KeepForeground();
        var manager = D3InterfaceManager.Instance;
        var shared = GameInterfaceData.Instance;
        if (manager.CollectUiInfo(forceNewCapture: true) == null || manager.CollectBagInfoFromCurrentShared() == null) return null;
        if (shared.BagCoordinates is not { } bag || shared.BagLayout is not { } layout) return null;
        using var bitmap = shared.CloneGameWindowImage();
        if (bitmap == null) return null;
        bool kanai = detectKanai && D3InterfaceDetection.DetectInterfaceTypeFromFullWindow(bitmap, wantBlacksmith: false).InterfaceType == D3InterfaceDetection.InterfaceKanaiCube;
        return new BagView(ImageConvert.NormalizeToBgr(bitmap), bag, KanaiBagRecognizer.Items(layout, bag), kanai);
    }

    /// <summary>One capture: window image (BGR), bag coordinates, items and whether the cube is open.</summary>
    private sealed class BagView : IDisposable
    {
        public BagView(Mat image, BagCoordinates bag, IReadOnlyList<KanaiBagItem> items, bool kanaiOpen)
        {
            Image = image;
            Bag = bag;
            Items = items;
            KanaiOpen = kanaiOpen;
        }

        public Mat Image { get; }

        public BagCoordinates Bag { get; }

        public IReadOnlyList<KanaiBagItem> Items { get; }

        public bool KanaiOpen { get; }

        public Mat? Crop(KanaiBagItem item) => KanaiBagRecognizer.Crop(Image, Bag, item);

        public void Dispose() => Image.Dispose();
    }
}
