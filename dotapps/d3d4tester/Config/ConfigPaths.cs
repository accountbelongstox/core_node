// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/project_path.py
using System.IO;
using DotApps.d3d4tester.Constants;

namespace DotApps.d3d4tester.Config;

/// <summary>
/// Config file and directory paths for D3D4Tester. Same logic as Python:
/// CURRENT_USER_DATA_PATH = ~/.core_node/.d3check, CONFIG_USER_PATH = {that}/d3check_config.json.
/// </summary>
public static class ConfigPaths
{
    private static readonly string UserDataDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".core_node", ".d3check");

    public static string CurrentUserDataPath => UserDataDir;
    /// <summary>Daily app log files (ColorPrinter file log).</summary>
    public static string LogDirectory => Path.Combine(UserDataDir, "logs");
    public static string ConfigUserPath => Path.Combine(UserDataDir, ConfigKeys.ConfigFileName);

    /// <summary>App-local data root: %LOCALAPPDATA%\d3d4tester (debug captures, generated docs).</summary>
    public static string LocalAppDataDir => Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), AppConstants.AppDataDirName);

    /// <summary>Assistant / town navigation debug captures.</summary>
    public static string DebugCaptureDir => Path.Combine(LocalAppDataDir, DebugCaptureDirName);

    private const string DebugCaptureDirName = "debug_capture";
}
