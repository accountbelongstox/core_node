// PY-REF: none (DOT-only)
using System;
using System.Diagnostics;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Dead hero under plugin control (follow, combat assist): a teammate's resurrection is accepted at once (death menu "accept
/// resurrection", shown while Waiting_To_Accept_Resurrection is set); otherwise after ReviveWaitMs the first revive button the death
/// menu shows is pressed (corpse, checkpoint, town), every ReviveRetryMs. Call Tick while dead, Reset once alive.
/// </summary>
internal sealed class ReviveHelper
{
    private const int ReviveWaitMs = 8000;
    private const int ReviveRetryMs = 2000;
    private const string AttrWaitingToAccept = "Waiting_To_Accept_Resurrection";

    private readonly Action<string> _log;
    private readonly string _who;
    private readonly Stopwatch _deadFor = new();
    private readonly Stopwatch _sinceRevive = new();

    public ReviveHelper(Action<string> log, string who)
    {
        _log = log;
        _who = who;
    }

    public void Reset() => _deadFor.Reset();

    public void Tick()
    {
        if (!_deadFor.IsRunning) _deadFor.Restart();
        ulong accept = UiIds.Of(UiIds.AcceptResurrection);
        if (WorldScanner.Safe(() => Context.HasUIElement(accept), false))
        {
            bool waiting = WorldScanner.Safe(() => LocalPlayer.GetAttribute<int>(WorldScanner.AttributeId(AttrWaitingToAccept)), 0) != 0;
            if (_sinceRevive.IsRunning && _sinceRevive.ElapsedMilliseconds < ReviveRetryMs) return;
            _sinceRevive.Restart();
            Context.ClickUIElement(accept);
            _log($"{_who}: accepted resurrection (waiting attribute {waiting})");
            return;
        }
        if (_deadFor.ElapsedMilliseconds < ReviveWaitMs || (_sinceRevive.IsRunning && _sinceRevive.ElapsedMilliseconds < ReviveRetryMs)) return;
        _sinceRevive.Restart();
        if (UiIds.ClickFirstShown(UiIds.ReviveButtons) is { } clicked) _log($"{_who}: revive " + UiIds.ShortName(clicked));
    }
}
