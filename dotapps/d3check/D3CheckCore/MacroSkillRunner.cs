using System;
using System.Collections.Generic;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3check.Core;

/// <summary>
/// One macro tick: read skill config, respect intervals/delays, send keys and mouse to D3 window.
/// 1:1 with Python d3utils.macro_config_ops.run_one_skill_tick. Uses DotCore.Utils.WindowInputHelper (common lib).
/// Feature status: currently works as expected. DEBUG log for each key sent is commented out.
/// Key binding: CONFIG is path-based (macro_configs.skill_configs.{name}.skills.{skillKey}.key|strategy|interval|delay|random_delay).
/// To add a new skill row: add skillKey to MacroConfigLoader.LoadActive() skill list, to SkillOrder below, and to UI table; new key names add to KeyNameToVkMap or use single character (any single char is supported).
/// </summary>
public static class MacroSkillRunner
{
    private static readonly string[] SkillOrder = { "skill1", "skill2", "skill3", "skill4", "left_click", "right_click", "potion" };

    /// <summary>Resolve config key string to VK code. Returns null for unknown; LMB/RMB return 0 (caller uses mouse). Single char = VK of that char. 1:1 Python key_name_to_vk.</summary>
    public static uint? KeyNameToVk(string? keyName)
    {
        if (string.IsNullOrWhiteSpace(keyName)) return null;
        var u = keyName.Trim().ToUpperInvariant();
        if (u == "LMB" || u == "RMB") return 0; // mouse, not key
        if (KeyNameToVkMap.TryGetValue(u, out uint vk)) return vk;
        if (u.Length == 1) return (uint)u[0];
        return null;
    }

    /// <summary>Run one macro tick; returns updated lastSkillTimes. 1:1 Python run_one_skill_tick.</summary>
    public static IReadOnlyDictionary<string, double> RunOneSkillTick(
        IntPtr hwnd,
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>> skills,
        IReadOnlyDictionary<string, double> lastSkillTimes,
        double now,
        (int Left, int Top, int Right, int Bottom)? cachedD3Rect)
    {
        var nextTimes = new Dictionary<string, double>(lastSkillTimes);
        foreach (var sk in SkillOrder)
        {
            if (!skills.TryGetValue(sk, out var data) || data == null) continue;
            var strategy = (data.TryGetValue("strategy", out var stratVal) ? stratVal : "continuous")?.Trim().ToLowerInvariant() ?? "continuous";
            if (strategy is "ignore" or "disabled" or "禁用" or "忽略") continue;
            int intervalMs = int.TryParse(data.TryGetValue("interval", out var iv) ? iv : "100", out var i) ? Math.Max(0, i) : 100;
            int delayMs = int.TryParse(data.TryGetValue("delay", out var dv) ? dv : "0", out var d) ? Math.Max(0, d) : 0;
            int randMs = int.TryParse(data.TryGetValue("random_delay", out var rv) ? rv : "0", out var r) ? Math.Max(0, r) : 0;
            double intervalSec = intervalMs / 1000.0;
            double last = lastSkillTimes.TryGetValue(sk, out var lt) ? lt : 0.0;
            if (now - last < intervalSec) continue;
            if (delayMs > 0) Thread.Sleep(delayMs);
            if (randMs > 0) Thread.Sleep(Random.Shared.Next(0, randMs + 1));
            bool sent = false;
            if (sk == "left_click")
            {
                bool inBounds = cachedD3Rect.HasValue
                    ? WindowInputHelper.IsCursorInRect(cachedD3Rect.Value.Left, cachedD3Rect.Value.Top, cachedD3Rect.Value.Right, cachedD3Rect.Value.Bottom)
                    : WindowInputHelper.IsCursorInRect(0, 0, 65535, 65535); // no cache: allow
                sent = inBounds && WindowInputHelper.SendMouseClickAtCursor(hwnd, true);
            }
            else if (sk == "right_click")
            {
                bool inBounds = cachedD3Rect.HasValue
                    ? WindowInputHelper.IsCursorInRect(cachedD3Rect.Value.Left, cachedD3Rect.Value.Top, cachedD3Rect.Value.Right, cachedD3Rect.Value.Bottom)
                    : true;
                sent = inBounds && WindowInputHelper.SendMouseClickAtCursor(hwnd, false);
            }
            else
            {
                var keyName = data.TryGetValue("key", out var k) ? k : null;
                if (!string.IsNullOrWhiteSpace(keyName))
                {
                    var vk = KeyNameToVk(keyName);
                    if (vk.HasValue && vk.Value != 0)
                        sent = WindowInputHelper.PressKey(hwnd, vk.Value);
                    else if (vk.HasValue == false && !string.IsNullOrWhiteSpace(keyName))
                        ColorPrinter.Yellow($"[MacroSkillRunner] Unknown key name: {keyName}");
                }
            }
            if (sent)
            {
                nextTimes[sk] = now;
                // DEBUG: uncomment to log each key sent. Feature currently works as expected.
                // ColorPrinter.Gray($"[MacroSkill] DEBUG: Sent {sk} key={(sk == "left_click" ? "LMB" : sk == "right_click" ? "RMB" : (data.TryGetValue("key", out var kx) ? kx : sk))}");
            }
            if (strategy != "continuous") nextTimes[sk] = now;
        }
        return nextTimes;
    }

