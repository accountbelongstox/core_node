// PY-REF: none (DOT-only)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Threading;
using Rcdw32.Ws.Models;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>Readiness of one skill on the hero's bar (ROSBOT's own reads), published in state.json.</summary>
internal sealed class SkillInfo
{
    public int Power;
    public string Name = "";
    public bool Ready;
    public bool OnCooldown;
    public int CooldownMs;
    public bool ResourceOk;
    public int Charges;
    public bool Channel;
}

/// <summary>
/// Combat interfaces of ROSBOT's plugin API and research commands for plugin-driven combat.
/// Skills: the hero's active skills (PowerId values with LocalPlayer.IsActiveSkill, re-listed every SkillListMs) and per tick their
/// readiness from ROSBOT's reads (PowerCooldown / PowerCooldownLeft / HasEnoughResource / HasEnoughCharges / ChargeCount /
/// IsCastChannel): Ready = off cooldown, enough resource and charges.
/// attack_test (value "mode,click", default true,true): Interact with the nearest hostile monster within AttackTestRange and report its
/// hit points before / after AttackTestWaitMs and whether the hero cast, i.e. whether ROSBOT's Interact attacks a monster.
/// power_api: every ROSBOT method taking a power (a parameter of an enum with a value named PowerProbeValue, e.g. PowerId /
/// SNOPowerId) with its token, declaring type, static flag and signature into power_api.txt (read only, nothing is invoked).
/// </summary>
internal sealed class CombatProbe
{
    public const string ActionAttackTest = "attack_test";
    public const string ActionPowerApi = "power_api";
    public const string PowerApiFileName = "power_api.txt";
    private const int SkillListMs = 10000;
    private const float AttackTestRange = 40f;
    private const int AttackTestWaitMs = 800;
    private const string PassiveWord = "passive";
    private const string PowerProbeValue = "Walk";
    private const char ValueSeparator = ',';
    private const BindingFlags AllMembers = BindingFlags.Static | BindingFlags.Instance | BindingFlags.Public | BindingFlags.NonPublic | BindingFlags.DeclaredOnly;

    private readonly Stopwatch _sinceList = new();
    private List<(string Name, int Id)> _active = new();

    /// <summary>Readiness of the active skills at the last tick.</summary>
    public List<SkillInfo> Skills { get; private set; } = new();

    /// <summary>Tick thread: re-list the active skills every SkillListMs, read their readiness every call.</summary>
    public void Tick()
    {
        if (!WorldScanner.Safe(() => LocalPlayer.IsValid && LocalPlayer.IsInGame, false))
        {
            Skills = new List<SkillInfo>();
            return;
        }
        if (!_sinceList.IsRunning || _sinceList.ElapsedMilliseconds > SkillListMs)
        {
            _sinceList.Restart();
            _active = SkillCheck.Powers()
                .Where(p => p.Name.IndexOf(PassiveWord, StringComparison.OrdinalIgnoreCase) < 0)
                .Where(p => WorldScanner.Safe(() => LocalPlayer.IsActiveSkill(p.Id), false))
                .ToList();
        }
        Skills = _active.Select(p =>
        {
            var s = new SkillInfo
            {
                Power = p.Id, Name = p.Name,
                OnCooldown = WorldScanner.Safe(() => LocalPlayer.PowerCooldown(p.Id), false),
                CooldownMs = WorldScanner.Safe(() => LocalPlayer.PowerCooldownLeft(p.Id), 0),
                ResourceOk = WorldScanner.Safe(() => LocalPlayer.HasEnoughResource(p.Id), true),
                Charges = WorldScanner.Safe(() => LocalPlayer.ChargeCount(p.Id), 0),
                Channel = WorldScanner.Safe(() => LocalPlayer.IsCastChannel(p.Id), false),
            };
            s.Ready = !s.OnCooldown && s.ResourceOk && WorldScanner.Safe(() => LocalPlayer.HasEnoughCharges(p.Id), true);
            return s;
        }).ToList();
    }

