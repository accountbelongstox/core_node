// PY-REF: none (DOT-only)
using System;
using System.Diagnostics;
using System.Linq;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Follow a party member (app command "follow"): every tick, walk towards the leader (the chosen player, else the nearest other
/// player) when farther than FollowDistance. Lost (no other player in this world for LostMs): in town, walk to the leader's banner
/// (Banner_Player_{slot}_Act*, slot 0 = try every banner in turn) and use it; outside town the state asks the app for a town portal
/// (needs_town), since the plugin API cannot press keys. With pickup on, items matching the pickup filter within PickupRange are
/// picked up while the leader is close. The plugin never attacks. State, leader and distance are published in state.json.
/// </summary>
internal sealed class FollowMode
{
    public const string StateOff = "off";
    public const string StateFollowing = "following";
    public const string StateLost = "lost";
    public const string StateNeedsTown = "needs_town";
    public const string StateBanner = "banner";
    private const string BannerPrefix = "Banner_Player_";
    private const float FollowDistance = 10f;
    private const float StepReach = 6f;
    private const int StepMs = 800;
    private const int LostMs = 3000;
    private const int BannerRetryMs = 8000;
    private const float BannerReach = 8f;
    private const int BannerWalkMs = 15000;
    private const float PickupRange = 30f;
    private const float PickupLeaderRange = 25f;

    private readonly Action<string> _log;
    private readonly Stopwatch _sinceSeen = Stopwatch.StartNew();
    private readonly Stopwatch _sinceBanner = new();
    private uint _leaderId;
    private int _bannerSlot;
    private int _nextBanner = 1;

    public FollowMode(Action<string> log) => _log = log;

    /// <summary>Set by the plugin: pick up one matching ground item within a range (BridgeCommands.PickupNearestMatching).</summary>
    public Func<float, bool> PickupHandler { get; set; }

    public bool Pickup { get; private set; }

    public bool Enabled { get; private set; }
    public string State { get; private set; } = StateOff;
    public string Leader { get; private set; } = "";
    public double Distance { get; private set; } = -1;

    public void Start(uint leaderId, int bannerSlot, bool pickup)
    {
        Enabled = true;
        Pickup = pickup;
        _leaderId = leaderId;
        _bannerSlot = bannerSlot;
        _sinceSeen.Restart();
        State = StateFollowing;
        _log($"follow on: leader {(leaderId == 0 ? "nearest player" : leaderId.ToString())}, banner {(bannerSlot == 0 ? "auto" : bannerSlot.ToString())}, pickup {pickup}");
    }

    public void Stop()
    {
        Enabled = false;
        State = StateOff;
        Distance = -1;
        _log("follow off");
    }

    public void Tick()
    {
        if (!Enabled || !WorldScanner.Safe(() => LocalPlayer.IsValid && LocalPlayer.IsInGame && !LocalPlayer.IsDead, false)) return;
        var players = WorldScanner.Players(WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()));
        var leader = players.FirstOrDefault(p => WorldScanner.Safe(() => p.RActorId, 0u) == _leaderId) ?? players.FirstOrDefault();
        if (leader != null)
        {
            _leaderId = WorldScanner.Safe(() => leader.RActorId, 0u);
            _sinceSeen.Restart();
            Leader = WorldScanner.Safe(() => leader.Name, "") ?? "";
            Distance = WorldScanner.Safe(() => leader.Distance, -1f);
            State = StateFollowing;
            if (Pickup && Distance <= PickupLeaderRange && PickupHandler?.Invoke(PickupRange) == true) return;
            if (Distance > FollowDistance)
            {
                var sw = Stopwatch.StartNew();
                var target = WorldScanner.Safe(() => leader.Position, LocalPlayer.Position);
                WorldScanner.Safe(() => { LocalPlayer.CoreMoveTo(target, () => sw.ElapsedMilliseconds > StepMs, StepReach); return true; }, false);
            }
            return;
        }
        Distance = -1;
        if (_sinceSeen.ElapsedMilliseconds < LostMs) return;
        if (!WorldScanner.Safe(() => LocalPlayer.IsInTown, false))
        {
            State = StateNeedsTown;
            return;
        }
        State = StateLost;
        if (_sinceBanner.IsRunning && _sinceBanner.ElapsedMilliseconds < BannerRetryMs) return;
        _sinceBanner.Restart();
        UseBanner();
    }

    /// <summary>Walk to the leader's banner (or the next one when the slot is unknown) and use it.</summary>
    private void UseBanner()
    {
        int slot = _bannerSlot > 0 ? _bannerSlot : _nextBanner;
        if (_bannerSlot == 0) _nextBanner = _nextBanner % 4 + 1;
        string prefix = BannerPrefix + slot + "_";
        var banner = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>())
            .Where(a => WorldScanner.Safe(() => a.IsValid, false) && (WorldScanner.Safe(() => a.Name, "") ?? "").StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
            .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
            .FirstOrDefault();
        if (banner == null)
        {
            _log($"follow: banner {slot} not found in town");
            return;
        }
        State = StateBanner;
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < BannerWalkMs && WorldScanner.Safe(() => banner.Distance, 0f) > BannerReach)
        {
            var target = WorldScanner.Safe(() => banner.Position, LocalPlayer.Position);
            WorldScanner.Safe(() => { LocalPlayer.CoreMoveTo(target, () => sw.ElapsedMilliseconds > BannerWalkMs, BannerReach); return true; }, false);
        }
        LocalPlayer.Interact(banner, true, true, banner.Position);
        _log($"follow: used banner {slot} ({banner.Distance:0.0})");
    }
}
