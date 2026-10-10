// PY-REF: dotapps/d3d4tester/reference/py_d3check/d4utils/d4_auto_team_formation.py
using DotCore.Foundations;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Auto team formation (team panel already open): check need, click Find Team, min level 80, max level 120,
/// activity dropdown row 5 of 7, re-enter 80/120, submit at the Confirm Team center ±3.
/// 1:1 Python dotapps/d3d4tester/reference/py_d3check/d4utils/d4_auto_team_formation.py.
/// Fixes Python bug: the need check read detected_regions['ocr_results'] (never set, always proceeded); it uses the checker's Find Team OCR text.
/// Fixes Python bug: Find Team click used region_coords (never set, always failed); it clicks the standard Find Team region.
/// </summary>
public sealed class D4AutoTeamFormation : D4OperationBase
{
    private const string LogPrefix = "[D4AutoTeamFormation]";
    private const string Separator = "================================================================================";

    private static readonly Lazy<D4AutoTeamFormation> LazyInstance = new(() =>
    {
        var f = new D4AutoTeamFormation();
        ColorPrinter.Green("[Global] Auto team formation initialized");
        return f;
    });

    private D4AutoTeamFormation()
    {
        ColorPrinter.Green($"{LogPrefix} Initialized");
    }

    public static D4AutoTeamFormation Instance => LazyInstance.Value;

    /// <summary>Find Team OCR text from the checker (null = unknown -> formation needed).</summary>
    public string? FindTeamOcrText { get; set; }

    /// <summary>"No team" prefixes of the Find Team text.</summary>
    public IReadOnlyList<string> FindTeamPrefixes { get; set; } = D4Constants.FindTeamOcrPrefixes;

    /// <summary>Run the 7-step workflow; true when formed or not needed. 1:1 execute.</summary>
    public override bool Execute()
    {
        ColorPrinter.Blue("\n" + Separator);
        ColorPrinter.Blue($"{LogPrefix} Starting auto team formation workflow...");
        ColorPrinter.Blue(Separator);
        if (!NeedTeamFormation())
        {
            ColorPrinter.Green($"{LogPrefix} Team already formed, skipping");
            return true;
        }
        ColorPrinter.Blue($"{LogPrefix} Team formation needed, starting process...");
        if (!ClickFindTeam()) return Failed("Failed to click Find Team");
        if (!SetLevel("3", "min", D4StandardCoords.IdleMinTier, D4Constants.TeamFormationMinLevel)) return Failed("Failed to set min level");
        if (!SetLevel("4", "max", D4StandardCoords.IdleMaxTier, D4Constants.TeamFormationMaxLevel)) return Failed("Failed to set max level");
        if (!SelectPartyActivity(D4Constants.TeamFormationActivityRow)) return Failed("Failed to select party activity");
        if (!ConfirmActivityLevels(D4Constants.TeamFormationMinLevel, D4Constants.TeamFormationMaxLevel)) return Failed("Failed to confirm activity levels");
        if (!SubmitParty()) return Failed("Failed to submit party");
        ColorPrinter.Green("\n" + Separator);
        ColorPrinter.Green($"{LogPrefix} Auto team formation ready");
        ColorPrinter.Green(Separator + "\n");
        return true;
    }

    /// <summary>True when Find Team text is unknown or starts with a "no team" prefix. 1:1 _need_team_formation.</summary>
    public bool NeedTeamFormation()
    {
        ColorPrinter.Blue($"{LogPrefix} Checking if team formation is needed...");
        if (string.IsNullOrEmpty(FindTeamOcrText))
        {
            ColorPrinter.Yellow($"{LogPrefix} No 'Find Team' OCR result, assuming team needed");
            return true;
        }
        ColorPrinter.Blue($"{LogPrefix} Find Team OCR result: '{FindTeamOcrText}'");
        if (D4TeamFormationChecker.StartsWithAny(FindTeamOcrText, FindTeamPrefixes))
        {
            ColorPrinter.Blue($"{LogPrefix} Detected Find Team - team formation needed");
            return true;
        }
        ColorPrinter.Blue($"{LogPrefix} Team already formed");
        return false;
    }

