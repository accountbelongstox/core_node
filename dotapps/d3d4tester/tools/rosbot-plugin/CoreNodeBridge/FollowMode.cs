// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Follow a party member (app command "follow"). Target modes: nearest player, a selected player (actor id, kept across worlds by
/// ACD id / party slot), the party leader (player ACD attribute Leader, else party slot 1) or party slot N. Party slots come from the
/// town banners: Banner_Player_{slot}_Act* carries Banner_ACDID = the owner's ACD id (learned whenever banners are in range).
/// Every tick it walks towards the target when farther than FollowDistance; with pickup on it first picks up matching items near the
/// target. Lost (target not in this world for LostMs): in town it first waits for the app's town work (TownHold, state town_tasks), then
/// walks to the target's banner and uses it: the banner whose owner (Banner_ACDID) is the target's last seen ACD, else the target's party
/// slot, else 1-4 in turn; outside town it reports needs_town so the app presses the town portal key. With revive on, a dead hero accepts a teammate's resurrection at once
/// (death menu "accept resurrection", shown while Waiting_To_Accept_Resurrection is set); otherwise after ReviveWaitMs it presses
/// revive at corpse, else at checkpoint, else in town (every ReviveRetryMs). The plugin never attacks.
/// With combat assist on (follow only and fight): the plugin keeps ROSBOT held (PulseHold, requested by the plugin), so ROSBOT runs no
/// task (no town run, no own route) and the plugin is the only mover; no town work is taken (TownHold); monsters around the target come
/// first (CombatAssist steps to them while the target is within its leash), pickup waits for the fight to end.
/// </summary>
internal sealed class FollowMode
{
    public const string StateOff = "off";
    public const string StateFollowing = "following";
    public const string StateLost = "lost";
    public const string StateNeedsTown = "needs_town";
    public const string StateBanner = "banner";
    public const string StateDead = "dead";
    public const string StateTownTasks = "town_tasks";
    public const string StateFighting = "fighting";
    public const string ModeNearest = "nearest";
    public const string ModeSelected = "selected";
    public const string ModeLeader = "leader";
    public const string ModeSlot = "slot";
    private const string BannerPrefix = "Banner_Player_";
    private const string AttrBannerAcd = "Banner_ACDID";
    private const string AttrLeader = "Leader";
    private const int LeaderSlot = 1;
    private const int MaxSlots = 4;
    private const float FollowDistance = 10f;
    private const float StepReach = 6f;
    private const int StepMs = 800;
    private const int LostMs = 3000;
    private const int BannerRetryMs = 8000;
    private const float BannerReach = 8f;
    private const int BannerWalkMs = 15000;
    private const float PickupRange = 30f;
    private const float PickupLeaderRange = 25f;
    private const int ReviveWaitMs = 8000;
    private const int ReviveRetryMs = 2000;
    private const string AttrWaitingToAccept = "Waiting_To_Accept_Resurrection";

    private readonly Action<string> _log;
    private readonly Stopwatch _sinceSeen = Stopwatch.StartNew();
    private readonly Stopwatch _sinceBanner = new();
    private readonly Dictionary<int, int> _slotByAcd = new();
    private readonly Stopwatch _deadFor = new();
    private readonly Stopwatch _sinceRevive = new();
    private string _mode = ModeNearest;
    private uint _selectedId;
    private int _selectedAcd;
    private int _targetAcd;
    private int _targetSlot;
    private int _bannerSlot;
    private int _nextBanner = 1;
    private IActor _banner;
    private int _bannerUsedSlot;
    private readonly Stopwatch _bannerWalk = new();

    public FollowMode(Action<string> log) => _log = log;

    /// <summary>Set by the plugin: a bridge command is moving the hero; follow waits instead of walking at the same time.</summary>
    public Func<bool> CommandBusy { get; set; }

    /// <summary>Set by the plugin: the app's town work, done before a banner is taken.</summary>
    public TownHold TownHold { get; set; }

    /// <summary>Set by the plugin: pick up one matching ground item within a range (BridgeCommands.PickupNearestMatching).</summary>
    public Func<float, bool> PickupHandler { get; set; }

    public bool Pickup { get; private set; }
    public bool Revive { get; private set; }
    public bool Enabled { get; private set; }

    /// <summary>Set by the plugin: the shared combat assist (follow only and fight while it is on).</summary>
    public CombatAssist Assist { get; set; }

    private bool Assisting => Assist?.Enabled == true;
    public string Mode => _mode;
    public string State { get; private set; } = StateOff;
    public string Leader { get; private set; } = "";
    public double Distance { get; private set; } = -1;

    /// <summary>Party slot of a player ACD (from the banners), 0 when unknown.</summary>
    public int SlotOf(int acdId) => _slotByAcd.TryGetValue(acdId, out int slot) ? slot : 0;

    public static bool IsLeader(IActor player) =>
        WorldScanner.Safe(() => player.CommData, null) is { } acd && WorldScanner.Attribute(acd, AttrLeader, 0) != 0;

