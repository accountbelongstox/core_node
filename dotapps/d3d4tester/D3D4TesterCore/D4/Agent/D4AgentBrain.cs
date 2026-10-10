// PY-REF: none (DOT-only)
using DotCore.YoloDetect;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>
/// Rule-based finite state machine: every frame checks, in priority order, death, low health, danger area, open menu, boss, elite,
/// monster, wanted loot, interactable, pinned minimap route and exploration, and returns one action. It keeps skill / potion cooldowns, confirms the previous
/// action against the new frame (pickup: the drop is gone; move: the map moved) and recovers from failures (drops and interactables
/// that do not react are blacklisted for a while; repeated moves without map displacement trigger the stuck escape).
/// One instance per session.
/// </summary>
public sealed class D4AgentBrain
{
    private readonly D4AgentSettings _settings;
    private readonly D4MinimapTracker _map;
    private readonly Dictionary<string, DateTime> _keyUsedUtc = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<int, int> _attempts = new();
    private readonly Dictionary<int, DateTime> _blacklist = new();
    private readonly Random _random = new();
    private D4AgentDecision? _previous;
    private Point2d _lastMoveDirection;
    private int _stillMoves;
    private int _escapeLeft;
    private Point2d _escapeDirection;
    private bool _wasDead;

    public D4AgentBrain(D4AgentSettings settings, D4MinimapTracker map)
    {
        _settings = settings;
        _map = map;
    }

    public long Deaths { get; private set; }

    public long StuckEvents { get; private set; }

    public long LootPicked { get; private set; }

    public long LootAbandoned { get; private set; }

    public D4AgentDecision Decide(D4Observation o)
    {
        var now = DateTime.UtcNow;
        foreach (var expired in _blacklist.Where(b => b.Value <= now).Select(b => b.Key).ToList()) _blacklist.Remove(expired);
        ConfirmPrevious(o);
        var decision = DecideCore(o, now);
        _previous = decision;
        return decision;
    }

    /// <summary>Caller reports that the decision was executed (cooldowns start only for real input).</summary>
    public void MarkExecuted(D4AgentDecision decision)
    {
        if (decision.Key != null) _keyUsedUtc[decision.Key] = DateTime.UtcNow;
    }

