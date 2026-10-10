// PY-REF: none (DOT-only)
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Services.Monitor;
using DotCore.Utils;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// ROSBOT's DebugLevel ([SettingsField] "DebugLevel", Category Debug, values Full / Normal / NoLogs; Documents/RoS-BoT/
/// RosBotGlobalSettings.ini, [BotParameters]): with rosbot.debug_level_full on (default) the app writes Full before every ROSBOT start
/// and at once when switched, so ROSBOT logs its developer information (targets, movements, decisions); off writes Normal. ROSBOT reads
/// the ini at its start, so a switch applies on the next ROSBOT start. Written like the license key (RosbotKeyService): the line is
/// replaced in place, else added next to ROSBOT's other Debug fields.
/// </summary>
public static class RosbotDebugLevelService
{
    private const string LogTag = "[RosbotDebugLevel]";
    private const string IniKeyName = "DebugLevel";
    private const string LevelFull = "Full";
    private const string LevelNormal = "Normal";
    private static readonly string[] IniAnchorKeys = { "Overlay", "DisplayMovements", "LocalSkill", "LocalPickit", "SceneVersion", "TosAccepted" };
    private static int _installed;

    public static bool Enabled => ConfigBinding.GetValue(ConfigKeys.RosbotDebugLevelFull, ConfigKeys.RosbotDebugLevelFullDefault);

    public static void Install()
    {
        if (Interlocked.Exchange(ref _installed, 1) == 1) return;
        RosbotManager.Instance.AddBeforeStartHook(_ => Apply());
    }

    /// <summary>Write Full (switch on) or Normal (off) to ROSBOT's global settings ini; null when it could not be written.</summary>
    public static IniSetResult? Apply()
    {
        string iniPath = RosbotKeyService.IniPath;
        string level = Enabled ? LevelFull : LevelNormal;
        try
        {
            var result = IniFileEditor.SetValue(iniPath, IniKeyName, level, IniAnchorKeys);
            string line = $"{LogTag} {IniKeyName}={level} -> {iniPath}: {result}";
            if (result == IniSetResult.NoAnchor) MonitorLog.Warn(line);
            else MonitorLog.Info(line);
            return result;
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            MonitorLog.Warn($"{LogTag} {iniPath} not written: {ex.Message}");
            return null;
        }
    }
}
