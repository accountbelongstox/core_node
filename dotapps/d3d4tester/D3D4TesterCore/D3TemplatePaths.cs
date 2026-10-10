// PY-REF: dotapps/d3d4tester/reference/py_d3check/providor/constants/common.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// Resolves D3 template image directory. 1:1 with Python TEMPLATE_DIR = ROOT_DIR/images (moved to dotapps/d3d4tester/Templates).
/// Prefer: source dotapps/d3d4tester/Templates (SourcePaths, works with the out-of-repo artifacts path, edits apply without a
/// rebuild); fallback: app base/Templates (copied from the source Templates by the build).
/// </summary>
public static class D3TemplatePaths
{
    /// <summary>Subfolder under template dir for interface detection templates. File names: {TemplateName}.png.</summary>
    public const string TemplateExtension = ".png";

    /// <summary>Template folder next to the app (build copies dotapps/d3d4tester/Templates).</summary>
    public const string AppTemplatesDirName = "Templates";

    /// <summary>
    /// Get directory containing D3 template images (bag_opened_indicator.png, kanai_cube_left_panel_indicator.png, etc.).
    /// Order: 1) source dotapps/d3d4tester/Templates if exists, 2) AppBase/Templates.
    /// </summary>
    public static string GetTemplateDir()
    {
        if (SourcePaths.AppSourceDir is { } src && Path.Combine(src, AppTemplatesDirName) is var dir && Directory.Exists(dir)) return dir;
        return Path.Combine(AppContext.BaseDirectory ?? "", AppTemplatesDirName);
    }

    /// <summary>Get full path for a template file by name (e.g. bag_opened_indicator -> .../bag_opened_indicator.png).</summary>
    public static string GetTemplatePath(string templateName)
    {
        var dir = GetTemplateDir();
        return Path.Combine(dir, templateName + TemplateExtension);
    }
}
