// PY-REF: dotapps/d3d4tester/reference/py_d3check/d3utils/macro_config_ops.py
using System;
using System.Collections.Generic;
using System.Threading;
using DotCore.Foundations;
using DotCore.Utils;
using DotCore.Utils.Input;

namespace DotApps.d3d4tester.Core;

/// <summary>
/// One macro tick: read skill config, respect intervals/delays, send keys and mouse to D3 window.
/// 1:1 with Python d3utils.macro_config_ops.run_one_skill_tick. Uses DotCore.Utils.WindowInputHelper (common lib).
/// Key binding: CONFIG is path-based (macro_configs.skill_configs.{name}.skills.{skillKey}.{field}, schema in MacroSkillSchema).
/// To add a new skill row: add skillKey to SkillKeys below (config loader, UI table and runner all use it); key names resolve via ClickHandler.TryResolveKey.
/// </summary>
public static class MacroSkillRunner
{
    public const string SkillLeftClick = "left_click";
    public const string SkillRightClick = "right_click";
    public const string SkillPotion = "potion";
    private const string MouseLeftName = "LMB";
    private const string MouseRightName = "RMB";

    /// <summary>Skill rows in run / table order (macro_configs.skill_configs.&lt;name&gt;.skills.&lt;key&gt;); the single list for loader, UI and runner.</summary>
    public static readonly IReadOnlyList<string> SkillKeys = new[] { "skill1", "skill2", "skill3", "skill4", SkillLeftClick, SkillRightClick, SkillPotion };

    /// <summary>Skills currently held down by the hold strategy -> held vk (0 for mouse rows) and release action.</summary>
    private static readonly Dictionary<string, HeldEntry> HeldSkills = new(StringComparer.Ordinal);
    private static readonly object HeldLock = new();

    private sealed record HeldEntry(ushort Vk, Action Release);

    /// <summary>Release every key / mouse button held by the hold strategy (macro stop or smart pause).</summary>
    public static void ReleaseHeld()
    {
        List<HeldEntry> releases;
        lock (HeldLock)
        {
            releases = HeldSkills.Values.ToList();
            HeldSkills.Clear();
        }
        foreach (var entry in releases) Release(entry);
    }

    private static void Release(HeldEntry entry)
    {
        try { entry.Release(); } catch (Exception ex) { ColorPrinter.Yellow($"[MacroSkillRunner] Release held failed: {ex.Message}"); }
    }

    /// <summary>Release held entries whose skill is no longer "hold" or whose key changed.</summary>
    private static void ReleaseStaleHeld(IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> skills)
    {
        List<HeldEntry>? stale = null;
        lock (HeldLock)
        {
            foreach (var kv in HeldSkills.ToList())
            {
                bool keep = skills.TryGetValue(kv.Key, out var data) && data != null
                    && StrategyOf(kv.Key, data) == MacroSkillSchema.StrategyHold
                    && (MacroSkillSchema.IsMouseRow(kv.Key) || (ResolveKey(KeyOf(kv.Key, data), out ushort vk) && vk == kv.Value.Vk));
                if (keep) continue;
                HeldSkills.Remove(kv.Key);
                (stale ??= new List<HeldEntry>()).Add(kv.Value);
            }
        }
        if (stale != null) foreach (var entry in stale) Release(entry);
    }

    /// <summary>Hold strategy: press once (key or mouse button via SendInput) and keep it down until released. Mouse only inside the D3 client area.</summary>
    private static void EnsureHeld(string skillKey, IReadOnlyDictionary<string, string> data, bool cursorInD3)
    {
        lock (HeldLock)
        {
            if (HeldSkills.ContainsKey(skillKey)) return;
        }
        HeldEntry? entry = null;
        if (MacroSkillSchema.IsMouseRow(skillKey))
        {
            if (!cursorInD3) return;
            var button = skillKey == SkillLeftClick ? MouseButton.Left : MouseButton.Right;
            if (ClickHandler.MouseButtonDown(button)) entry = new HeldEntry(0, () => ClickHandler.MouseButtonUp(button));
        }
        else if (ResolveKey(KeyOf(skillKey, data), out ushort vk) && vk != 0 && ClickHandler.SendVirtualKey(vk, down: true))
        {
            entry = new HeldEntry(vk, () => ClickHandler.SendVirtualKey(vk, down: false));
        }
        if (entry == null) return;
        lock (HeldLock) HeldSkills[skillKey] = entry;
    }

