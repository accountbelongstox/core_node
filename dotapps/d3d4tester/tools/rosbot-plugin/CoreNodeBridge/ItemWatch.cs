// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Text.RegularExpressions;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>One affix attribute read from watched items: published key, ROSBOT AttributeId value, parameter and value type.</summary>
internal sealed class WatchedAttribute
{
    public string Key;
    public int Id;
    public uint Parameter;
    public bool IsInt;
}

/// <summary>
/// Items whose affixes the app wants (item_watch.txt, written by d3d4tester from a d3planner build): "g|gbid" and "n|internal name"
/// lines select items, "a|key|AttributeId name|parameter (empty = none)|f or i" lines the attributes read from them. Reloaded when the
/// file changes; only selected items are read, so the full inventory scan stays cheap. Unknown attribute names are skipped.
/// </summary>
internal sealed class ItemWatch
{
    public const string FileName = "item_watch.txt";
    private const uint NoParameter = 4294963200u;
    private const char Separator = '|';
    private const string KindGbid = "g";
    private const string KindName = "n";
    private const string KindAttribute = "a";
    private const string TypeInt = "i";
    private static readonly Regex InstanceSuffix = new(@"-\d+$", RegexOptions.CultureInvariant);

    private readonly Action<string> _log;
    private HashSet<int> _gbids = new();
    private HashSet<string> _names = new(StringComparer.OrdinalIgnoreCase);
    private List<WatchedAttribute> _attributes = new();
    private DateTime _stamp = DateTime.MinValue;

    public ItemWatch(Action<string> log) => _log = log;

    public bool IsEmpty => _gbids.Count == 0 && _names.Count == 0;

    public void Reload(string dir)
    {
        string path = Path.Combine(dir, FileName);
        try
        {
            var stamp = File.Exists(path) ? File.GetLastWriteTimeUtc(path) : DateTime.MinValue;
            if (stamp == _stamp) return;
            _stamp = stamp;
            var gbids = new HashSet<int>();
            var names = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var attributes = new List<WatchedAttribute>();
            var lines = stamp == DateTime.MinValue ? Array.Empty<string>() : File.ReadAllLines(path, Encoding.UTF8);
            foreach (var line in lines)
            {
                var parts = line.Split(Separator);
                if (parts.Length >= 2 && parts[0] == KindGbid && int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out int gbid))
                    gbids.Add(gbid);
                else if (parts.Length >= 2 && parts[0] == KindName && parts[1].Trim().Length > 0)
                    names.Add(parts[1].Trim());
                else if (parts.Length >= 5 && parts[0] == KindAttribute && TryAttributeId(parts[2], out int id))
                    attributes.Add(new WatchedAttribute
                    {
                        Key = parts[1],
                        Id = id,
                        Parameter = uint.TryParse(parts[3], NumberStyles.Integer, CultureInfo.InvariantCulture, out uint p) ? p : NoParameter,
                        IsInt = parts[4] == TypeInt,
                    });
            }
            _gbids = gbids;
            _names = names;
            _attributes = attributes;
            _log($"item watch: {gbids.Count} gbids, {names.Count} names, {attributes.Count} attributes");
        }
        catch (IOException) { }
    }

    public bool IsWatched(int gbid, string internalName) =>
        _gbids.Contains(gbid) || (!string.IsNullOrEmpty(internalName) && _names.Contains(Normalize(internalName)));

    /// <summary>Non-zero values of the watched attributes on the item ACD.</summary>
    public Dictionary<string, double> Read(IAcd acd)
    {
        var values = new Dictionary<string, double>(StringComparer.Ordinal);
        foreach (var a in _attributes)
        {
            double v = a.IsInt
                ? WorldScanner.Safe(() => acd.GetAttribute<int>(a.Id, a.Parameter), 0)
                : WorldScanner.Safe(() => acd.GetAttribute<float>(a.Id, a.Parameter), 0f);
            if (v != 0 && !double.IsNaN(v) && !double.IsInfinity(v)) values[a.Key] = v;
        }
        return values;
    }

    /// <summary>Actor internal name without the per-instance "-1234" suffix.</summary>
    public static string Normalize(string internalName) => InstanceSuffix.Replace(internalName.Trim(), "");

    private static bool TryAttributeId(string name, out int id)
    {
        id = WorldScanner.Safe(() => (int)Enum.Parse(typeof(AttributeId), name), int.MinValue);
        return id != int.MinValue;
    }
}
