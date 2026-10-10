// PY-REF: none (DOT-only)
using DotCore.Foundations;
using DotCore.YoloDetect;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.Navigation;

/// <summary>Town NPC operations driven by the town model: open the NPC window, select its tab, press its action button, read the result.</summary>
public enum D3TownOperation { Repair, Salvage, Enchant, KanaiCube, Kadala }

public enum D3OperationOutcome { NoModel, NoWindow, NpcNotReached, PanelNotOpen, ButtonNotFound, Done, Stopped }

/// <summary>Outcome plus the last frame read (open panel, detections, enchant OCR lines).</summary>
public sealed record D3OperationResult(D3TownOperation Operation, D3OperationOutcome Outcome, D3PanelReading? Reading);

/// <summary>NPC to walk to, window panel class, tab that shows it (null = shown on open), button pressed (null = read only).</summary>
public sealed record D3TownOperationSpec(string Npc, string Panel, string? Tab, string? Button);

public sealed partial class D3TownNavigator
{
    private const int PanelPollFrames = 6;
    private const int PanelPollWaitMs = 250;
    private const int AfterClickWaitMs = 600;

    /// <summary>
    /// Operation table. Salvage presses "salvage all" only up to the game's own confirmation dialog, which this code never confirms
    /// (salvaging destroys items: the player decides). Enchant, cube and Kadala only open and read their window.
    /// </summary>
    public static readonly IReadOnlyDictionary<D3TownOperation, D3TownOperationSpec> Operations = new Dictionary<D3TownOperation, D3TownOperationSpec>
    {
        [D3TownOperation.Repair] = new(D3TownTargets.Blacksmith, D3TownUi.BlacksmithRepair, D3TownUi.BlacksmithTabRepair, D3TownUi.BlacksmithRepairAll),
        [D3TownOperation.Salvage] = new(D3TownTargets.Blacksmith, D3TownUi.BlacksmithSalvage, D3TownUi.BlacksmithTabSalvage, D3TownUi.BlacksmithSalvageAll),
        [D3TownOperation.Enchant] = new(D3TownTargets.Mystic, D3TownUi.MysticEnchant, D3TownUi.MysticTabEnchant, null),
        [D3TownOperation.KanaiCube] = new(D3TownTargets.KanaiCube, D3TownUi.KanaiPanel, null, null),
        [D3TownOperation.Kadala] = new(D3TownTargets.Kadala, D3TownUi.KadalaPanel, null, null),
    };

    /// <summary>Run one operation: open the NPC window (walk there when it is not open), select the tab, press the button, read the window.</summary>
    public D3OperationResult Run(D3TownOperation operation, D3NavigationOptions options, Func<bool> shouldStop)
    {
        var spec = Operations[operation];
        D3OperationResult Result(D3OperationOutcome outcome, D3PanelReading? reading = null)
        {
            ColorPrinter.Blue($"{LogTag} Operation {operation}: {outcome}");
            return new D3OperationResult(operation, outcome, reading);
        }

        using (var model = AcquireModel(options))
        {
            if (model == null) return Result(D3OperationOutcome.NoModel);
            var first = ReadFrame(model, out _);
            if (first == null) return Result(D3OperationOutcome.NoWindow);
            if (!WindowOf(spec, first))
            {
                var walk = NavigateTo(spec.Npc, options, shouldStop);
                if (walk == D3NavigationOutcome.Stopped) return Result(D3OperationOutcome.Stopped);
                if (walk is not D3NavigationOutcome.Arrived) return Result(D3OperationOutcome.NpcNotReached, first);
            }
            var reading = PollFrame(model, r => WindowOf(spec, r), shouldStop, out var offset);
            if (reading == null) return Result(D3OperationOutcome.NoWindow);
            if (!WindowOf(spec, reading)) return Result(D3OperationOutcome.PanelNotOpen, reading);

            if (spec.Tab != null && !Has(reading, spec.Panel))
            {
                if (!ClickClass(reading, spec.Tab, offset)) return Result(D3OperationOutcome.ButtonNotFound, reading);
                reading = PollFrame(model, r => Has(r, spec.Panel), shouldStop, out offset);
                if (reading == null) return Result(D3OperationOutcome.NoWindow);
                if (!Has(reading, spec.Panel)) return Result(D3OperationOutcome.PanelNotOpen, reading);
            }
            if (shouldStop()) return Result(D3OperationOutcome.Stopped, reading);
            if (spec.Button != null)
            {
                if (!ClickClass(reading, spec.Button, offset)) return Result(D3OperationOutcome.ButtonNotFound, reading);
                Thread.Sleep(AfterClickWaitMs);
                reading = ReadFrame(model, out _) ?? reading;
            }
            LogPanel(reading);
            return Result(D3OperationOutcome.Done, reading);
        }
    }

    /// <summary>The NPC's window is open: its panel, or (for windows with tabs) any of its tabs.</summary>
    private static bool WindowOf(D3TownOperationSpec spec, D3PanelReading reading) =>
        Has(reading, spec.Panel) || (spec.Tab != null && Has(reading, spec.Tab));

    private static bool Has(D3PanelReading reading, string className) => reading.Detections.Any(d => d.ClassName == className);

    private static bool ClickClass(D3PanelReading reading, string className, (int X, int Y) offset)
    {
        var hit = reading.Detections.Where(d => d.ClassName == className).MaxBy(d => d.Confidence);
        if (hit == null)
        {
            ColorPrinter.Yellow($"{LogTag} {className} not on screen");
            return false;
        }
        ColorPrinter.Blue($"{LogTag} Click {className} at ({hit.Center.X},{hit.Center.Y}) conf {hit.Confidence:0.00}");
        StateAwareClickHandler.Instance.LeftClick(hit.Center.X + offset.X, hit.Center.Y + offset.Y, 0);
        return true;
    }

    private D3PanelReading? ReadFrame(ModelUse model, out (int X, int Y) offset)
    {
        using Mat? frame = Capture(out offset);
        return frame == null ? null : Read(frame, model.Detector.Detect(frame, model.Profile));
    }

    /// <summary>Read frames until the condition holds (at most PanelPollFrames); the last reading, or null when the window is gone.</summary>
    private D3PanelReading? PollFrame(ModelUse model, Func<D3PanelReading, bool> done, Func<bool> shouldStop, out (int X, int Y) offset)
    {
        offset = default;
        D3PanelReading? reading = null;
        for (int i = 0; i < PanelPollFrames && !shouldStop(); i++)
        {
            if (i > 0) Thread.Sleep(PanelPollWaitMs);
            reading = ReadFrame(model, out offset);
            if (reading == null || done(reading)) break;
        }
        return reading;
    }
}