    private D4AgentDecision DecideCore(D4Observation o, DateTime now)
    {
        var vitals = o.Vitals;
        var revive = o.Confirmed(D4AgentClasses.ReviveButton).MaxBy(t => t.Confidence);
        if (vitals.DeathScreen || revive != null)
        {
            if (!_wasDead) Deaths++;
            _wasDead = true;
            return revive != null
                ? new D4AgentDecision(D4AgentState.Dead, D4ActionKind.Interact, revive.Center, null, revive.TrackId, "revive button")
                : new D4AgentDecision(D4AgentState.Dead, D4ActionKind.None, null, null, null, $"death screen (saturation {vitals.MeanSaturation:0})");
        }
        _wasDead = false;

        var enemies = o.Confirmed(D4AgentClasses.Enemies).ToList();
        if (vitals.Health is { } health && health < _settings.LowHealthRatio)
        {
            if (KeyReady(_settings.PotionKey, _settings.PotionCooldownSec * 1000, now))
                return new D4AgentDecision(D4AgentState.LowHealth, D4ActionKind.PressKey, null, _settings.PotionKey, null, $"health {health:P0}: potion");
            if (enemies.Count > 0)
                return MoveAway(o, D4AgentState.LowHealth, enemies.Select(e => e.Center), $"health {health:P0}: retreat");
        }

        var danger = o.Confirmed(D4AgentClasses.DangerZone).Where(t => Contains(Grow(t.Box), o.PlayerAnchor)).ToList();
        if (danger.Count > 0)
            return MoveAway(o, D4AgentState.Evade, danger.Select(d => d.Center), $"standing in {danger.Count} danger area(s)");

        if (o.Confirmed(D4AgentClasses.MenuPanel).Any() && !string.IsNullOrWhiteSpace(_settings.MenuCloseKey)
            && KeyReady(_settings.MenuCloseKey, D4AgentConstants.MenuKeyIntervalMs, now))
            return new D4AgentDecision(D4AgentState.Menu, D4ActionKind.PressKey, null, _settings.MenuCloseKey, null, "menu open");

        foreach (var (cls, state) in new[] { (D4AgentClasses.Boss, D4AgentState.FightBoss), (D4AgentClasses.Elite, D4AgentState.FightElite), (D4AgentClasses.Monster, D4AgentState.FightMonster) })
        {
            var target = o.Confirmed(cls).MinBy(t => Distance(t.Center, o.PlayerAnchor));
            if (target != null) return Fight(o, state, target, now);
        }

        if (_settings.PickupLoot)
        {
            var drops = o.Confirmed(D4AgentClasses.Loot).Where(t => !_blacklist.ContainsKey(t.TrackId))
                .OrderBy(t => Array.IndexOf(D4AgentClasses.Loot, t.ClassName)).ThenBy(t => Distance(t.Center, o.PlayerAnchor));
            foreach (var drop in drops)
            {
                if (Attempt(drop, D4AgentConstants.LootMaxAttempts))
                    return new D4AgentDecision(D4AgentState.Loot, D4ActionKind.Pickup, drop.Center, null, drop.TrackId, $"{drop.ClassName} #{drop.TrackId}");
                LootAbandoned++;
            }
        }

        if (!_settings.Explore) return D4AgentDecision.Idle("nothing to do");

        if (_escapeLeft > 0)
        {
            _escapeLeft--;
            return MoveDirection(o, D4AgentState.Stuck, _escapeDirection, "stuck escape");
        }

        var door = o.Confirmed(D4AgentClasses.Interactables).Where(t => !_blacklist.ContainsKey(t.TrackId)).MinBy(t => Distance(t.Center, o.PlayerAnchor));
        if (door != null && Attempt(door, D4AgentConstants.InteractMaxAttempts))
            return new D4AgentDecision(D4AgentState.Interact, D4ActionKind.Interact, door.Center, null, door.TrackId, $"{door.ClassName} #{door.TrackId}");

        if (o.Route is { Direction: { } routeDirection } route)
        {
            _lastMoveDirection = routeDirection;
            return MoveDirection(o, D4AgentState.FollowRoute, _map.ToScreenDirection(routeDirection),
                $"pinned route ({route.Route.Waypoints.Count} waypoints, {(route.Planned ? "A*" : "direct")})");
        }

        if (_map.NextExploreDirection() is { } direction)
        {
            _lastMoveDirection = direction;
            return MoveDirection(o, D4AgentState.Explore, _map.ToScreenDirection(direction), $"frontier ({o.Map.FrontierCount})");
        }
        return D4AgentDecision.Idle("no frontier left");
    }

    private D4AgentDecision Fight(D4Observation o, D4AgentState state, YoloTrack target, DateTime now)
    {
        double range = o.ClientSize.Height * D4AgentConstants.AttackRangeRatio;
        if (Distance(target.Center, o.PlayerAnchor) > range)
            return new D4AgentDecision(state, D4ActionKind.Move, target.Center, null, target.TrackId, $"approach {target.ClassName} #{target.TrackId}");
        var skills = _settings.SkillKeys;
        for (int i = 0; i < skills.Count; i++)
        {
            bool visualReady = i >= o.Vitals.SkillReady.Count || o.Vitals.SkillReady[i];
            if (visualReady && KeyReady(skills[i], _settings.SkillMinIntervalMs, now))
                return new D4AgentDecision(state, D4ActionKind.Attack, target.Center, skills[i], target.TrackId, $"{target.ClassName} #{target.TrackId} skill {skills[i]}");
        }
        return new D4AgentDecision(state, D4ActionKind.Attack, target.Center, D4AgentConstants.KeyLeftClick, target.TrackId, $"{target.ClassName} #{target.TrackId} basic");
    }