    /// <summary>mode = nearest / selected / leader / slot; selectedId = actor id for selected; slot = party slot for slot mode; bannerSlot 0 = auto.</summary>
    public void Start(string mode, uint selectedId, int slot, int bannerSlot, bool pickup, bool revive)
    {
        Enabled = true;
        Revive = revive;
        _mode = mode;
        _selectedId = selectedId;
        _selectedAcd = 0;
        _targetAcd = 0;
        _targetSlot = slot;
        _bannerSlot = bannerSlot;
        Pickup = pickup;
        _sinceSeen.Restart();
        State = StateFollowing;
        _log($"follow on: mode {mode}, selected {selectedId}, slot {slot}, banner {(bannerSlot == 0 ? "auto" : bannerSlot.ToString())}, pickup {pickup}, revive {revive}, assist {Assisting}");
    }

    public void Stop()
    {
        Enabled = false;
        _banner = null;
        State = StateOff;
        Distance = -1;
        _log("follow off");
    }

    /// <summary>Learn party slots from the banners in range (call every tick; cheap when there are none).</summary>
    public void LearnBanners(IActor[] actors)
    {
        foreach (var banner in actors)
        {
            string name = WorldScanner.Safe(() => banner.Name, "") ?? "";
            if (!name.StartsWith(BannerPrefix, StringComparison.OrdinalIgnoreCase)) continue;
            int slot = BannerSlot(name);
            if (slot <= 0) continue;
            int owner = BannerOwner(banner);
            if (owner != 0 && SlotOf(owner) != slot)
            {
                _slotByAcd[owner] = slot;
                _log($"follow: banner {slot} belongs to player ACD {owner}");
            }
        }
    }

