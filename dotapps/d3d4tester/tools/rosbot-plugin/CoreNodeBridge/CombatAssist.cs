// PY-REF: none (DOT-only)
using System;
using System.Diagnostics;
using System.Linq;
using System.Numerics;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Combat assist, one setting shared by every mode the app controls (the "assist" line every app command carries, or command "assist"):
/// the plugin cannot cast, so it only finds the fight and positions the hero; the app's combat macro casts while Combat is set.
/// Scan: hostile monsters within AssistRange of the followed player (else within SelfDefenseRange of the hero) set Combat (kept
/// CombatLingerMs after the last one) and pick the best one (elites / bosses first, then nearest). Step: walk to within AttackReach of
/// it, never farther than LeashDistance from the followed player. Follow steps while it follows; while the app holds ROSBOT without
/// follow or standby the plugin steps idle; standby and running commands only scan (they own the movement).
/// </summary>
internal sealed class CombatAssist
{
    public const float LeashDistance = 35f;
    private const float AssistRange = 40f;
    private const float SelfDefenseRange = 20f;
    private const float AttackReach = 12f;
    private const float StepReach = 6f;
    private const int StepMs = 800;
    private const int CombatLingerMs = 2500;

    private readonly Action<string> _log;
    private readonly Stopwatch _sinceCombat = new();

    public CombatAssist(Action<string> log) => _log = log;

    public bool Enabled { get; private set; }

    /// <summary>Monsters to fight now (kept CombatLingerMs after the last one); the app casts while set.</summary>
    public bool Combat => Enabled && _sinceCombat.IsRunning && _sinceCombat.ElapsedMilliseconds < CombatLingerMs;

    /// <summary>Name of the monster fought, "" when none.</summary>
    public string Target { get; private set; } = "";

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
    }

    /// <summary>Best hostile monster around the followed player (null: around the hero), or null; keeps Combat and Target.</summary>
    public IActor Scan(IActor[] actors, IActor around)
    {
        if (!Enabled) return null;
        var anchor = around == null ? (Vector3?)null : WorldScanner.Safe(() => around.Position, LocalPlayer.Position);
        var best = WorldScanner.HostileMonsters(actors)
            .Select(m => (Actor: m, Position: WorldScanner.Safe(() => m.Position, Vector3.Zero), Distance: WorldScanner.Safe(() => m.Distance, float.MaxValue)))
            .Where(m => anchor is { } a ? Vector3.Distance(m.Position, a) <= AssistRange : m.Distance <= SelfDefenseRange)
            .OrderBy(m => WorldScanner.Safe(() => m.Actor.IsElite || m.Actor.IsBoss, false) ? 0 : 1)
            .ThenBy(m => m.Distance)
            .FirstOrDefault();
        if (best.Actor == null)
        {
            Target = "";
            return null;
        }
        _sinceCombat.Restart();
        Target = WorldScanner.Safe(() => best.Actor.Name, "") ?? "";
        return best.Actor;
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
