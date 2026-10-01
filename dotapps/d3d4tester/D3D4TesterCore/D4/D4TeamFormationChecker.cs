using DotCore.Foundations;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>
/// Team check: press O, wait one tick, OCR the "Find Team" crop (task quest_text). Text starting with a "find" prefix = no team ->
/// run auto team formation; otherwise has team. Press O to close. Writes HasTeam.
/// 1:1 Python pyapps/d3-check/d4utils/d4_team_formation_checker.py.
/// Fixes Python bug: hardcoded CN prefix "寻找" -> keyword list (D4Constants.FindTeamOcrPrefixes, overridable).
/// Fixes Python bug: the OCR read the region crop from before the panel opened; the frame is recaptured after the wait.
/// </summary>
public sealed class D4TeamFormationChecker : D4OperationBase
{
    private const string LogPrefix = "[D4TeamFormationChecker]";

    private static readonly Lazy<D4TeamFormationChecker> LazyInstance = new(() =>
    {
        var c = new D4TeamFormationChecker();
        ColorPrinter.Green("[Global] Team formation checker initialized");
        return c;
    });

    private D4TeamFormationChecker()
    {
        ColorPrinter.Green($"{LogPrefix} Initialized");
    }

    public static D4TeamFormationChecker Instance => LazyInstance.Value;

    /// <summary>"No team" prefixes of the Find Team text.</summary>
    public IReadOnlyList<string> FindTeamPrefixes { get; set; } = D4Constants.FindTeamOcrPrefixes;

    /// <summary>Outcome of the last Execute.</summary>
    public D4TeamCheckResult? LastResult { get; private set; }

    /// <summary>Check team state and auto-form when needed; true when the check completed. 1:1 execute.</summary>
    public override bool Execute()
    {
        ColorPrinter.Blue($"{LogPrefix} Starting team formation check...");
        ColorPrinter.Blue($"{LogPrefix} Pressing 'O' key to open team panel");
        if (!PressKey(D4Constants.TeamPanelKey, D4Constants.TeamPanelOpenDelaySec))
        {
            ColorPrinter.Yellow($"{LogPrefix} Failed to press 'O' key");
            return Finish(false, Data.HasTeam, null, false, false, "Failed to press team panel key");
        }
        ColorPrinter.Blue($"{LogPrefix} Waiting for UI to update...");
        WaitForNextTick();

        using var findTeamImage = CaptureFindTeamRegion();
        if (findTeamImage == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} Find Team region not available");
            return Finish(false, Data.HasTeam, null, false, false, "Find Team region not available");
        }

        var text = RecognizeText(findTeamImage);
        if (text == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} OCR recognition failed");
            Data.HasTeam = null;
            Data.TeamCheckTimestamp = DateTime.Now;
            return Finish(false, null, null, false, false, "OCR recognition failed");
        }

        bool hasTeam = !StartsWithAny(text, FindTeamPrefixes);
        Data.HasTeam = hasTeam;
        Data.TeamCheckTimestamp = DateTime.Now;
        if (hasTeam)
        {
            ColorPrinter.Green($"{LogPrefix} Player HAS team (text: '{text}')");
            ColorPrinter.Blue($"{LogPrefix} Closing team panel");
            PressKey(D4Constants.TeamPanelKey, D4Constants.TeamPanelCloseDelaySec);
            return Finish(true, true, text, false, false);
        }

        ColorPrinter.Yellow($"{LogPrefix} Player has NO team (text: '{text}')");
        ColorPrinter.Blue($"{LogPrefix} Triggering automatic team formation...");
        var formation = D4AutoTeamFormation.Instance;
        formation.FindTeamOcrText = text;
        formation.FindTeamPrefixes = FindTeamPrefixes;
        bool formed = formation.Execute();
        if (formed)
        {
            ColorPrinter.Green($"{LogPrefix} Auto team formation completed");
            Data.HasTeam = true;
        }
        else
        {
            ColorPrinter.Yellow($"{LogPrefix} Auto team formation failed");
        }
        ColorPrinter.Blue($"{LogPrefix} Closing team panel");
        PressKey(D4Constants.TeamPanelKey, D4Constants.TeamPanelCloseDelaySec);
        return Finish(formed, Data.HasTeam, text, true, formed);
    }

    /// <summary>True when text starts with any non-empty prefix (ordinal, case-insensitive).</summary>
    public static bool StartsWithAny(string text, IEnumerable<string> prefixes) =>
        prefixes.Any(p => !string.IsNullOrEmpty(p) && text.StartsWith(p, StringComparison.OrdinalIgnoreCase));

    private Mat? CaptureFindTeamRegion()
    {
        var capture = D4ScreenshotHandler.Instance.CaptureAndCollectInfo(Data);
        if (capture.Success)
        {
            using var frame = Data.CloneGameWindowImage();
            if (frame != null)
            {
                bool windowed = Data.IsWindowedMode();
                var s = D4StandardCoords.Scale(D4StandardCoords.FindTeam.Start, Data.GameWindowSize, windowed);
                var e = D4StandardCoords.Scale(D4StandardCoords.FindTeam.End, Data.GameWindowSize, windowed);
                var crop = D4ImageCrop.Crop(frame, s, e);
                if (crop != null) return crop;
            }
        }
        return Data.CloneRegionImage(D4RegionNames.FindTeam);
    }

    private static string? RecognizeText(Mat image)
    {
        var engine = D4OcrConfig.EngineForTask(D4OcrConfig.TaskQuestText);
        if (engine == null)
        {
            ColorPrinter.Yellow($"{LogPrefix} OCR engine not available");
            return null;
        }
        var result = engine.Ocr(image);
        return result?.Text?.Trim();
    }

    private bool Finish(bool completed, bool? hasTeam, string? text, bool triggered, bool formed, string? error = null)
    {
        LastResult = new D4TeamCheckResult(completed, hasTeam, text, triggered, formed, error);
        return completed;
    }
}
