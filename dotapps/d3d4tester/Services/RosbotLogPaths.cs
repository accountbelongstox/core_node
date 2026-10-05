// PY-REF: pyapps/d3-check/providor/constants/common.py
using System.IO;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Default ROSBOT logs.txt path. 1:1 Python providor LOGS_FILE_PATH (Documents/RoS-BoT/Logs/logs.txt).
/// </summary>
public static class RosbotLogPaths
{
    private const string RosbotDocumentsDir = "RoS-BoT";
    private const string LogsDir = "Logs";
    private const string LogsFileName = "logs.txt";
    private const string HistoryFileName = "history.txt";
    private const string GlobalSettingsFileName = "RosBotGlobalSettings.ini";

    public static string GetRosbotDocumentsDirectory() =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), RosbotDocumentsDir);

    public static string GetLogsDirectory() => Path.Combine(GetRosbotDocumentsDirectory(), LogsDir);

    public static string GetLogsFilePath() => Path.Combine(GetLogsDirectory(), LogsFileName);

    /// <summary>ROSBOT run history (one line per finished run), tailed by the monitor.</summary>
    public static string GetHistoryFilePath() => Path.Combine(GetLogsDirectory(), HistoryFileName);

    /// <summary>ROSBOT global settings (DebugLevel = NoLogs disables logs.txt).</summary>
    public static string GetGlobalSettingsPath() => Path.Combine(GetRosbotDocumentsDirectory(), GlobalSettingsFileName);
}
