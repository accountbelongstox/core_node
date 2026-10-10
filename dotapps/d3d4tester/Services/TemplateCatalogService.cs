// PY-REF: none (DOT-only)
using System.IO;
using System.Windows.Media.Imaging;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;

namespace DotApps.d3d4tester.Services;

/// <summary>One template image: path, folder group, pixel size, status / purpose i18n keys and the code that uses it.</summary>
public sealed record TemplateCatalogEntry(string RelativePath, string Group, string FullPath, int Width, int Height, string StatusKey, string? PurposeKey, string UsedBy);

/// <summary>
/// Every image under the template dir with what it is for: the single list of known templates (status, purpose, users) for the
/// Templates tab, so images with no user yet stay visible for later work. Root files are keyed by file stem, sub-folders by their
/// top folder; anything not listed shows as unused.
/// </summary>
public static class TemplateCatalogService
{
    private const string RootGroup = "/";
    private static readonly string[] ImageExtensions = { ".png", ".jpg", ".jpeg", ".bmp", ".ico" };

    /// <summary>Status keys in filter order.</summary>
    public static readonly IReadOnlyList<string> StatusKeys = new[]
    {
        I18nKeys.TemplatesStatusUsed, I18nKeys.TemplatesStatusRegistered, I18nKeys.TemplatesStatusReference, I18nKeys.TemplatesStatusUnused,
    };

    private sealed record Known(string StatusKey, string PurposeKey, string UsedBy);

    private static Known Used(string purpose, string usedBy) => new(I18nKeys.TemplatesStatusUsed, purpose, usedBy);
    private static Known Registered(string purpose) => new(I18nKeys.TemplatesStatusRegistered, purpose, nameof(D3TemplateConfig));
    private static Known Reference(string purpose) => new(I18nKeys.TemplatesStatusReference, purpose, "");

    private static readonly Dictionary<string, Known> RootFiles = BuildRootFiles();

    private static readonly Dictionary<string, Known> Folders = new(StringComparer.OrdinalIgnoreCase)
    {
        ["battlenet"] = Used(I18nKeys.TemplatesPurposeBattlenet, "TemplateMatcherHelper (coordinate picker)"),
        ["d4"] = Used(I18nKeys.TemplatesPurposeD4SmallMap, "D4SmallMapDetector, TemplateMatcherHelper"),
        ["armor_icons"] = Used(I18nKeys.TemplatesPurposeItemIcons, "D3ItemIcons -> D3PlannerBuildBlock"),
        ["weapon_icons"] = Used(I18nKeys.TemplatesPurposeItemIcons, "D3ItemIcons -> D3PlannerBuildBlock"),
        ["gem_icons"] = Used(I18nKeys.TemplatesPurposeGemIcons, "D3ItemIcons -> D3PlannerBuildBlock"),
        ["maxroll_d3planner"] = Used(I18nKeys.TemplatesPurposeMaxrollIcons, "D3ItemIcons -> D3PlannerBuildBlock"),
        ["armor_recipe_list"] = Reference(I18nKeys.TemplatesPurposeRecipeGold),
        ["weapon_recipe_list"] = Reference(I18nKeys.TemplatesPurposeRecipeGold),
    };

