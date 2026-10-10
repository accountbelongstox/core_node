// PY-REF: dotapps/d3d4tester/reference/py_d3check/lifecycle/thread_registry.py
using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// Fallback macro loop when no main function thread exists. 1:1 with Python thread_registry.start_macro_fallback / stop_macro_fallback.
/// Runs a background loop: find D3 hwnd, refresh window cache and activate window, then each tick run MacroSkillRunner.RunOneSkillTick (send keys/mouse from config).
/// Skill config is provided by the app via SetSkillConfigProvider (e.g. MacroConfigLoader.Instance.GetCurrentSkillConfig).
/// </summary>
/// <summary>Runtime macro options read each tick: smart pause (Tab pauses, Enter/T/M stop) and the custom force-stand key held around left clicks.</summary>
public sealed record MacroRuntimeOptions(bool SmartPause, bool UseCustomStandKey, string? CustomStandKey);

public sealed class MacroFallbackRunner
{
    private const int TickMs = 100;
    private const int KeyPollMs = 20;
    private const int RectRefreshTicks = 10;
    private static readonly TimeSpan StopWait = TimeSpan.FromSeconds(2);
    private const int VkTab = 0x09;
    private static readonly int[] SmartStopKeys = { 0x0D, 0x54, 0x4D };

    private readonly object _lock = new();
    private Task? _task;
    private CancellationTokenSource? _cts;

    /// <summary>Provider for current skill config. Set from app (e.g. CombatMacroController) to () => MacroConfigLoader.Instance.GetCurrentSkillConfig().</summary>
    public static Func<IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>>? SkillConfigProvider { get; set; }

    /// <summary>Runtime options provider (smart pause, custom stand key). Set from app.</summary>
    public static Func<MacroRuntimeOptions>? RuntimeOptionsProvider { get; set; }

    /// <summary>Called on the loop thread when smart pause stops the macro (Enter / T / M in D3); the owner must marshal (never block on Stop here).</summary>
    public static Action? SmartStopRequested { get; set; }

    public static MacroFallbackRunner Instance { get; } = new();

    private MacroFallbackRunner() { }

    /// <summary>
    /// Start fallback loop. shouldContinue is polled each tick (e.g. controller.MacroRunning). 1:1 Python start_macro_fallback.
    /// Returns false when a previous loop is still running (or still stopping after the wait), so two loops never run at once.
    /// </summary>
    public bool Start(Func<bool> shouldContinue)
    {
        if (shouldContinue == null) return false;
        lock (_lock)
        {
            if (_task != null && !_task.IsCompleted)
            {
                if (_cts is { IsCancellationRequested: false }) return true;
                try { _task.Wait(StopWait); } catch { /* ignore */ }
                if (!_task.IsCompleted)
                {
                    ColorPrinter.Yellow("[MacroFallback] Previous loop still stopping; start refused");
                    return false;
                }
            }
            _cts?.Dispose();
            _cts = new CancellationTokenSource();
            var token = _cts.Token;
            _task = Task.Run(() => RunLoop(shouldContinue, token), token);
            return true;
        }
    }

    /// <summary>Stop fallback loop and clear D3 window cache. 1:1 Python stop_macro_fallback.</summary>
    public void Stop()
    {
        lock (_lock)
        {
            _cts?.Cancel();
            try
            {
                _task?.Wait(StopWait);
            }
            catch { /* ignore */ }
            if (_task == null || _task.IsCompleted)
            {
                _task = null;
                _cts?.Dispose();
                _cts = null;
            }
        }
        GameInterfaceData.Instance.ClearD3WindowCache();
    }