    /// <summary>Supported keys: 0-9, A-Z, F1-F12, ESCAPE, ENTER, SPACE, TAB, UP/DOWN/LEFT/RIGHT, PAGEUP/PAGEDOWN, HOME, END, INSERT. LMB/RMB = mouse. Any single character also supported as VK. Extend KeyNameToVkMap for more names.</summary>
    private static readonly Dictionary<string, uint> KeyNameToVkMap = new(StringComparer.OrdinalIgnoreCase)
    {
        ["A"] = 0x41, ["B"] = 0x42, ["C"] = 0x43, ["D"] = 0x44, ["E"] = 0x45, ["F"] = 0x46,
        ["G"] = 0x47, ["H"] = 0x48, ["I"] = 0x49, ["J"] = 0x4A, ["K"] = 0x4B, ["L"] = 0x4C,
        ["M"] = 0x4D, ["N"] = 0x4E, ["O"] = 0x4F, ["P"] = 0x50, ["Q"] = 0x51, ["R"] = 0x52,
        ["S"] = 0x53, ["T"] = 0x54, ["U"] = 0x55, ["V"] = 0x56, ["W"] = 0x57, ["X"] = 0x58,
        ["Y"] = 0x59, ["Z"] = 0x5A,
        ["0"] = 0x30, ["1"] = 0x31, ["2"] = 0x32, ["3"] = 0x33, ["4"] = 0x34,
        ["5"] = 0x35, ["6"] = 0x36, ["7"] = 0x37, ["8"] = 0x38, ["9"] = 0x39,
        ["F1"] = 0x70, ["F2"] = 0x71, ["F3"] = 0x72, ["F4"] = 0x73, ["F5"] = 0x74,
        ["F6"] = 0x75, ["F7"] = 0x76, ["F8"] = 0x77, ["F9"] = 0x78, ["F10"] = 0x79,
        ["F11"] = 0x7A, ["F12"] = 0x7B,
        ["ESCAPE"] = 0x1B, ["ENTER"] = 0x0D, ["SPACE"] = 0x20, ["TAB"] = 0x09,
        ["UP"] = 0x26, ["DOWN"] = 0x28, ["LEFT"] = 0x25, ["RIGHT"] = 0x27,
        ["PAGEUP"] = 0x21, ["PAGEDOWN"] = 0x22, ["HOME"] = 0x24, ["END"] = 0x23, ["INSERT"] = 0x2D,
    };
}