    private bool ClickFindTeam()
    {
        ColorPrinter.Blue($"{LogPrefix} Step 2: Clicking Find Team region...");
        bool ok = ClickRegionCenterRandom(D4StandardCoords.FindTeam, D4Constants.TeamFormationFindTeamMargin,
            D4Constants.TeamFormationFindTeamDelayMinMs, D4Constants.TeamFormationFindTeamDelayMaxMs);
        if (ok) ColorPrinter.Green($"{LogPrefix} Find Team clicked");
        return ok;
    }

    private bool SetLevel(string step, string which, D4StdPoint input, int level)
    {
        ColorPrinter.Blue($"{LogPrefix} Step {step}: Setting {which} level to {level}...");
        if (!ClickAndType(input, level)) return false;
        ColorPrinter.Green($"{LogPrefix} {which} level set to {level}");
        return true;
    }

    private bool ClickAndType(D4StdPoint input, int value)
    {
        if (!ClickPoint(input.Coord, duration: D4Constants.TeamFormationClickDurationSec)) return false;
        Wait(D4Constants.TeamFormationAfterClickSec, silent: true);
        return TypeNumber(value);
    }

    private bool SelectPartyActivity(int row)
    {
        int rows = D4Constants.TeamFormationActivityRows;
        ColorPrinter.Blue($"{LogPrefix} Step 5: Selecting party activity (row {row}/{rows})...");
        ColorPrinter.Blue($"{LogPrefix} Clicking Activity Dropdown...");
        if (!ClickPoint(D4StandardCoords.IdleActivity.Coord, duration: D4Constants.TeamFormationClickDurationSec)) return false;
        ColorPrinter.Blue($"{LogPrefix} Waiting for dropdown to expand...");
        Wait(D4Constants.TeamFormationDropdownExpandSec, silent: true);
        ColorPrinter.Blue($"{LogPrefix} Calculating row {row} position...");
        var point = CalculateRegionRowPoint(D4StandardCoords.ActivitySelectionArea, rows, row, D4Constants.TeamFormationRowRandomOffset);
        ColorPrinter.Blue($"{LogPrefix} Clicking row {row} at ({point.X}, {point.Y})...");
        if (!ClickPoint(point, duration: D4Constants.TeamFormationClickDurationSec)) return false;
        Thread.Sleep(TimeSpan.FromSeconds(D4CoordinateHelper.CalculateRandomDelay(D4Constants.TeamFormationRowDelayMinMs, D4Constants.TeamFormationRowDelayMaxMs)));
        ColorPrinter.Green($"{LogPrefix} Party activity row {row} selected");
        return true;
    }

    private bool ConfirmActivityLevels(int minLevel, int maxLevel)
    {
        ColorPrinter.Blue($"{LogPrefix} Step 6: Confirming activity levels ({minLevel}-{maxLevel})...");
        ColorPrinter.Blue($"{LogPrefix} Setting activity min level to {minLevel}...");
        if (!ClickAndType(D4StandardCoords.IdleMinTier, minLevel)) return false;
        ColorPrinter.Blue($"{LogPrefix} Setting activity max level to {maxLevel}...");
        if (!ClickAndType(D4StandardCoords.IdleMaxTier, maxLevel)) return false;
        ColorPrinter.Green($"{LogPrefix} Activity levels confirmed ({minLevel}-{maxLevel})");
        return true;
    }

    private bool SubmitParty()
    {
        ColorPrinter.Blue($"{LogPrefix} Step 7: Submitting party...");
        var r = D4StandardCoords.ConfirmTeam;
        int off = D4Constants.TeamFormationSubmitRandomOffset;
        var point = ((r.X1 + r.X2) / 2 + D4CoordinateHelper.RandomInclusive(-off, off), (r.Y1 + r.Y2) / 2 + D4CoordinateHelper.RandomInclusive(-off, off));
        ColorPrinter.Blue($"{LogPrefix} Clicking submit button at {point}...");
        if (!ClickPoint(point, duration: D4Constants.TeamFormationClickDurationSec)) return false;
        ColorPrinter.Blue($"{LogPrefix} Waiting for submission to complete...");
        Wait(D4Constants.TeamFormationSubmitWaitSec, silent: true);
        ColorPrinter.Green($"{LogPrefix} Party submitted");
        return true;
    }

    private static bool Failed(string message)
    {
        ColorPrinter.Red($"{LogPrefix} {message}");
        return false;
    }
}
