// PY-REF: none (DOT-only)
// Signatures copied from the ROSBOT plugin API (Rcdw32.Ws.Plugins / Rcdw32.Ws.Models in RoS-BoT.exe); bodies never run.
// Enums are declared empty: plugins read names / values from ROSBOT's own enums at runtime (Enum.GetName / Enum.Parse).
using System;
using System.Numerics;
using Rcdw32.Ws.Models;

namespace Rcdw32.Ws.Models
{
    public interface IAcd
    {
        bool IsValid { get; }
        int AcdId { get; }
        int SnoId { get; }
        int Type { get; }
        int Gball { get; }
        T GetAttribute<T>(int attr, uint parameter = 4294963200u) where T : struct;
    }

    public interface IActor
    {
        uint RActorId { get; }
        bool IsValid { get; }
        int Type { get; }
        Vector3 Position { get; }
        int AcdId { get; }
        string Name { get; }
        string InternalName { get; }
        int ActorSnoId { get; }
        bool IsItem { get; }
        bool IsGizmo { get; }
        bool IsMonster { get; }
        bool IsDead { get; }
        bool IsPortal { get; }
        bool IsElite { get; }
        bool IsBoss { get; }
        bool IsHostile { get; }
        bool IsNpc { get; }
        float Distance { get; }
        bool IsInLineOfSight { get; }
        double Interactdistance { get; }
        IAcd CommData { get; }
    }
}

namespace Rcdw32.Ws.Plugins
{
    public enum ActorId { }

    public enum AttributeId { }

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

    public class ItemStat : EventArgs
    {
        public ItemStat(string desc) => throw new NotSupportedException();
        public string Desc { get => throw new NotSupportedException(); set => throw new NotSupportedException(); }
    }

    public static class Context
    {
        public static IActor[] Actors => throw new NotSupportedException();
        public static IAcd[] Acds => throw new NotSupportedException();
        public static string SequenceName => throw new NotSupportedException();
        public static string SettingsPath => throw new NotSupportedException();
        public static bool InventoryFull => throw new NotSupportedException();
        public static bool RepairNeeded => throw new NotSupportedException();
        public static void Log(string info) => throw new NotSupportedException();
        public static float[] FindPaths(Vector3 from, Vector3 to) => throw new NotSupportedException();
        public static bool HasUIElement(ulong id) => throw new NotSupportedException();
        public static void ClickUIElement(ulong id) => throw new NotSupportedException();
    }

    public static class LocalPlayer
    {
        public static bool IsValid => throw new NotSupportedException();
        public static bool IsInGame => throw new NotSupportedException();
        public static int AcdId => throw new NotSupportedException();
        public static Vector3 Position => throw new NotSupportedException();
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
        public static bool PickupItem(IActor actor) => throw new NotSupportedException();
        public static bool MoveTo(IActor actor) => throw new NotSupportedException();
        public static void CoreMoveTo(Vector3 target, float dis = 10f) => throw new NotSupportedException();
        public static void CoreMoveTo(Vector3 target, Func<bool> cancel, float dis = 10f) => throw new NotSupportedException();
        public static void Interact(IActor actor, bool mode = true, bool click = true, Vector3 loc = default) => throw new NotSupportedException();
    }

    public static class PluginsEvents
    {
        public static event EventHandler OnTakeTownPortal { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
        public static event EventHandler OnInTown { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
        public static event EventHandler OnOpenRift { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
        public static event EventHandler OnGemUpdateFinish { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
        public static event EventHandler<ItemStat> OnItemStash { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
        public static event EventHandler<int> OnOpenGreateRift { add => throw new NotSupportedException(); remove => throw new NotSupportedException(); }
    }
}
