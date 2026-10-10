// PY-REF: none (DOT-only)
using System.Drawing;
using DotCore.Foundations;
using DotCore.TemplateMatcher;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// One-template checks on the D3 window (D3TemplateConfig table, global scale): on a given image, the shared last capture, or a fresh
/// capture. Shared by the features that confirm a screen state with a template (blacksmith window, Kanai recipe panel and page,
/// bounty map) instead of trusting coordinates or tracked flags.
/// </summary>
public static class D3TemplateProbe
{
    private const string LogTag = "[TemplateProbe]";

    /// <summary>First successful match of the template on the image; null when none.</summary>
    public static TemplateMatchResult? Match(Bitmap image, string templateName)
    {
        var match = D3ScaledTemplateMatcher.Instance.MatchTemplate(image, templateName).FirstMatch;
        ColorPrinter.Gray($"{LogTag} {templateName}: matched={match?.Success == true} center=({match?.CenterX},{match?.CenterY})");
        return match is { Success: true } ? match : null;
    }

    /// <summary>First template (in order) that matches the image, with its result; null when none matches.</summary>
    public static (string Name, TemplateMatchResult Match)? MatchAny(Bitmap image, params string[] templateNames)
    {
        foreach (var name in templateNames)
            if (Match(image, name) is { } m) return (name, m);
        return null;
    }

    /// <summary>
    /// Capture the D3 window now (stored as the shared last capture with its offset) and match the templates in order; null when
    /// no window, no capture or no match.
    /// </summary>
    public static (string Name, TemplateMatchResult Match)? CaptureAndMatchAny(bool activateFirst, params string[] templateNames)
    {
        var sd = D3Manager.Instance.CaptureGameWindow(activateFirst);
        if (sd?.GameWindowImage is not { } image) return null;
        GameInterfaceData.Instance.UpdateFromScreenshot(sd);
        return MatchAny(image, templateNames);
    }
}