    /// <summary>Counts one more try on a track; false (and blacklisted) once the tries are used up.</summary>
    private bool Attempt(YoloTrack track, int maxAttempts)
    {
        int tries = _attempts.TryGetValue(track.TrackId, out var n) ? n : 0;
        if (tries >= maxAttempts)
        {
            _blacklist[track.TrackId] = DateTime.UtcNow.AddSeconds(D4AgentConstants.BlacklistSeconds);
            _attempts.Remove(track.TrackId);
            return false;
        }
        _attempts[track.TrackId] = tries + 1;
        return true;
    }

    /// <summary>Confirms the previous action with the new frame and updates the stuck detector.</summary>
    private void ConfirmPrevious(D4Observation o)
    {
        if (_previous is not { } p) return;
        if (p.Action == D4ActionKind.Pickup && p.TrackId is { } id && o.Tracks.All(t => t.TrackId != id || t.Misses > 0))
        {
            LootPicked++;
            _attempts.Remove(id);
        }
        if (p.Action != D4ActionKind.Move || p.State is not (D4AgentState.Explore or D4AgentState.FollowRoute)) return;
        double moved = Math.Sqrt(o.Map.Step.X * o.Map.Step.X + o.Map.Step.Y * o.Map.Step.Y);
        _stillMoves = o.Map.Reliable && moved < D4AgentConstants.StuckMinPixels ? _stillMoves + 1 : 0;
        if (_stillMoves < D4AgentConstants.StuckMoves) return;
        _stillMoves = 0;
        StuckEvents++;
        _map.MarkBlocked(_lastMoveDirection);
        double angle = Math.Atan2(_lastMoveDirection.Y, _lastMoveDirection.X) + (_random.Next(2) == 0 ? 1 : -1) * Math.PI * (0.5 + _random.NextDouble() * 0.5);
        _escapeDirection = _map.ToScreenDirection(new Point2d(Math.Cos(angle), Math.Sin(angle)));
        _escapeLeft = D4AgentConstants.EscapeMoves;
    }

    private bool KeyReady(string key, double intervalMs, DateTime now) =>
        !string.IsNullOrWhiteSpace(key) && (!_keyUsedUtc.TryGetValue(key, out var used) || (now - used).TotalMilliseconds >= intervalMs);

    private D4AgentDecision MoveAway(D4Observation o, D4AgentState state, IEnumerable<Point> threats, string reason)
    {
        var list = threats.ToList();
        double tx = list.Average(t => t.X) - o.PlayerAnchor.X, ty = list.Average(t => t.Y) - o.PlayerAnchor.Y;
        double length = Math.Sqrt(tx * tx + ty * ty);
        var away = length < 1 ? new Point2d(0, 1) : new Point2d(-tx / length, -ty / length);
        return MoveDirection(o, state, away, reason, D4AgentConstants.EvadeDistanceRatio);
    }

    private static D4AgentDecision MoveDirection(D4Observation o, D4AgentState state, Point2d screenDirection, string reason,
        double radiusRatio = D4AgentConstants.MoveClickRadiusRatio)
    {
        double radius = o.ClientSize.Height * radiusRatio;
        int x = Math.Clamp((int)Math.Round(o.PlayerAnchor.X + screenDirection.X * radius), 0, o.ClientSize.Width - 1);
        int y = Math.Clamp((int)Math.Round(o.PlayerAnchor.Y + screenDirection.Y * radius), 0, o.ClientSize.Height - 1);
        return new D4AgentDecision(state, D4ActionKind.Move, new Point(x, y), null, null, reason);
    }

    private static Rect Grow(Rect box)
    {
        int mx = (int)(box.Width * D4AgentConstants.DangerMarginRatio), my = (int)(box.Height * D4AgentConstants.DangerMarginRatio);
        return new Rect(box.X - mx, box.Y - my, box.Width + 2 * mx, box.Height + 2 * my);
    }

    private static bool Contains(Rect box, Point p) => p.X >= box.Left && p.X <= box.Right && p.Y >= box.Top && p.Y <= box.Bottom;

    private static double Distance(Point a, Point b) => Math.Sqrt((double)(a.X - b.X) * (a.X - b.X) + (double)(a.Y - b.Y) * (a.Y - b.Y));
}
