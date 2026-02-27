namespace DotCore.Common;

/// <summary>
/// Common path helpers: user data directory, config file path. Cross-platform; uses BCL only.
/// Apps can use these to resolve config and data paths (e.g. D3Check config path).
/// </summary>
public static class AppPaths
{
    /// <summary>
    /// Default subfolder name under user profile for app data (e.g. ".core_node").
    /// </summary>
    public const string DefaultUserDataFolderName = ".core_node";

    /// <summary>
    /// Default config file name (e.g. "d3check_config.json"). App-specific; override in app or pass as argument.
    /// </summary>
    public const string DefaultConfigFileName = "config.json";

    /// <summary>
    /// Gets the user data directory (e.g. Environment.GetFolderPath(ApplicationData) or Home + DefaultUserDataFolderName).
    /// </summary>
    public static string GetUserDataDirectory(string? subfolderName = null)
    {
        string baseDir;
        if (OperatingSystem.IsWindows())
        {
            baseDir = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        }
        else
        {
            baseDir = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile)
                ?? Environment.GetEnvironmentVariable("HOME") ?? ".";
        }

        string folder = string.IsNullOrEmpty(subfolderName)
            ? Path.Combine(baseDir, DefaultUserDataFolderName)
            : Path.Combine(baseDir, subfolderName);

        return Path.GetFullPath(folder);
    }

    /// <summary>
    /// Gets the config file path under user data directory.
    /// </summary>
    public static string GetConfigFilePath(string? userDataSubfolder = null, string? configFileName = null)
    {
        string dir = GetUserDataDirectory(userDataSubfolder);
        string file = configFileName ?? DefaultConfigFileName;
        return Path.Combine(dir, file);
    }
}
