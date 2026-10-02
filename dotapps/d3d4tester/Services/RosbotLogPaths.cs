// PY-REF: pyapps/d3-check/providor/constants/common.py
using System.IO;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Default ROSBOT logs.txt path. 1:1 Python providor LOGS_FILE_PATH (Documents/RoS-BoT/Logs/logs.txt).
/// </summary>
public static class RosbotLogPaths
{
    public static string GetLogsFilePath()
    {
        string docs = Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments);
        return Path.Combine(docs, "RoS-BoT", "Logs", "logs.txt");
    }
}
