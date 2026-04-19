using System.IO;
using System.Runtime.InteropServices;

namespace DotApps.d3check.Core;

/// <summary>
/// Windows fixed drive roots for path scan. C last, others alphabetical. Aligned with Python d3utils.drive_order.
/// </summary>
public static class DriveOrder
{
    private static readonly object _cacheLock = new();
    private static string[]? _cachedRoots;

    public static void InvalidateCache()
    {
        lock (_cacheLock) _cachedRoots = null;
    }

    public static string[] GetFixedDriveRootsForScan(bool useCache = true)
    {
        if (useCache)
        {
            lock (_cacheLock)
            {
                if (_cachedRoots != null)
                    return _cachedRoots;
            }
        }

        if (!OperatingSystem.IsWindows())
        {
            lock (_cacheLock)
            {
                _cachedRoots = Array.Empty<string>();
                return _cachedRoots;
            }
        }

        try
        {
            uint bitmask = GetLogicalDrives();
            var fixedLetters = new List<char>();
            for (int i = 0; i < 26; i++)
            {
                if ((bitmask & (1u << i)) == 0) continue;
                string root = $"{(char)('A' + i)}:\\";
                uint driveType = GetDriveTypeW(root);
                if (driveType == DriveFixed)
                    fixedLetters.Add((char)('A' + i));
            }
            var ordered = fixedLetters.OrderBy(c => (c == 'C' ? 1 : 0, c)).ToList();
            var result = ordered.Select(c => $"{c}:\\").ToArray();
            lock (_cacheLock) _cachedRoots = result;
            return result;
        }
        catch
        {
            var fallback = new List<string>();
            for (char c = 'D'; c <= 'Z'; c++)
            {
                if (Directory.Exists($"{c}:\\")) fallback.Add($"{c}:\\");
            }
            if (Directory.Exists("C:\\")) fallback.Add("C:\\");
            var result = fallback.ToArray();
            lock (_cacheLock) _cachedRoots = result;
            return result;
        }
    }

    private const uint DriveRemovable = 2;
    private const uint DriveFixed = 3;
    private const uint DriveRemote = 4;
    private const uint DriveCdrom = 5;

    [DllImport("kernel32.dll", SetLastError = false, CharSet = CharSet.Unicode)]
    private static extern uint GetLogicalDrives();

    [DllImport("kernel32.dll", SetLastError = false, CharSet = CharSet.Unicode)]
    private static extern uint GetDriveTypeW([MarshalAs(UnmanagedType.LPWStr)] string lpRootPathName);
}
