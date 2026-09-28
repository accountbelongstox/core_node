using System.Diagnostics;

namespace DotCore.UIInspect;

public static class ProcessLauncher
{
    public static Process? Launch(string exePath)
    {
        if (!File.Exists(exePath))
            return null;

        var startInfo = new ProcessStartInfo
        {
            FileName = exePath,
            UseShellExecute = true,
            WorkingDirectory = Path.GetDirectoryName(exePath) ?? ""
        };

        var process = Process.Start(startInfo);
        return process;
    }
}
