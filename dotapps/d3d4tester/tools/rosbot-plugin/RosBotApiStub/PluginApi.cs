// PY-REF: none (DOT-only)
// Signatures copied from the ROSBOT plugin API (Rcdw32.Ws.Plugins in RoS-BoT.exe); bodies never run.
using System;

namespace Rcdw32.Ws.Plugins;

public interface IPlugin : IEquatable<IPlugin>
{
    string Author { get; }
    Version Version { get; }
    string Name { get; }
    string Description { get; }
    bool CanSettings { get; }
    void DisplayWindow();
    void OnPulse();
    void OnInitialize();
    void OnShutdown();
    void OnEnabled();
    void OnDisabled();
}

public static class Context
{
    public static string SequenceName => throw new NotSupportedException();
    public static string SettingsPath => throw new NotSupportedException();
    public static bool InventoryFull => throw new NotSupportedException();
    public static void Log(string info) => throw new NotSupportedException();
}

public static class LocalPlayer
{
    public static bool IsValid => throw new NotSupportedException();
    public static bool IsInGame => throw new NotSupportedException();
    public static int SnoLevelArea => throw new NotSupportedException();
    public static int SnoScene => throw new NotSupportedException();
    public static int GlobalWorldId => throw new NotSupportedException();
    public static int MeWorldId => throw new NotSupportedException();
    public static bool IsInTown => throw new NotSupportedException();
    public static bool IsInRift => throw new NotSupportedException();
    public static bool IsGreaterRift => throw new NotSupportedException();
    public static bool IsNephalemRift => throw new NotSupportedException();
    public static int RiftKey => throw new NotSupportedException();
    public static int Shards => throw new NotSupportedException();
    public static int ParagonLevel => throw new NotSupportedException();
    public static int ActorClass => throw new NotSupportedException();
    public static double CurrentHealthPct => throw new NotSupportedException();
    public static bool IsDead => throw new NotSupportedException();
    public static bool IsInCombat => throw new NotSupportedException();
}

public static class PluginsEvents
{
    public static event EventHandler OnTakeTownPortal { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
    public static event EventHandler OnInTown { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
    public static event EventHandler OnOpenRift { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
    public static event EventHandler OnGemUpdateFinish { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
    public static event EventHandler<int> OnOpenGreateRift { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
}
