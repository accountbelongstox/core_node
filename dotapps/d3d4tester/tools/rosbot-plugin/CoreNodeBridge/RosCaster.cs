// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Numerics;
using System.Reflection;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// ROSBOT's own cast entry: LocalPlayer wraps ROSBOT's IPlayer, which has CanCast / Cast / CastEx / GetSkillDef but is not exposed to
/// plugins. Its IContext lives in a public static field of an internal holder type; it is found once by reflection (any static field
/// whose type implements IContext) and then called typed. Rotation (one cast per Interval): below PotionHealth a health potion first
/// (PotionLockoutMs); then the ready skills of the bar (CombatProbe readiness and ROSBOT's CanCast) in slot order Pos1-Pos4 (cooldowns /
/// buffs, each locked out SlotLockoutMs after a cast so the others get turns), Right (spender), Left (generator); the potion slot and
/// unset powers are never cast as skills. A failed cast backs that power off FailBackoffMs and the next candidate is tried in the
/// same step. A target with an ACD gets CastEx (ROSBOT's targeted use); when CastEx reports false, Cast at the target's position is
/// sent instead (its result is not reported); channelled powers are cast as channels and released with RealseCast when the fight ends.
/// </summary>
internal static class RosCaster
{
    private const BindingFlags StaticFields = BindingFlags.Static | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;
    private const int IntervalMs = 250;
    private const int SearchRetryMs = 10000;
    private const int SlotLockoutMs = 1000;
    private const int FailBackoffMs = 1500;
    private const int PotionLockoutMs = 30000;
    private const double PotionHealth = 0.35;
    private const string PotionPowerName = "DrinkHealthPotion";
    private const string SlotLeft = "Left";
    private const string SlotRight = "Right";
    private static readonly Dictionary<int, DateTime> LockedUntil = new();
    private static readonly string[] SlotOrder = { "Pos1", "Pos2", "Pos3", "Pos4", "Right", "Left" };
    private static readonly object Lock = new();
    private static readonly Stopwatch SinceCast = new();
    private static readonly Stopwatch SinceSearch = new();
    private static IContext _context;
    private static bool _channelling;

    /// <summary>ROSBOT's hero object, null when the context was not found.</summary>
    public static IPlayer Me
    {
        get
        {
            lock (Lock)
            {
                if (_context == null && (!SinceSearch.IsRunning || SinceSearch.ElapsedMilliseconds > SearchRetryMs))
                {
                    SinceSearch.Restart();
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

    /// <summary>One rotation step at the target: potion when low, else the first castable ready skill by slot order (failed ones are skipped); true when a cast was issued.</summary>
    public static bool Step(IActor target, IReadOnlyList<SkillInfo> skills)
    {
        if (target == null || Me is not { } me) return false;
        if (SinceCast.IsRunning && SinceCast.ElapsedMilliseconds < IntervalMs) return false;
        SinceCast.Restart();
        var now = DateTime.UtcNow;
        if (TryPotion(me, now)) return true;
        var position = WorldScanner.Safe(() => target.Position, LocalPlayer.Position);
        int acd = WorldScanner.Safe(() => target.AcdId, 0);
        var candidates = skills.Where(s => s.Ready && SlotRank(s.Slot) >= 0 && !IsLockedOut(s.Power, now)).OrderBy(s => SlotRank(s.Slot));
        foreach (var skill in candidates)
        {
            if (!WorldScanner.Safe(() => me.CanCast(skill.Power), false)) continue;
            string how = CastAt(me, skill, position, acd);
            if (how == null)
            {
                LockOut(skill.Power, now, FailBackoffMs);
                LastCast = $"{skill.Name} ({skill.Slot}) failed";
                continue;
            }
            if (skill.Slot != SlotLeft && skill.Slot != SlotRight) LockOut(skill.Power, now, SlotLockoutMs);
            LastCast = $"{skill.Name} ({skill.Slot}) {how}";
            return true;
        }
        return false;
    }

    /// <summary>Cast one skill at the target; the way it was sent, null when ROSBOT refused or threw.</summary>
    private static string CastAt(IPlayer me, SkillInfo skill, Vector3 position, int acd)
    {
        if (skill.Channel)
        {
            bool sent = WorldScanner.Safe(() => { me.Cast(skill.Power, position, true, false); return true; }, false);
            _channelling |= sent;
            return sent ? "channel" : null;
        }
        if (acd != 0 && WorldScanner.Safe(() => me.CastEx(skill.Power, position, LocalPlayer.MeWorldId, acd), false)) return "CastEx";
        return WorldScanner.Safe(() => { me.Cast(skill.Power, position, false, true); return true; }, false) ? "Cast" : null;
    }

    /// <summary>Health below PotionHealth: drink a health potion (ROSBOT's DrinkHealthPotion power) at most once per PotionLockoutMs.</summary>
    private static bool TryPotion(IPlayer me, DateTime now)
    {
        if (WorldScanner.Safe(() => LocalPlayer.CurrentHealthPct, 1d) >= PotionHealth) return false;
        int potion = WorldScanner.Safe(() => (int)Enum.Parse(typeof(PowerId), PotionPowerName), 0);
        if (potion == 0 || IsLockedOut(potion, now) || !WorldScanner.Safe(() => me.CanCast(potion), false)) return false;
        bool sent = WorldScanner.Safe(() => { me.Cast(potion, LocalPlayer.Position, false, true); return true; }, false);
        LockOut(potion, now, PotionLockoutMs);
        LastCast = $"{PotionPowerName} {(sent ? "Cast" : "failed")}";
        return sent;
    }

    private static bool IsLockedOut(int power, DateTime now)
    {
        lock (LockedUntil) return LockedUntil.TryGetValue(power, out var until) && until > now;
    }

    private static void LockOut(int power, DateTime now, int ms)
    {
        lock (LockedUntil) LockedUntil[power] = now.AddMilliseconds(ms);
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
