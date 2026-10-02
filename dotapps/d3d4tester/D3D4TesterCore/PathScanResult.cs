// PY-REF: pyapps/d3-check/d3utils/path_scanner.py
namespace DotApps.d3d4tester.Core;

/// <summary>
/// Result of path scan. Caller (e.g. d3d4tester app) writes to config and refreshes UI.
/// </summary>
public sealed class PathScanResult
{
    public string? BattlenetPath { get; set; }
    public string? D3Path { get; set; }
    public IReadOnlyList<string> RosbotDirs { get; set; } = Array.Empty<string>();
}
