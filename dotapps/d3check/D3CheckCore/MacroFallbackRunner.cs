using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3check.Core;

/// <summary>
/// Fallback macro loop when no main function thread exists. 1:1 with Python thread_registry.start_macro_fallback / stop_macro_fallback.
/// Runs a background loop: find D3 hwnd, refresh window cache and activate window, then each tick run MacroSkillRunner.RunOneSkillTick (send keys/mouse from config).
/// Skill config is provided by the app via SetSkillConfigProvider (e.g. MacroConfigLoader.Instance.GetCurrentSkillConfig).
/// </summary>
public sealed class MacroFallbackRunner
{
    private readonly object _lock = new();
    private Task? _task;
    private CancellationTokenSource? _cts;

    /// <summary>Provider for current skill config. Set from app (e.g. CombatMacroController) to () => MacroConfigLoader.Instance.GetCurrentSkillConfig().</summary>
    public static Func<IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>>? SkillConfigProvider { get; set; }

    public static MacroFallbackRunner Instance { get; } = new();

    private MacroFallbackRunner() { }

    /// <summary>Start fallback loop. shouldContinue is polled each tick (e.g. controller.MacroRunning). 1:1 Python start_macro_fallback.</summary>
    public void Start(Func<bool> shouldContinue)
    {
        if (shouldContinue == null) return;
        lock (_lock)
        {
            if (_task != null && !_task.IsCompleted) return;
            _cts = new CancellationTokenSource();
            var token = _cts.Token;
            _task = Task.Run(() => RunLoop(shouldContinue, token), token);
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
                _task?.Wait(TimeSpan.FromSeconds(2));
            }
            catch { /* ignore */ }
            _task = null;
            _cts = null;
        }
        GameInterfaceData.Instance.ClearD3WindowCache();
    }

    private static void RunLoop(Func<bool> shouldContinue, CancellationToken token)
    {
        var lastSkillTimes = new Dictionary<string, double>();
        bool cacheRefreshedThisRun = false;
        int noHwndLogTicks = 0;
        bool loggedEmptyConfig = false;
        while (!token.IsCancellationRequested && shouldContinue())
        {
            try
            {
                IntPtr hwnd = D3WindowFinder.FindFirstHandle();
                if (hwnd == IntPtr.Zero)
                {
                    noHwndLogTicks++;
                    if (noHwndLogTicks == 1 || (noHwndLogTicks % 20 == 0))
                        ColorPrinter.Yellow($"[MacroFallback] D3 window not found (tick {noHwndLogTicks}). Set D3 path in config or ensure game window is open.");
                }
                else
                {
                    if (!cacheRefreshedThisRun)
                    {
                        var rect = WindowInputHelper.GetWindowClientRectScreen(hwnd);
                        if (rect.HasValue)
                        {
                            GameInterfaceData.Instance.RefreshD3WindowCache(rect.Value.Left, rect.Value.Top, rect.Value.Right, rect.Value.Bottom);
                            WindowInputHelper.SetForegroundWindow(hwnd);
                            cacheRefreshedThisRun = true;
                            ColorPrinter.Blue($"[MacroFallback] D3 window found hwnd=0x{hwnd.ToString("X")}, activating and refreshing cache.");
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
                    var nextTimes = MacroSkillRunner.RunOneSkillTick(hwnd, skills, lastSkillTimes, now, cachedRect);
                    lastSkillTimes.Clear();
                    foreach (var kv in nextTimes) lastSkillTimes[kv.Key] = kv.Value;
                }
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"[MacroFallback] Tick error: {ex.Message}");
            }
            try
            {
                Task.Delay(100, token).GetAwaiter().GetResult();
            }
            catch (OperationCanceledException)
            {
                break;
            }
        }
    }
}
