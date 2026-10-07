// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Linq;

namespace CoreNodeBridge;

/// <summary>One pickup (or stash event) in the live record.</summary>
internal sealed class PickupRecord
{
    public DateTime Utc;
    public string Kind = "";
    public string Name = "";
    public string InternalName = "";
    public int Sno;
    public int Gbid;
    public int Quality = -1;
    public int AncientRank = -1;
    public Dictionary<string, double> Attrs;
}

/// <summary>
/// Live pickup record. ROSBOT raises no pickup event, so an item counts as picked when it vanishes from the ground while it
/// was within PickupRadius of the hero, seen in the previous scan, in the same world, with the hero alive. Stash events come
/// from ROSBOT's OnItemStash.
/// </summary>
internal sealed class PickupTracker
{
    public const string KindPickup = "pickup";
    public const string KindStash = "stash";
    private const double PickupRadius = 6;
    private const int MaxRecords = 80;
    private static readonly TimeSpan MaxGap = TimeSpan.FromSeconds(2);

    private readonly Dictionary<uint, EntityInfo> _near = new();
    private readonly List<PickupRecord> _records = new();
    private DateTime _lastScanUtc = DateTime.MinValue;
    private int _lastWorld;

    public IReadOnlyList<PickupRecord> Records => _records;

    public int PickedCount { get; private set; }

    /// <summary>Compare with the previous scan; returns the new pickups (already recorded).</summary>
    public List<PickupRecord> Update(List<EntityInfo> groundItems, int worldId, bool heroAlive, DateTime nowUtc)
    {
        var picked = new List<PickupRecord>();
        bool comparable = worldId == _lastWorld && heroAlive && nowUtc - _lastScanUtc <= MaxGap;
        if (comparable)
        {
            var present = new HashSet<uint>(groundItems.Select(g => g.Id));
            foreach (var gone in _near.Values.Where(n => !present.Contains(n.Id)))
            {
                var record = new PickupRecord
                {
                    Utc = nowUtc, Kind = KindPickup, Name = gone.Name, InternalName = gone.InternalName,
                    Sno = gone.Sno, Gbid = gone.Gbid, Quality = gone.Quality, AncientRank = gone.AncientRank, Attrs = gone.Attrs,
                };
                Add(record);
                PickedCount++;
                picked.Add(record);
            }
        }
        _near.Clear();
        foreach (var g in groundItems.Where(g => g.Distance <= PickupRadius)) _near[g.Id] = g;
        _lastWorld = worldId;
        _lastScanUtc = nowUtc;
        return picked;
    }

    public PickupRecord AddStash(string description, DateTime nowUtc)
    {
        var record = new PickupRecord { Utc = nowUtc, Kind = KindStash, Name = description ?? "" };
        Add(record);
        return record;
    }

    private void Add(PickupRecord record)
    {
        _records.Insert(0, record);
        if (_records.Count > MaxRecords) _records.RemoveAt(_records.Count - 1);
    }
}
