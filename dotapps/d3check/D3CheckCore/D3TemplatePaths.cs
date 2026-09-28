namespace DotApps.d3check.Core;

/// <summary>
/// Resolves D3 template image directory. 1:1 with Python TEMPLATE_DIR = ROOT_DIR/images.
/// Prefer: same repo pyapps/d3-check/images; fallback: app base/Templates (user copies from Python).
/// </summary>
public static class D3TemplatePaths
{
    /// <summary>Subfolder under template dir for interface detection templates. File names: {TemplateName}.png.</summary>
    public const string TemplateExtension = ".png";

    /// <summary>
    /// Get directory containing D3 template images (bag_opened_indicator.png, kanai_cube_left_panel_indicator.png, etc.).
    /// Order: 1) repo pyapps/d3-check/images if exists, 2) AppBase/Templates.
    /// </summary>
    public static string GetTemplateDir()
    {
        var baseDir = AppContext.BaseDirectory ?? "";
        var repoImages = Path.GetFullPath(Path.Combine(baseDir, "..", "..", "..", "..", "pyapps", "d3-check", "images"));
        if (Directory.Exists(repoImages))
        {
            return repoImages;
        }
        var appTemplates = Path.Combine(baseDir, "Templates");
        return appTemplates;
    }

    /// <summary>Get full path for a template file by name (e.g. bag_opened_indicator -> .../bag_opened_indicator.png).</summary>
    public static string GetTemplatePath(string templateName)
    {
        var dir = GetTemplateDir();
        return Path.Combine(dir, templateName + TemplateExtension);
    }
}
