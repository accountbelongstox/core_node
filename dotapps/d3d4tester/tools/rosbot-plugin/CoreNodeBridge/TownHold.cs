// PY-REF: none (DOT-only)
using System;
using System.Diagnostics;
using System.IO;
using System.Threading;
using Rcdw32.Ws.Plugins;

namespace CoreNodeBridge;

/// <summary>
/// Town work the app does with mouse and keyboard (equip build items from the backpack) before ROSBOT's town run salvages them. The
/// app writes town_hold.txt: "1" = it has work at the next town visit, anything else = none / done. Once per town visit (a visit ends
/// when the hero leaves town) a hold starts: on ROSBOT's in-town event the event thread is blocked (ROSBOT waits, the plugin timer keeps
/// publishing state); follow mode in town waits before taking a banner; town standby holds while it idles in town. The hold ends when the app clears the file, the hero leaves
/// town, the plugin is disabled, or after MaxHoldMs (Wait checks the deadline itself, so ROSBOT is never blocked longer).
/// </summary>
internal sealed class TownHold
{
    public const string FileName = "town_hold.txt";
    public const string ReasonTownRun = "town_run";
    public const string ReasonFollow = "follow";
    public const string ReasonStandby = "standby";
    private const string On = "1";
    private const int MaxHoldMs = 90000;
    private const int WaitSliceMs = 200;

    private readonly string _path;
    private readonly Action<string> _log;
    private readonly object _lock = new();
    private readonly Stopwatch _held = new();
    private DateTime _stamp = DateTime.MinValue;
    private bool _wanted;
    private bool _heldThisVisit;
    private volatile bool _holding;

    public TownHold(string dir, Action<string> log)
    {
        _path = Path.Combine(dir, FileName);
        _log = log;
    }

    public bool Holding => _holding;
    public string Reason { get; private set; } = "";
    public DateTime SinceUtc { get; private set; } = DateTime.MinValue;

    /// <summary>Start this visit's hold when the app has work; true while a hold runs.</summary>
    public bool TryBegin(string reason)
    {
        if (!WorldScanner.Safe(() => LocalPlayer.IsInTown, false)) return false;
        lock (_lock)
        {
            if (_holding) return true;
            if (_heldThisVisit || !Wanted()) return false;
            _heldThisVisit = true;
            _holding = true;
            Reason = reason;
            SinceUtc = DateTime.UtcNow;
            _held.Restart();
        }
        _log($"town hold ({reason}): waiting for the app");
        return true;
    }

    /// <summary>Block the caller (ROSBOT's in-town event) until the hold ends, at most MaxHoldMs.</summary>
    public void Wait()
    {
        var waited = Stopwatch.StartNew();
        while (_holding && waited.ElapsedMilliseconds < MaxHoldMs) Thread.Sleep(WaitSliceMs);
        if (_holding) Release($"timeout after {MaxHoldMs / 1000}s");
    }

    /// <summary>End the hold now (plugin disabled / shut down, timeout).</summary>
    public void Release(string why)
    {
        lock (_lock)
            if (_holding) End(why);
    }

    /// <summary>Plugin timer: end the hold (app done, left town, timeout) and the visit when out of town.</summary>
    public void Tick()
    {
        bool inTown = WorldScanner.Safe(() => LocalPlayer.IsInTown, false);
        lock (_lock)
        {
            if (!inTown) _heldThisVisit = false;
            if (!_holding) return;
            if (!Wanted()) End("app done");
            else if (!inTown) End("left town");
            else if (_held.ElapsedMilliseconds > MaxHoldMs) End($"timeout after {MaxHoldMs / 1000}s");
        }
    }

    private void End(string why)
    {
        _holding = false;
        _held.Reset();
        _log($"town hold ({Reason}) ended: {why}");
    }

    private bool Wanted()
    {
        try
        {
            var stamp = File.Exists(_path) ? File.GetLastWriteTimeUtc(_path) : DateTime.MinValue;
            if (stamp != _stamp)
            {
                _stamp = stamp;
                _wanted = stamp != DateTime.MinValue && File.ReadAllText(_path).Trim() == On;
            }
        }
        catch (IOException)
        {
            // the app is writing the file; keep the last value
        }
        return _wanted;
    }
}
