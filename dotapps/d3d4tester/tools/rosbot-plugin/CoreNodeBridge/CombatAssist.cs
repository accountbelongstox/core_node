// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Numerics;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Combat assist, one setting shared by every mode the app controls (the "assist" line every app command carries, or command "assist"):
/// the plugin finds the fight and positions the hero; it casts with ROSBOT's own cast entry (RosCaster, PluginCast) when found, else
/// the app's combat macro casts while Combat is set.
/// Scan: hostile monsters within AssistRange of the followed player (else within ROSBOT's ScanRange, SelfDefenseRange when unknown, of
/// the hero) set Combat (kept CombatLingerMs after the last one). The target follows ROSBOT's own strategy: the first of ROSBOT's attack
/// targets (Context.AttackActors, its target selection) inside that area; else the best by ROSBOT's target weights (RosSettings:
/// elite / goblin / normal weight per yard of distance; defaults when unreadable). Step: walk to within AttackReach of it, never farther
/// than LeashDistance from the followed player. Follow steps while it follows; while the app holds ROSBOT without
/// follow or standby the plugin steps idle; standby and running commands only scan (they own the movement).
/// </summary>
internal sealed class CombatAssist
{
    public const float LeashDistance = 35f;
    /// <summary>The plugin casts (RosCaster) only at targets this close.</summary>
    public const float CastRange = 45f;
    private const float AssistRange = 40f;
    private const float SelfDefenseRange = 20f;
    private const float AttackReach = 12f;
    private const float StepReach = 6f;
    private const int StepMs = 800;
    private const int CombatLingerMs = 2500;
    private const int MinScanRange = 10;
    private const int MaxScanRange = 80;
    private const int DefaultEliteWeight = 3;
    private const int DefaultGoblinWeight = 2;
    private const int DefaultNormalWeight = 1;
    private const string GoblinName = "goblin";
    public const string SourceRosbot = "rosbot";
    public const string SourceWeights = "weights";

    private readonly Action<string> _log;
    private readonly Stopwatch _sinceCombat = new();

    public CombatAssist(Action<string> log) => _log = log;

    public bool Enabled { get; private set; }

    /// <summary>Cast with ROSBOT's own cast entry (RosCaster) instead of the app's combat macro; the "cast" line of every command.</summary>
    public bool PluginCast { get; set; } = true;

    /// <summary>The plugin casts now: setting on and ROSBOT's cast entry found.</summary>
    public bool CastByPlugin => Enabled && PluginCast && RosCaster.Available;

    /// <summary>Monster fought at the last scan, null when none.</summary>
    public IActor Current { get; private set; }

    /// <summary>Monsters to fight now (kept CombatLingerMs after the last one); the app casts while set.</summary>
    public bool Combat => Enabled && _sinceCombat.IsRunning && _sinceCombat.ElapsedMilliseconds < CombatLingerMs;

    /// <summary>Name of the monster fought, "" when none.</summary>
    public string Target { get; private set; } = "";

    /// <summary>Where the target came from: SourceRosbot (ROSBOT's attack targets) or SourceWeights (ROSBOT's target weights), "" when none.</summary>
    public string Source { get; private set; } = "";

    /// <summary>RActorIds of ROSBOT's attack targets at the last read (published with the monster list).</summary>
    public HashSet<uint> RosTargetIds { get; private set; } = new();

    /// <summary>One of ROSBOT's target settings (RosSettings), -1 when unreadable.</summary>
    public static int RosSetting(Func<int> getter) => WorldScanner.Safe(getter, -1);

    public void Set(bool on)
    {
        if (on == Enabled) return;
        Enabled = on;
        if (!on) Clear();
        _log("combat assist " + (on ? "on" : "off"));
    }

    /// <summary>No fight (dead, out of control, out of game).</summary>
    public void Clear()
    {
        _sinceCombat.Reset();
        Target = "";
        Source = "";
        Current = null;
        RosCaster.Stop();
    }

