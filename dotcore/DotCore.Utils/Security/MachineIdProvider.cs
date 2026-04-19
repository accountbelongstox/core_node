using Microsoft.Win32;

namespace DotCore.Utils.Security;

/// <summary>
/// Machine-unique identifier for binding secrets to the current machine. 1:1 with Python pycore.pyutils.security.machine_id.
/// Windows: Registry MachineGuid; fallback wmic csproduct uuid.
/// </summary>
public static class MachineIdProvider
{
    private static string? _cached;

    /// <summary>Stable, machine-unique string (hex digest). Same machine yields same id across runs.</summary>
    public static string GetMachineId()
    {
        if (_cached != null) return _cached;
        string? raw = GetWindowsMachineGuid() ?? GetWindowsWmicUuid();
        if (string.IsNullOrWhiteSpace(raw))
            raw = $"{Environment.MachineName}|{GetFallbackNode()}";
        using var sha = System.Security.Cryptography.SHA256.Create();
        var bytes = sha.ComputeHash(System.Text.Encoding.UTF8.GetBytes(raw.Trim()));
        _cached = Convert.ToHexString(bytes).ToLowerInvariant();
        return _cached;
    }

    private static string? GetWindowsMachineGuid()
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SOFTWARE\Microsoft\Cryptography", false);
            var guid = key?.GetValue("MachineGuid") as string;
            return string.IsNullOrWhiteSpace(guid) ? null : guid.Trim();
        }
        catch
        {
            return null;
        }
    }

    private static string? GetWindowsWmicUuid()
    {
        if (!OperatingSystem.IsWindows()) return null;
        try
        {
            var start = new System.Diagnostics.ProcessStartInfo
            {
                FileName = "wmic",
                Arguments = "csproduct get uuid",
                RedirectStandardOutput = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var p = System.Diagnostics.Process.Start(start);
            if (p == null) return null;
            var outText = p.StandardOutput.ReadToEnd();
            p.WaitForExit(10000);
            if (p.ExitCode != 0 || string.IsNullOrWhiteSpace(outText)) return null;
            var line = outText.Split('\n').Select(l => l.Trim()).FirstOrDefault(l =>
                l.Length > 0 && !l.Equals("uuid", StringComparison.OrdinalIgnoreCase));
            return string.IsNullOrWhiteSpace(line) ? null : line;
        }
        catch
        {
            return null;
        }
    }

    private static string GetFallbackNode()
    {
        try
        {
            var nics = System.Net.NetworkInformation.NetworkInterface.GetAllNetworkInterfaces();
            var first = nics.FirstOrDefault(n => n.GetPhysicalAddress().GetAddressBytes().Length >= 6);
            if (first != null)
                return BitConverter.ToString(first.GetPhysicalAddress().GetAddressBytes());
        }
        catch { }
        return Guid.NewGuid().ToString("N");
    }
}
