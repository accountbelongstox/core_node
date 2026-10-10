// PY-REF: none (DOT-only)
using System;
using System.Diagnostics;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Town standby (app command "standby", the app's "return to town and stand by"): ROSBOT is paused by the app, the plugin brings the
/// hero home and keeps it idle there so the app's panel commands drive it; the game is never left. Every tick: dead -> press the death
/// menu's revive in town (else checkpoint, else corpse, every ReviveRetryMs); alive outside town -> state needs_town, so the app presses
/// the town portal key (the plugin API cannot cast it); in town -> state in_town, and the app's town work (TownHold, e.g. equipping
/// build items) runs once per visit. Follow mode and standby exclude each other. The plugin never attacks.
/// </summary>
internal sealed class TownStandby
{
    public const string StateOff = "off";
    public const string StateReviving = "reviving";
    public const string StateNeedsTown = "needs_town";
    public const string StateInTown = "in_town";
    private const int ReviveRetryMs = 2000;

    private readonly Action<string> _log;
    private readonly Stopwatch _sinceRevive = new();

    public TownStandby(Action<string> log) => _log = log;

    /// <summary>Set by the plugin: the app's town work, started once per town visit while standing by.</summary>
    public TownHold TownHold { get; set; }

    public bool Enabled { get; private set; }
    public string State { get; private set; } = StateOff;
    public DateTime SinceUtc { get; private set; } = DateTime.MinValue;

    public void Start()
    {
        Enabled = true;
        SinceUtc = DateTime.UtcNow;
        _sinceRevive.Reset();
        State = WorldScanner.Safe(() => LocalPlayer.IsInTown, false) ? StateInTown : StateNeedsTown;
        _log($"standby on ({State})");
    }

    public void Stop()
    {
        if (!Enabled) return;
        Enabled = false;
        State = StateOff;
        SinceUtc = DateTime.MinValue;
        _log("standby off");
    }

    public void Tick()
    {
        if (!Enabled || !WorldScanner.Safe(() => LocalPlayer.IsValid && LocalPlayer.IsInGame, false)) return;
        if (WorldScanner.Safe(() => LocalPlayer.IsDead, false))
        {
            State = StateReviving;
            if (_sinceRevive.IsRunning && _sinceRevive.ElapsedMilliseconds < ReviveRetryMs) return;
            _sinceRevive.Restart();
            if (UiIds.ClickFirstShown(UiIds.ReviveButtonsTownFirst) is { } clicked) _log("standby: revive " + UiIds.ShortName(clicked));
            return;
        }
        if (!WorldScanner.Safe(() => LocalPlayer.IsInTown, false))
        {
            State = StateNeedsTown;
            return;
        }
        if (State != StateInTown) _log("standby: in town, waiting for the app");
        State = StateInTown;
        TownHold?.TryBegin(TownHold.ReasonStandby);
    }
}