    /// <summary>One cast step at the fought monster (tick thread) while CastByPlugin; releases a channel when the fight is over.</summary>
    public void Cast(IReadOnlyList<SkillInfo> skills)
    {
        if (!Combat || !CastByPlugin || Current is not { } target || !WorldScanner.Safe(() => target.IsValid && !target.IsDead, false))
        {
            RosCaster.Stop();
            return;
        }
        if (WorldScanner.Safe(() => target.Distance, float.MaxValue) <= CastRange) RosCaster.Step(target, skills);
    }

    /// <summary>Read ROSBOT's attack targets (tick thread only: the state writer never calls ROSBOT's targeting).</summary>
    public IActor[] RefreshRosTargets()
    {
        var targets = WorldScanner.RosTargets();
        RosTargetIds = new HashSet<uint>(targets.Select(a => WorldScanner.Safe(() => a.RActorId, 0u)));
        return targets;
    }

    /// <summary>Best hostile monster around the followed player (null: around the hero), or null; keeps Combat and Target.</summary>
    public IActor Scan(IActor[] actors, IActor around)
    {
        if (!Enabled) return null;
        var anchor = around == null ? (Vector3?)null : WorldScanner.Safe(() => around.Position, LocalPlayer.Position);
        int scan = RosSetting(() => RosSettings.ScanRange);
        float selfRange = scan is >= MinScanRange and <= MaxScanRange ? scan : SelfDefenseRange;
        bool InArea(IActor m) => anchor is { } a
            ? Vector3.Distance(WorldScanner.Safe(() => m.Position, Vector3.Zero), a) <= AssistRange
            : WorldScanner.Safe(() => m.Distance, float.MaxValue) <= selfRange;
        bool Alive(IActor m) => WorldScanner.Safe(() => m.IsValid && !m.IsDead && m.IsHostile, false);
        var best = RefreshRosTargets().FirstOrDefault(m => Alive(m) && InArea(m));
        Source = SourceRosbot;
        if (best == null)
        {
            best = WorldScanner.HostileMonsters(actors).Where(InArea).OrderByDescending(Score).FirstOrDefault();
            Source = SourceWeights;
        }
        if (best == null)
        {
            Target = "";
            Source = "";
            Current = null;
            return null;
        }
        Current = best;
        _sinceCombat.Restart();
        Target = WorldScanner.Safe(() => best.Name, "") ?? "";
        return best;
    }

    /// <summary>ROSBOT's target weight (elite / boss, goblin, normal) per yard of distance.</summary>
    private static float Score(IActor m)
    {
        bool elite = WorldScanner.Safe(() => m.IsElite || m.IsBoss, false);
        bool goblin = (WorldScanner.Safe(() => m.InternalName, "") ?? "").IndexOf(GoblinName, StringComparison.OrdinalIgnoreCase) >= 0;
        int weight = elite ? RosSetting(() => RosSettings.EliteWeight)
            : goblin ? RosSetting(() => RosSettings.GoblinWeight)
            : RosSetting(() => RosSettings.NormalMonsterWeight);
        if (weight <= 0) weight = elite ? DefaultEliteWeight : goblin ? DefaultGoblinWeight : DefaultNormalWeight;
        return weight / Math.Max(1f, WorldScanner.Safe(() => m.Distance, float.MaxValue));
    }

    /// <summary>One bounded step (StepMs) to within AttackReach of the monster, kept within LeashDistance of the followed player (null: no leash).</summary>
    public void Step(IActor monster, IActor around)
    {
        if (WorldScanner.Safe(() => monster.Distance, 0f) <= AttackReach) return;
        var step = WorldScanner.Safe(() => monster.Position, LocalPlayer.Position);
        if (around != null)
        {
            var leash = WorldScanner.Safe(() => around.Position, step);
            if (Vector3.Distance(step, leash) > LeashDistance) step = leash + Vector3.Normalize(step - leash) * LeashDistance;
        }
        if (Vector3.Distance(step, WorldScanner.Safe(() => LocalPlayer.Position, step)) <= StepReach) return;
        var sw = Stopwatch.StartNew();
        WorldScanner.Safe(() => { LocalPlayer.CoreMoveTo(step, () => sw.ElapsedMilliseconds > StepMs, AttackReach); return true; }, false);
    }
}
