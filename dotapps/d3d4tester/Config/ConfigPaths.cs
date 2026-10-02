// PY-REF: pyapps/d3-check/share/project_path.py
using System.IO;

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
    public static string ConfigUserPath => Path.Combine(UserDataDir, "d3check_config.json");
}