    /// <summary>Resolve a config / hotkey-box key name to a VK code via the shared ClickHandler resolver. LMB/RMB resolve to 0 (caller uses mouse).</summary>
    public static bool ResolveKey(string? keyName, out ushort vk)
    {
        vk = 0;
        if (string.IsNullOrWhiteSpace(keyName)) return false;
        var name = keyName.Trim();
        if (name.Equals(MouseLeftName, StringComparison.OrdinalIgnoreCase) || name.Equals(MouseRightName, StringComparison.OrdinalIgnoreCase)) return true;
        return ClickHandler.TryResolveKey(name, out vk);
    }

    private static string StrategyOf(string skillKey, IReadOnlyDictionary<string, string> data) =>
        MacroSkillSchema.NormalizeStrategy(
            data.TryGetValue(MacroSkillSchema.FieldStrategy, out var s) ? s : null,
            MacroSkillSchema.DefaultStrategy(skillKey, data.Count > 0));

    private static string KeyOf(string skillKey, IReadOnlyDictionary<string, string> data) =>
        data.TryGetValue(MacroSkillSchema.FieldKey, out var k) && !string.IsNullOrWhiteSpace(k) ? k : MacroSkillSchema.DefaultKey(skillKey);

    private static int ReadMs(IReadOnlyDictionary<string, string> data, string field, int defaultValue) =>
        data.TryGetValue(field, out var text) && int.TryParse(text, out var v) ? Math.Max(0, v) : defaultValue;

    /// <summary>Run one macro tick; returns updated lastSkillTimes. Delays wait on the token so a stop interrupts them. 1:1 Python run_one_skill_tick.</summary>
    public static IReadOnlyDictionary<string, double> RunOneSkillTick(
        IntPtr hwnd,
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> skills,
        IReadOnlyDictionary<string, double> lastSkillTimes,
        double now,
        (int Left, int Top, int Right, int Bottom)? cachedD3Rect,
        CancellationToken token,
        ushort? standVk = null)
    {
        var nextTimes = new Dictionary<string, double>(lastSkillTimes);
        ReleaseStaleHeld(skills);
        foreach (var sk in SkillKeys)
        {
            if (token.IsCancellationRequested) break;
            if (!skills.TryGetValue(sk, out var data) || data == null) continue;
            var strategy = StrategyOf(sk, data);
            if (strategy == MacroSkillSchema.StrategyIgnore) continue;
            if (strategy == MacroSkillSchema.StrategyHold)
            {
                EnsureHeld(sk, data, IsCursorInD3(hwnd, cachedD3Rect));
                continue;
            }
            int intervalMs = ReadMs(data, MacroSkillSchema.FieldInterval, MacroSkillSchema.IntervalDefault);
            int delayMs = ReadMs(data, MacroSkillSchema.FieldDelay, MacroSkillSchema.DelayDefault);
            int randMs = ReadMs(data, MacroSkillSchema.FieldRandomDelay, MacroSkillSchema.RandomDelayDefault);
            double intervalSec = intervalMs / 1000.0;
            double last = lastSkillTimes.TryGetValue(sk, out var lt) ? lt : 0.0;
            if (now - last < intervalSec) continue;
            if (delayMs > 0 && token.WaitHandle.WaitOne(delayMs)) break;
            if (randMs > 0 && token.WaitHandle.WaitOne(Random.Shared.Next(0, randMs + 1))) break;
            bool sent = false;
            if (sk == SkillLeftClick)
            {
                if (IsCursorInD3(hwnd, cachedD3Rect))
                {
                    bool stand = standVk.HasValue && ClickHandler.SendVirtualKey(standVk.Value, down: true);
                    sent = WindowInputHelper.SendMouseClickAtCursor(hwnd, true);
                    if (stand) ClickHandler.SendVirtualKey(standVk!.Value, down: false);
                }
            }
            else if (sk == SkillRightClick)
            {
                sent = IsCursorInD3(hwnd, cachedD3Rect) && WindowInputHelper.SendMouseClickAtCursor(hwnd, false);
            }
            else
            {
                var keyName = KeyOf(sk, data);
                if (!string.IsNullOrWhiteSpace(keyName))
                {
                    if (!ResolveKey(keyName, out ushort vk))
                        ColorPrinter.Yellow($"[MacroSkillRunner] Unknown key name: {keyName}");
                    else if (vk != 0)
                        sent = WindowInputHelper.PressKey(hwnd, vk);
                }
            }
            if (sent || strategy != MacroSkillSchema.StrategyContinuous) nextTimes[sk] = now;
        }
        return nextTimes;
    }

    private static bool IsCursorInD3(IntPtr hwnd, (int Left, int Top, int Right, int Bottom)? cachedD3Rect) =>
        cachedD3Rect.HasValue
            ? WindowInputHelper.IsCursorInRect(cachedD3Rect.Value.Left, cachedD3Rect.Value.Top, cachedD3Rect.Value.Right, cachedD3Rect.Value.Bottom)
            : WindowInputHelper.IsCursorInWindow(hwnd);
}
