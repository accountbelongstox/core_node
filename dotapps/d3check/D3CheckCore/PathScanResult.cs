namespace DotApps.d3check.Core;

/// <summary>
/// Result of path scan. Caller (e.g. d3check app) writes to config and refreshes UI.
/// </summary>
public sealed class PathScanResult
{
    public string? BattlenetPath { get; set; }
    public string? D3Path { get; set; }
    public IReadOnlyList<string> RosbotDirs { get; set; } = Array.Empty<string>();
}