    private static Dictionary<string, Known> BuildRootFiles()
    {
        var map = new Dictionary<string, Known>(StringComparer.OrdinalIgnoreCase);
        void Add(Known k, params string[] stems)
        {
            foreach (var s in stems) map[s] = k;
        }
        Add(Used(I18nKeys.TemplatesPurposeBagOpened, "D3InterfaceDetection, BagInfoCollector"), D3TemplateNames.BagOpenedIndicator);
        Add(Used(I18nKeys.TemplatesPurposeBagEdge, "BagInfoCollector (debug annotation)"), D3TemplateNames.BagLeft, D3TemplateNames.BagButtom);
        Add(Registered(I18nKeys.TemplatesPurposeBagRight), D3TemplateNames.BagRight);
        Add(Reference(I18nKeys.TemplatesPurposeBagBorder), "bag_border");
        Add(Used(I18nKeys.TemplatesPurposeBlacksmithSidebar, "D3InterfaceDetection"), D3TemplateNames.BlacksmithIndicator1, D3TemplateNames.BlacksmithIndicator2);
        Add(Used(I18nKeys.TemplatesPurposeBlacksmithTab, "D3InterfaceDetection, BlacksmithHandler"), D3TemplateNames.BlacksmithSidebarTab1, D3TemplateNames.BlacksmithSidebarTab2);
        Add(Used(I18nKeys.TemplatesPurposeSalvageButton, "D3StandardCoordinates"), D3TemplateNames.BlacksmithSalvageButton);
        Add(Used(I18nKeys.TemplatesPurposeKanaiLeft, "D3InterfaceDetection, BagInfoCollector"), D3TemplateNames.KanaiCubeLeftPanelIndicator);
        Add(Used(I18nKeys.TemplatesPurposeKanaiPanel, "D3InterfaceDetection.IsKanaiRecipePanelOpened, KanaiOperations, BagInfoCollector"),
            D3TemplateNames.KanaiRightPageIndicator, D3TemplateNames.KanaiRightPanelOpenedIndicator);
        Add(Used(I18nKeys.TemplatesPurposeKanaiToggle, "KanaiOperations"), D3TemplateNames.KanaiRightPanelToggleIcon);
        Add(Used(I18nKeys.TemplatesPurposeKanaiNext, "KanaiOperations"), D3TemplateNames.KanaiNextPageIcon);
        Add(Used(I18nKeys.TemplatesPurposeKanaiReforgePage, "KanaiOperations.GoToReforgePage"), D3TemplateNames.KanaiReforgePageIndicator);
        Add(Used(I18nKeys.TemplatesPurposeD3State, "D3ScaledTemplateMatcher.MatchAllD3States (D3StatusProvider, F3)"),
            D3TemplateNames.D3StartGameButton, D3TemplateNames.D3GameTool, D3TemplateNames.D3Connecting, D3TemplateNames.D3ConnectingAlt, D3TemplateNames.D3Disconnected);
        Add(Used(I18nKeys.TemplatesPurposeBountyMap, "D3ScreenState.EnsureBountyMapOpen"), D3TemplateNames.D3BountyProgress);
        Add(Reference(I18nKeys.TemplatesPurposeOldDisconnected), "d3_disconnected_old");
        Add(Used(I18nKeys.TemplatesPurposeGameAnchor, "GameWindowDetector"),
            D3TemplateNames.GameAnchorBottomLeft1, D3TemplateNames.GameAnchorBottomLeft2, D3TemplateNames.GameAnchorBottomLeft3, D3TemplateNames.GameAnchorBottomRight);
        Add(Registered(I18nKeys.TemplatesPurposeItemQuality),
            D3TemplateNames.ItemPrimalAncient, D3TemplateNames.ItemAncientSet, D3TemplateNames.ItemLegendary, D3TemplateNames.ItemRareYellow, D3TemplateNames.ItemRareBlue);
        Add(Reference(I18nKeys.TemplatesPurposeQualityLine), "ancient_native", "primal_native");
        Add(Registered(I18nKeys.TemplatesPurposeSlotEmpty), D3TemplateNames.SlotEmpty);
        Add(Registered(I18nKeys.TemplatesPurposeInterference), D3TemplateNames.SlotInterferenceColors);
        Add(Used(I18nKeys.TemplatesPurposeYellowColors, "BagColorReferences"), D3TemplateNames.QualityYellowColors);
        Add(Reference(I18nKeys.TemplatesPurposeLogo), "logo");
        return map;
    }

    /// <summary>Scan the template dir (file names and image headers only); call off the UI thread.</summary>
    public static IReadOnlyList<TemplateCatalogEntry> Load()
    {
        string root = D3TemplatePaths.GetTemplateDir();
        if (!Directory.Exists(root)) return Array.Empty<TemplateCatalogEntry>();
        var list = new List<TemplateCatalogEntry>();
        foreach (var file in Directory.EnumerateFiles(root, "*", SearchOption.AllDirectories))
        {
            if (!ImageExtensions.Contains(Path.GetExtension(file), StringComparer.OrdinalIgnoreCase)) continue;
            string rel = Path.GetRelativePath(root, file).Replace(Path.DirectorySeparatorChar, '/');
            int slash = rel.IndexOf('/');
            string group = slash < 0 ? RootGroup : rel[..slash];
            Known? known = slash < 0 ? RootFiles.GetValueOrDefault(Path.GetFileNameWithoutExtension(rel)) : Folders.GetValueOrDefault(group);
            var (w, h) = ReadSize(file);
            list.Add(new TemplateCatalogEntry(rel, group, file, w, h, known?.StatusKey ?? I18nKeys.TemplatesStatusUnused, known?.PurposeKey, known?.UsedBy ?? ""));
        }
        return list.OrderBy(e => e.Group == RootGroup ? 0 : 1).ThenBy(e => e.RelativePath, StringComparer.OrdinalIgnoreCase).ToList();
    }

    /// <summary>Pixel size from the image header (no full decode); (0, 0) when unreadable.</summary>
    private static (int Width, int Height) ReadSize(string path)
    {
        try
        {
            using var stream = File.OpenRead(path);
            var frame = BitmapDecoder.Create(stream, BitmapCreateOptions.DelayCreation, BitmapCacheOption.None).Frames[0];
            return (frame.PixelWidth, frame.PixelHeight);
        }
        catch (Exception ex) when (ex is IOException or NotSupportedException or FileFormatException or UnauthorizedAccessException or ArgumentException)
        {
            return (0, 0);
        }
    }
}
