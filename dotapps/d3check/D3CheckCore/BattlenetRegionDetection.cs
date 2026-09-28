using System.IO;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace DotApps.d3check.Core;

/// <summary>
/// Detect Battle.net region from config file. Aligned with Python _initialize_battlenet_region_from_config.
/// Config path: e.g. %APPDATA%\Roaming\Battle.net\Battle.net.config.
/// Services.LastLoginRegion: CN -> "cn", non-CN (KR/US/EU/TW etc.) -> "asia".
/// </summary>
public static class BattlenetRegionDetection
{
    private const string ServicesKey = "Services";
    private const string LastLoginRegionKey = "LastLoginRegion";
    private const string RegionCn = "CN";

    /// <summary>Default Battle.net config path (Windows).</summary>
    public static string GetDefaultConfigPath()
    {
        string appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "Battle.net", "Battle.net.config");
    }

    /// <summary>Detect region from config file. Returns "cn" | "asia" | null.</summary>
    public static string? DetectRegion(string? configPath = null)
    {
        string path = configPath ?? GetDefaultConfigPath();
        if (string.IsNullOrEmpty(path) || !File.Exists(path))
            return null;
        try
        {
            string json = File.ReadAllText(path);
            using var doc = JsonDocument.Parse(json);
            string? lastLogin = FindLastLoginRegionRecursive(doc.RootElement);
            if (string.IsNullOrWhiteSpace(lastLogin))
                return null;
            bool isCn = lastLogin.Trim().Equals(RegionCn, StringComparison.OrdinalIgnoreCase);
            return isCn ? "cn" : "asia";
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Ensure Battle.net region in GameInterfaceData from config file then cache. 1:1 Python ensure_battlenet_region_from_config. Call at startup and when region is needed.</summary>
    public static void EnsureRegionFromConfigAndCache(
        Func<string?> getRegionFromData,
        Action<string?> setRegionToData,
        Func<string?> getCachedRegion,
        Action<string> setCachedRegion)
    {
        if (getRegionFromData() != null)
            return;
        string? region = DetectRegion();
        if (region == "asia" || region == "cn")
        {
            setRegionToData(region);
            if (region != null)
                setCachedRegion(region);
            return;
        }
        string? cached = getCachedRegion();
        if (cached == "asia" || cached == "cn")
            setRegionToData(cached);
    }

    private static string? FindLastLoginRegionRecursive(JsonElement element)
    {
        if (element.ValueKind == JsonValueKind.Object)
        {
            if (element.TryGetProperty(ServicesKey, out var services) && services.ValueKind == JsonValueKind.Object &&
                services.TryGetProperty(LastLoginRegionKey, out var region))
            {
                if (region.ValueKind == JsonValueKind.String)
                {
                    var s = region.GetString();
                    if (!string.IsNullOrWhiteSpace(s)) return s.Trim();
                }
                return null;
            }
            foreach (var prop in element.EnumerateObject())
            {
                var found = FindLastLoginRegionRecursive(prop.Value);
                if (found != null) return found;
            }
        }
        else if (element.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in element.EnumerateArray())
            {
                var found = FindLastLoginRegionRecursive(item);
                if (found != null) return found;
            }
        }
        return null;
    }
}
