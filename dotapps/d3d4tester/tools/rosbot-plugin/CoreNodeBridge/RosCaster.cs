// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Reflection;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// ROSBOT's own cast entry: LocalPlayer wraps ROSBOT's IPlayer, which has CanCast / Cast / CastEx / GetSkillDef but is not exposed to
/// plugins. Its IContext lives in a public static field of an internal holder type; it is found once by reflection (any static field
/// whose type implements IContext) and then called typed. Rotation (one cast per Interval): the ready skills of the bar (CombatProbe
/// readiness and ROSBOT's CanCast) in slot order Pos1-Pos4 (cooldowns / buffs), Right (spender), Left (generator); the potion slot and
/// unset powers are never cast. A target with an ACD gets CastEx (ROSBOT's targeted use), else Cast at its position; channelled powers
/// are cast as channels and released with RealseCast when the fight ends.
/// </summary>
internal static class RosCaster
{
    private const BindingFlags StaticFields = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
    private const int IntervalMs = 250;
    private static readonly string[] SlotOrder = { "Pos1", "Pos2", "Pos3", "Pos4", "Right", "Left" };
    private static readonly object Lock = new();
    private static readonly Stopwatch SinceCast = new();
    private static IContext _context;
    private static bool _searched;
    private static bool _channelling;

    /// <summary>ROSBOT's hero object, null when the context was not found.</summary>
    public static IPlayer Me
    {
        get
        {
            lock (Lock)
            {
                if (!_searched)
                {
                    _searched = true;
                    _context = FindContext();
                }
            }
            return _context == null ? null : WorldScanner.Safe(() => _context.Me, null);
        }
    }

    public static bool Available => Me != null;

    /// <summary>Last cast (power name and result) for state.json, "" before the first.</summary>
    public static string LastCast { get; private set; } = "";

    /// <summary>Hotbar slot name of a power (ROSBOT's SkillPosition), "" when unknown.</summary>
    public static string Slot(int power) => Me is { } me ? WorldScanner.Safe(() => me.GetSkillDef(power).ToString(), "") : "";

    /// <summary>One rotation step at the target: the first castable ready skill by slot order; true when a cast was issued.</summary>
    public static bool Step(IActor target, IReadOnlyList<SkillInfo> skills)
    {
        if (target == null || Me is not { } me) return false;
        if (SinceCast.IsRunning && SinceCast.ElapsedMilliseconds < IntervalMs) return false;
        var skill = skills.Where(s => s.Ready && SlotRank(s.Slot) >= 0 && WorldScanner.Safe(() => me.CanCast(s.Power), false))
            .OrderBy(s => SlotRank(s.Slot))
            .FirstOrDefault();
        if (skill == null) return false;
        SinceCast.Restart();
        var position = WorldScanner.Safe(() => target.Position, LocalPlayer.Position);
        int acd = WorldScanner.Safe(() => target.AcdId, 0);
        bool ok;
        if (skill.Channel)
        {
            ok = WorldScanner.Safe(() => { me.Cast(skill.Power, position, true, false); return true; }, false);
            _channelling |= ok;
        }
        else if (acd != 0)
            ok = WorldScanner.Safe(() => me.CastEx(skill.Power, position, LocalPlayer.MeWorldId, acd), false);
        else
            ok = WorldScanner.Safe(() => { me.Cast(skill.Power, position, false, true); return true; }, false);
        LastCast = $"{skill.Name} ({skill.Slot}) {(ok ? "ok" : "failed")}";
        return ok;
    }

    /// <summary>Fight over: release a channelled cast.</summary>
    public static void Stop()
    {
        if (!_channelling || Me is not { } me) return;
        _channelling = false;
        WorldScanner.Safe(() => { me.RealseCast(); return true; }, false);
    }

    private static int SlotRank(string slot) => Array.IndexOf(SlotOrder, slot);

    private static IContext FindContext()
    {
        foreach (var type in ScriptProbe.Types(typeof(Context).Assembly))
        foreach (var field in WorldScanner.Safe(() => type.GetFields(StaticFields), Array.Empty<FieldInfo>()))
        {
            if (!typeof(IContext).IsAssignableFrom(field.FieldType)) continue;
            if (WorldScanner.Safe(() => field.GetValue(null), null) is IContext context) return context;
        }
        return null;
    }
}
