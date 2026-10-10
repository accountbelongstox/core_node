// PY-REF: none (DOT-only)
using System.IO;
using System.Text.Json;
using System.Text.Json.Serialization;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Assistant;
using DotApps.d3d4tester.Core.Kanai;
using DotApps.d3d4tester.Core.Planner;
using DotCore.Foundations;

namespace DotApps.d3d4tester.Services;

/// <summary>Saved choice for one planned item of a gear set: wanted, minimum ancient rank, required affix codes.</summary>
public sealed class KanaiTargetChoice
{
    public string Key { get; set; } = "";
    public int MinAncientRank { get; set; }
    public List<string> Stats { get; set; } = new();
}

/// <summary>Everything the cube upgrade keeps between sessions (user data folder): options, material stock, target choices per gear set, history.</summary>
public sealed class KanaiUpgradeStore
{
    public KanaiUpgradeStop Stop { get; set; } = KanaiUpgradeStop.AnyTarget;
    public KanaiUpgradeCheck Check { get; set; } = KanaiUpgradeCheck.EachTransmute;
    public bool OnlyCompatibleRares { get; set; } = true;
    public bool VerifyByOcr { get; set; } = true;
    public int MaxTransmutes { get; set; }
    /// <summary>The assistant hotkey on the open cube runs the hunt (before reforge / upgrade / convert).</summary>
    public bool Armed { get; set; }
    public KanaiMaterials Stock { get; set; }
    /// <summary>Gear set key ("build id|gear set name") -> chosen targets.</summary>
    public Dictionary<string, List<KanaiTargetChoice>> Targets { get; set; } = new(StringComparer.Ordinal);
    public List<KanaiUpgradeRun> History { get; set; } = new();
}

/// <summary>Totals over the history: runs, transmutes, products, targets obtained, materials consumed.</summary>
public sealed record KanaiUpgradeTotals(int Runs, int Transmutes, int Products, int TargetsReached, KanaiMaterials Consumed);