    public static CommandResult AttackTest(CommandResult result, string value)
    {
        var parts = (value ?? "").Split(ValueSeparator);
        bool mode = !(parts.Length > 0 && bool.TryParse(parts[0], out bool m)) || m;
        bool click = !(parts.Length > 1 && bool.TryParse(parts[1], out bool c)) || c;
        var monster = WorldScanner.HostileMonsters(WorldScanner.Safe(() => Context.Actors, Array.Empty<IActor>()))
            .Where(a => WorldScanner.Safe(() => a.Distance, float.MaxValue) <= AttackTestRange)
            .OrderBy(a => WorldScanner.Safe(() => a.Distance, float.MaxValue))
            .FirstOrDefault();
        if (monster == null)
        {
            result.Message = $"no hostile monster within {AttackTestRange:0} yards";
            return result;
        }
        double before = Hp(monster);
        bool castBefore = WorldScanner.Safe(() => LocalPlayer.IsCasting, false);
        LocalPlayer.Interact(monster, mode, click, WorldScanner.Safe(() => monster.Position, LocalPlayer.Position));
        bool castSeen = false;
        var sw = Stopwatch.StartNew();
        while (sw.ElapsedMilliseconds < AttackTestWaitMs)
        {
            castSeen |= WorldScanner.Safe(() => LocalPlayer.IsCasting, false);
            Thread.Sleep(50);
        }
        double after = Hp(monster);
        result.Ok = true;
        result.Message = $"{WorldScanner.Safe(() => monster.Name, "")} ({WorldScanner.Safe(() => monster.Distance, -1f):0.0}) mode={mode} click={click}: "
                         + $"hp {Pct(before)} -> {Pct(after)}, casting {castBefore} -> {castSeen}, dead {WorldScanner.Safe(() => monster.IsDead, false)}";
        return result;
    }

    public static CommandResult PowerApi(CommandResult result, string dir)
    {
        var sb = new StringBuilder();
        int count = 0;
        foreach (var type in ScriptProbe.Types(typeof(Context).Assembly))
        {
            foreach (var method in WorldScanner.Safe(() => type.GetMethods(AllMembers), Array.Empty<MethodInfo>()))
            {
                var ps = WorldScanner.Safe(() => method.GetParameters(), Array.Empty<ParameterInfo>());
                if (!ps.Any(p => IsPowerEnum(p.ParameterType))) continue;
                count++;
                sb.Append("0x").Append(method.MetadataToken.ToString("X8")).Append(method.IsStatic ? " static " : " instance ")
                    .Append(method.IsPublic ? "public " : method.IsAssembly ? "internal " : "private ")
                    .Append(method.ReturnType.Name).Append(" (")
                    .Append(string.Join(", ", ps.Select(p => p.ParameterType.IsEnum && IsPowerEnum(p.ParameterType) ? "Power:" + ScriptProbe.Printable(p.ParameterType.Name) : p.ParameterType.Name)))
                    .Append(") in 0x").Append(type.MetadataToken.ToString("X8")).Append(' ').Append(ScriptProbe.Printable(type.FullName)).Append('\n');
            }
        }
        File.WriteAllText(Path.Combine(dir, PowerApiFileName), sb.Length == 0 ? "no method with a power parameter\n" : sb.ToString(), new UTF8Encoding(false));
        result.Ok = count > 0;
        result.Message = $"{count} method(s) with a power parameter -> {PowerApiFileName}";
        return result;
    }

    private static readonly Dictionary<Type, bool> PowerEnums = new();

    private static bool IsPowerEnum(Type t)
    {
        if (!t.IsEnum) return false;
        lock (PowerEnums)
        {
            if (!PowerEnums.TryGetValue(t, out bool power))
                PowerEnums[t] = power = WorldScanner.Safe(() => Enum.GetNames(t).Contains(PowerProbeValue), false);
            return power;
        }
    }

    private static double Hp(IActor monster) => WorldScanner.Safe(() => monster.CommData, null) is { } acd ? WorldScanner.HpPct(acd) : -1;

    private static string Pct(double hp) => hp < 0 ? "?" : $"{hp * 100:0.0}%";
}