    private static void RunLoop(Func<bool> shouldContinue, CancellationToken token)
    {
        var lastSkillTimes = new Dictionary<string, double>();
        bool foregroundedThisRun = false;
        IntPtr cachedHwnd = IntPtr.Zero;
        int ticksSinceRectRefresh = 0;
        int noHwndLogTicks = 0;
        bool loggedEmptyConfig = false;
        var smart = new SmartPauseState();
        try
        {
            while (!token.IsCancellationRequested && shouldContinue())
            {
                IntPtr hwnd = IntPtr.Zero;
                var runtime = RuntimeOptionsProvider?.Invoke();
                try
                {
                    hwnd = D3Manager.Instance.FindFirstHwnd();
                    if (hwnd == IntPtr.Zero)
                    {
                        noHwndLogTicks++;
                        if (noHwndLogTicks == 1 || (noHwndLogTicks % 20 == 0))
                            ColorPrinter.Yellow($"[MacroFallback] D3 window not found (tick {noHwndLogTicks}). Set D3 path in config or ensure game window is open.");
                    }
                    else if (!smart.Paused)
                    {
                        if (hwnd != cachedHwnd || ++ticksSinceRectRefresh >= RectRefreshTicks)
                        {
                            var rect = WindowInputHelper.GetWindowClientRectScreen(hwnd);
                            if (rect.HasValue)
                            {
                                GameInterfaceData.Instance.RefreshD3WindowCache(rect.Value.Left, rect.Value.Top, rect.Value.Right, rect.Value.Bottom);
                                if (hwnd != cachedHwnd)
                                    ColorPrinter.Blue($"[MacroFallback] D3 window found hwnd=0x{hwnd.ToString("X")}, refreshing cache.");
                                cachedHwnd = hwnd;
                                ticksSinceRectRefresh = 0;
                                if (!foregroundedThisRun)
                                {
                                    WindowInputHelper.SetForegroundWindow(hwnd);
                                    foregroundedThisRun = true;
                                }
                            }
                        }
                        var skills = SkillConfigProvider?.Invoke() ?? new Dictionary<string, IReadOnlyDictionary<string, string>>();
                        if (skills.Count == 0 && !loggedEmptyConfig)
                        {
                            loggedEmptyConfig = true;
                            ColorPrinter.Yellow("[MacroFallback] Skill config empty. Ensure LoadActive() was called and macro_configs.skill_configs.{name}.skills is set.");
                        }
                        double now = DateTime.UtcNow.Subtract(DateTime.UnixEpoch).TotalSeconds;
                        var cachedRect = GameInterfaceData.Instance.GetCachedD3ClientRect();
                        var nextTimes = MacroSkillRunner.RunOneSkillTick(hwnd, skills, lastSkillTimes, now, cachedRect, token, ResolveStandKey(runtime));
                        lastSkillTimes.Clear();
                        foreach (var kv in nextTimes) lastSkillTimes[kv.Key] = kv.Value;
                    }
                }
                catch (Exception ex)
                {
                    ColorPrinter.Yellow($"[MacroFallback] Tick error: {ex.Message}");
                }
                for (int waited = 0; waited < TickMs; waited += KeyPollMs)
                {
                    if (runtime?.SmartPause == true && hwnd != IntPtr.Zero && WindowInputHelper.IsForegroundWindow(hwnd) && smart.Poll())
                    {
                        ColorPrinter.Yellow("[MacroFallback] Smart pause: Enter/T/M pressed in D3, stopping macro");
                        SmartStopRequested?.Invoke();
                        return;
                    }
                    try
                    {
                        Task.Delay(KeyPollMs, token).GetAwaiter().GetResult();
                    }
                    catch (OperationCanceledException)
                    {
                        return;
                    }
                }
            }
        }
        finally
        {
            MacroSkillRunner.ReleaseHeld();
        }
    }

    private static ushort? ResolveStandKey(MacroRuntimeOptions? runtime) =>
        runtime is { UseCustomStandKey: true, CustomStandKey: { Length: > 0 } key } && ClickHandler.TryResolveKey(key.Trim(), out ushort vk) ? vk : null;

    /// <summary>Key edge tracking for smart pause: Tab toggles pause (held keys released / re-held next tick); Enter, T or M request stop.</summary>
    private sealed class SmartPauseState
    {
        private readonly Dictionary<int, bool> _wasDown = new();

        public bool Paused { get; private set; }

        /// <summary>Returns true when a stop key was pressed.</summary>
        public bool Poll()
        {
            if (Pressed(VkTab))
            {
                Paused = !Paused;
                if (Paused) MacroSkillRunner.ReleaseHeld();
                ColorPrinter.Blue(Paused ? "[MacroFallback] Smart pause: paused (Tab)" : "[MacroFallback] Smart pause: resumed (Tab)");
            }
            bool stop = false;
            foreach (var vk in SmartStopKeys)
                stop |= Pressed(vk);
            return stop;
        }

        private bool Pressed(int vk)
        {
            bool down = WindowInputHelper.IsKeyDown(vk);
            bool was = _wasDown.TryGetValue(vk, out var w) && w;
            _wasDown[vk] = down;
            return down && !was;
        }
    }
}