/// <summary>
/// Kanai's Cube rare -> legendary hunt for the selected build / gear set (D3PlannerService): targets chosen in the cube upgrade window
/// (per gear set), options and material stock are kept in kanai_upgrade.json in the user data folder together with the run history
/// (newest first, at most <see cref="MaxHistory"/> runs; the stock is reduced by what every run consumed). A run starts from the window
/// (it marks the assistant running, so the assistant hotkey or Stop ends it) or from the assistant hotkey on the open cube when armed.
/// </summary>
public static class KanaiUpgradeService
{
    public const int MaxHistory = 200;
    private const string FileName = "kanai_upgrade.json";
    private const string ProfileKeySeparator = "|";
    private const string LogTag = "[KanaiUpgradeService]";
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true, Converters = { new JsonStringEnumConverter() } };
    private static readonly object Lock = new();
    private static KanaiUpgradeStore? _store;
    private static int _running;

    public static event Action<KanaiUpgradeEvent>? Progress;

    public static event Action<KanaiUpgradeRun>? RunFinished;

    public static bool IsRunning => Volatile.Read(ref _running) == 1;

    private static string FilePath => Path.Combine(ConfigPaths.CurrentUserDataPath, FileName);

    public static KanaiUpgradeStore Store
    {
        get
        {
            lock (Lock) return _store ??= Load();
        }
    }

    public static bool Armed => Store.Armed;

    /// <summary>Key of the selected gear set; null without a build.</summary>
    public static string? ProfileKey => D3PlannerService.Build is { } b && D3PlannerService.Profile is { } p ? b.Id + ProfileKeySeparator + p.Name : null;

    /// <summary>Planned items of the selected gear set that can be wanted (hero gear and cube powers).</summary>
    public static IReadOnlyList<PlannerItem> Candidates => D3PlannerService.Profile is { } p ? p.Items.Concat(p.Kanai).ToList() : Array.Empty<PlannerItem>();

    /// <summary>Saved choices of the selected gear set.</summary>
    public static IReadOnlyList<KanaiTargetChoice> Choices => ProfileKey is { } key && Store.Targets.TryGetValue(key, out var list) ? list : Array.Empty<KanaiTargetChoice>();

    public static void SaveChoices(IEnumerable<KanaiTargetChoice> choices)
    {
        if (ProfileKey is not { } key) return;
        lock (Lock) Store.Targets[key] = choices.ToList();
        Save();
    }

    /// <summary>Targets of the selected gear set from the saved choices.</summary>
    public static IReadOnlyList<KanaiUpgradeTarget> Targets()
    {
        var choices = Choices.ToDictionary(c => c.Key, StringComparer.Ordinal);
        return Candidates.Select(i => (Item: i, Key: KanaiUpgradeTarget.KeyOf(i)))
            .Where(x => choices.ContainsKey(x.Key))
            .Select(x => new KanaiUpgradeTarget(x.Item, choices[x.Key].MinAncientRank, choices[x.Key].Stats))
            .ToList();
    }

    public static KanaiUpgradeTotals Totals()
    {
        var history = Store.History;
        return new KanaiUpgradeTotals(history.Count, history.Sum(r => r.Transmutes), history.Sum(r => r.Products.Count),
            history.Sum(r => r.TargetsReached.Count), history.Aggregate(default(KanaiMaterials), (acc, r) => acc + r.Consumed));
    }

    public static void Save()
    {
        try
        {
            string json;
            lock (Lock) json = JsonSerializer.Serialize(Store, JsonOptions);
            Directory.CreateDirectory(Path.GetDirectoryName(FilePath)!);
            string tmp = FilePath + ".tmp";
            File.WriteAllText(tmp, json);
            File.Move(tmp, FilePath, overwrite: true);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{LogTag} {FilePath} not saved: {ex.Message}");
        }
    }

    public static void ClearHistory()
    {
        lock (Lock) Store.History.Clear();
        Save();
    }

    /// <summary>Bag hints from a fresh capture (works with the inventory or the cube open).</summary>
    public static Task<KanaiBagScan> ScanAsync() => Task.Run(() => KanaiUpgradeHunter.Scan(Targets(), D3PlannerService.CacheDir));

    /// <summary>Start a run from the window; null when the assistant is busy. The assistant hotkey or <see cref="Stop"/> ends it.</summary>
    public static Task<KanaiUpgradeRun?> RunAsync()
    {
        var state = AssistantExecutionState.Instance;
        if (!state.TryBeginRun()) return Task.FromResult<KanaiUpgradeRun?>(null);
        return Task.Run<KanaiUpgradeRun?>(() =>
        {
            try
            {
                return RunCore(state.ShouldStopAssistant);
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} {ex.Message}");
                Progress?.Invoke(new KanaiUpgradeEvent(DateTime.Now, KanaiUpgradeHunter.EventError, ex.Message, false));
                return null;
            }
            finally
            {
                state.ResetState();
            }
        });
    }

    /// <summary>Assistant hotkey on the open cube while armed (the assistant run is already marked; runs on its worker thread).</summary>
    public static bool RunFromHotkey(Func<bool> shouldStop) => RunCore(shouldStop) is { Outcome: KanaiUpgradeOutcome.TargetReached or KanaiUpgradeOutcome.AllRaresUsed };

    public static void Stop() => AssistantExecutionState.Instance.SetShouldStop(true);

    private static KanaiUpgradeRun? RunCore(Func<bool> shouldStop)
    {
        if (Interlocked.Exchange(ref _running, 1) == 1) return null;
        try
        {
            var store = Store;
            var aux = MacroAuxiliaryOptions.ReadLive();
            var targets = Targets();
            var stop = targets.Count == 0 ? KanaiUpgradeStop.Never : store.Stop;
            var settings = new KanaiUpgradeSettings(targets, stop, store.Check, store.OnlyCompatibleRares, store.VerifyByOcr, MaxTransmutes(store),
                AssistantTiming.HelperDelayMs(aux.AnimationSpeed), D3PlannerService.CacheDir) { Uncheckable = D3PlannerService.Uncheckable };
            var run = KanaiUpgradeHunter.Run(settings, D3PlannerService.Build?.Name ?? "", D3PlannerService.Profile?.Name ?? "", shouldStop, e => Progress?.Invoke(e));
            lock (Lock)
            {
                store.History.Insert(0, run);
                if (store.History.Count > MaxHistory) store.History.RemoveRange(MaxHistory, store.History.Count - MaxHistory);
                var s = store.Stock;
                var used = run.Consumed;
                store.Stock = new KanaiMaterials(Math.Max(0, s.DeathsBreath - used.DeathsBreath), Math.Max(0, s.ReusableParts - used.ReusableParts),
                    Math.Max(0, s.ArcaneDust - used.ArcaneDust), Math.Max(0, s.VeiledCrystal - used.VeiledCrystal));
            }
            Save();
            RunFinished?.Invoke(run);
            return run;
        }
        finally
        {
            Volatile.Write(ref _running, 0);
        }
    }

    /// <summary>The configured limit, lowered to what the entered material stock pays for (no stock entered = no material limit; 0 = none).</summary>
    private static int MaxTransmutes(KanaiUpgradeStore store)
    {
        var stock = store.Stock;
        bool entered = stock.DeathsBreath > 0 || stock.ReusableParts > 0 || stock.ArcaneDust > 0 || stock.VeiledCrystal > 0;
        if (!entered) return store.MaxTransmutes;
        int affords = (int)Math.Min(int.MaxValue, Math.Max(1, stock.Affords(KanaiMaterials.UpgradeRareCost)));
        return store.MaxTransmutes > 0 ? Math.Min(store.MaxTransmutes, affords) : affords;
    }

    private static KanaiUpgradeStore Load()
    {
        try
        {
            if (File.Exists(FilePath) && JsonSerializer.Deserialize<KanaiUpgradeStore>(File.ReadAllText(FilePath), JsonOptions) is { } store) return store;
        }
        catch (Exception ex) when (ex is IOException or JsonException or NotSupportedException)
        {
            ColorPrinter.Yellow($"{LogTag} {FilePath} not readable: {ex.Message}");
        }
        return new KanaiUpgradeStore();
    }
}
