// PY-REF: none (DOT-only)
using System.Globalization;
using System.Text.RegularExpressions;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>Download amounts read from the game page: size text "7.84 / 194.40 GB" and rate button "1.18 MB/s" (bytes, 1024-based).</summary>
public sealed record BattlenetDownloadProgress(double DoneBytes, double TotalBytes, double? RateBytesPerSec)
{
    private static readonly Regex SizeRegex = new(@"^\s*(?<done>\d+(?:[.,]\d+)?)\s*(?<doneUnit>[KMGT]?B)?\s*/\s*(?<total>\d+(?:[.,]\d+)?)\s*(?<unit>[KMGT]?B)\s*$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly Regex RateRegex = new(@"(?<value>\d+(?:[.,]\d+)?)\s*(?<unit>[KMGT]?B)\s*/\s*s", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);
    private static readonly string[] Units = { "B", "KB", "MB", "GB", "TB" };

    public double Percent => TotalBytes > 0 ? Math.Clamp(DoneBytes * 100.0 / TotalBytes, 0, 100) : 0;

    public double RemainingBytes => Math.Max(0, TotalBytes - DoneBytes);

    /// <summary>Parsed size (and rate when readable), or null when the size text is missing or not "done / total unit".</summary>
    public static BattlenetDownloadProgress? Parse(string? size, string? rate)
    {
        if (string.IsNullOrWhiteSpace(size)) return null;
        var m = SizeRegex.Match(size);
        if (!m.Success) return null;
        string totalUnit = m.Groups["unit"].Value;
        string doneUnit = m.Groups["doneUnit"].Success ? m.Groups["doneUnit"].Value : totalUnit;
        double done = ToBytes(m.Groups["done"].Value, doneUnit);
        double total = ToBytes(m.Groups["total"].Value, totalUnit);
        return total > 0 ? new BattlenetDownloadProgress(done, total, ParseRate(rate)) : null;
    }

    public static double? ParseRate(string? rate)
    {
        if (string.IsNullOrWhiteSpace(rate)) return null;
        var m = RateRegex.Match(rate);
        return m.Success ? ToBytes(m.Groups["value"].Value, m.Groups["unit"].Value) : null;
    }

    /// <summary>"1.18 MB" style text for a byte count.</summary>
    public static string FormatBytes(double bytes)
    {
        int i = 0;
        while (bytes >= 1024 && i < Units.Length - 1)
        {
            bytes /= 1024;
            i++;
        }
        return bytes.ToString(i == 0 ? "0" : "0.00", CultureInfo.InvariantCulture) + " " + Units[i];
    }

    private static double ToBytes(string value, string unit)
    {
        double v = double.Parse(value.Replace(',', '.'), NumberStyles.Float, CultureInfo.InvariantCulture);
        int power = Array.FindIndex(Units, u => string.Equals(u, unit, StringComparison.OrdinalIgnoreCase));
        return v * Math.Pow(1024, Math.Max(0, power));
    }
}