    public void Tick()
    {
        if (!Enabled || !WorldScanner.Safe(() => LocalPlayer.IsValid && LocalPlayer.IsInGame, false)) return;
        if (WorldScanner.Safe(() => LocalPlayer.IsDead, false))
        {
            State = StateDead;
            Assist?.Clear();
            TryRevive();
            return;
        }
        _deadFor.Reset();
        if (CommandBusy?.Invoke() == true) return;
        var actors = WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>());
        LearnBanners(actors);
        var target = PickTarget(WorldScanner.Players(actors));
        var monster = Assist?.Scan(actors, target);
        if (target != null)
        {
            _sinceSeen.Restart();
            _banner = null;
            _targetAcd = WorldScanner.Safe(() => target.AcdId, _targetAcd);
            Leader = WorldScanner.Safe(() => target.Name, "") ?? "";
            Distance = WorldScanner.Safe(() => target.Distance, -1f);
            State = StateFollowing;
            if (monster != null && Distance <= CombatAssist.LeashDistance)
            {
                State = StateFighting;
                Assist.Step(monster, target);
                return;
            }
            if (Pickup && Assist?.Combat != true && Distance <= PickupLeaderRange && PickupHandler?.Invoke(PickupRange) == true) return;
            if (Distance > FollowDistance)
            {
                var sw = Stopwatch.StartNew();
                var position = WorldScanner.Safe(() => target.Position, LocalPlayer.Position);
                WorldScanner.Safe(() => { LocalPlayer.CoreMoveTo(position, () => sw.ElapsedMilliseconds > StepMs, StepReach); return true; }, false);
            }
            return;
        }
        Distance = -1;
        if (monster != null)
        {
            State = StateFighting;
            Assist.Step(monster, null);
            return;
        }
        if (_sinceSeen.ElapsedMilliseconds < LostMs) return;
        if (!WorldScanner.Safe(() => LocalPlayer.IsInTown, false))
        {
            _banner = null;
            State = StateNeedsTown;
            return;
        }
        if (!Assisting && TownHold?.TryBegin(TownHold.ReasonFollow) == true)
        {
            State = StateTownTasks;
            return;
        }
        if (_banner != null)
        {
            StepBanner();
            return;
        }
        State = StateLost;
        if (_sinceBanner.IsRunning && _sinceBanner.ElapsedMilliseconds < BannerRetryMs) return;
        _sinceBanner.Restart();
        UseBanner(actors);
    }

    /// <summary>Dead: after ReviveWaitMs press the first revive button the death menu shows (corpse, checkpoint, town).</summary>
    private void TryRevive()
    {
        if (!Revive) return;
        if (!_deadFor.IsRunning) _deadFor.Restart();
        ulong accept = UiIds.Of(UiIds.AcceptResurrection);
        if (WorldScanner.Safe(() => Context.HasUIElement(accept), false))
        {
            bool waiting = WorldScanner.Safe(() => LocalPlayer.GetAttribute<int>(WorldScanner.AttributeId(AttrWaitingToAccept)), 0) != 0;
            if (_sinceRevive.IsRunning && _sinceRevive.ElapsedMilliseconds < ReviveRetryMs) return;
            _sinceRevive.Restart();
            Context.ClickUIElement(accept);
            _log($"follow: accepted resurrection (waiting attribute {waiting})");
            return;
        }
        if (_deadFor.ElapsedMilliseconds < ReviveWaitMs || (_sinceRevive.IsRunning && _sinceRevive.ElapsedMilliseconds < ReviveRetryMs)) return;
        _sinceRevive.Restart();
        if (UiIds.ClickFirstShown(UiIds.ReviveButtons) is { } clicked) _log("follow: revive " + UiIds.ShortName(clicked));
    }

    /// <summary>The player to follow in this world, null when not here.</summary>
    private IActor PickTarget(List<IActor> players)
    {
        int Acd(IActor p) => WorldScanner.Safe(() => p.AcdId, 0);
        switch (_mode)
        {
            case ModeSelected:
            {
                var byId = players.FirstOrDefault(p => WorldScanner.Safe(() => p.RActorId, 0u) == _selectedId)
                           ?? players.FirstOrDefault(p => _selectedAcd != 0 && Acd(p) == _selectedAcd);
                if (byId != null) _selectedAcd = Acd(byId);
                return byId;
            }
            case ModeLeader:
                return players.FirstOrDefault(IsLeader) ?? players.FirstOrDefault(p => SlotOf(Acd(p)) == LeaderSlot);
            case ModeSlot:
                return players.FirstOrDefault(p => SlotOf(Acd(p)) == _targetSlot);
            default:
                return players.FirstOrDefault();
        }
    }

    /// <summary>Banner to use when lost: the configured one, else the target's party slot, else the next of 1-4.</summary>
    private int BannerForTarget()
    {
        if (_bannerSlot > 0) return _bannerSlot;
        int slot = _mode switch
        {
            ModeLeader => LeaderSlot,
            ModeSlot => _targetSlot,
            ModeSelected => SlotOf(_selectedAcd),
            _ => 0,
        };
        if (slot > 0) return slot;
        slot = _nextBanner;
        _nextBanner = _nextBanner % MaxSlots + 1;
        return slot;
    }

    private void UseBanner(IActor[] actors)
    {
        var banners = actors
            .Where(a => WorldScanner.Safe(() => a.IsValid, false) && (WorldScanner.Safe(() => a.Name, "") ?? "").StartsWith(BannerPrefix, StringComparison.OrdinalIgnoreCase))
            .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
            .ToList();
        var banner = _bannerSlot == 0 && _targetAcd != 0 ? banners.FirstOrDefault(b => BannerOwner(b) == _targetAcd) : null;
        int slot = banner != null ? BannerSlot(WorldScanner.Safe(() => banner.Name, "") ?? "") : BannerForTarget();
        banner ??= banners.FirstOrDefault(b => BannerSlot(WorldScanner.Safe(() => b.Name, "") ?? "") == slot);
        if (banner == null)
        {
            _log($"follow: banner {slot} not found in town ({banners.Count} banners)");
            return;
        }
        _banner = banner;
        _bannerUsedSlot = slot;
        _bannerWalk.Restart();
        StepBanner();
    }

    /// <summary>One tick of the banner walk (never blocks the plugin tick longer than StepMs): step closer, then use it; gives up after BannerWalkMs.</summary>
    private void StepBanner()
    {
        var banner = _banner;
        State = StateBanner;
        if (!WorldScanner.Safe(() => banner.IsValid, false) || _bannerWalk.ElapsedMilliseconds > BannerWalkMs)
        {
            _log($"follow: banner {_bannerUsedSlot} not reached in {BannerWalkMs / 1000}s");
            _banner = null;
            return;
        }
        if (WorldScanner.Safe(() => banner.Distance, float.MaxValue) > BannerReach)
        {
            var sw = Stopwatch.StartNew();
            var position = WorldScanner.Safe(() => banner.Position, LocalPlayer.Position);
            WorldScanner.Safe(() => { LocalPlayer.CoreMoveTo(position, () => sw.ElapsedMilliseconds > StepMs, BannerReach); return true; }, false);
            return;
        }
        WorldScanner.Safe(() => { LocalPlayer.Interact(banner, true, true, banner.Position); return true; }, false);
        _log($"follow: used banner {_bannerUsedSlot} ({WorldScanner.Safe(() => banner.Distance, -1f):0.0})");
        _banner = null;
    }

    private static int BannerOwner(IActor banner) =>
        WorldScanner.Safe(() => banner.CommData, null) is { } acd ? WorldScanner.Attribute(acd, AttrBannerAcd, 0) : 0;

    /// <summary>Party slot from a banner name "Banner_Player_{slot}_Act{n}", 0 when not parsable.</summary>
    private static int BannerSlot(string name)
    {
        string rest = name.Substring(BannerPrefix.Length);
        int end = rest.IndexOf('_');
        return int.TryParse(end < 0 ? rest : rest.Substring(0, end), out int slot) && slot is > 0 and <= MaxSlots ? slot : 0;
    }
}
