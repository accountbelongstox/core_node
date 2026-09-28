using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>
/// Windows implementation of IGlobalHotkeyService using RegisterHotKey. Requires a window handle to receive WM_HOTKEY.
/// App must forward WM_HOTKEY (0x0312) to OnWmHotkey(wParam). Logic 1:1 with Python global hotkey registration.
/// </summary>
public sealed class WindowsGlobalHotkeyService : IGlobalHotkeyService
{
    private const int WM_HOTKEY = 0x0312;
    private const uint MOD_ALT = 0x0001;
    private const uint MOD_CONTROL = 0x0002;
    private const uint MOD_SHIFT = 0x0004;
    private const uint MOD_WIN = 0x0008;

    private readonly IntPtr _hwnd;
    private readonly IMainThreadDispatcher? _dispatcher;
    private readonly ConcurrentDictionary<string, Entry> _byId = new();
    private readonly ConcurrentDictionary<int, string> _idToKey = new();
    private int _nextId = 1;

    public WindowsGlobalHotkeyService(IntPtr hwnd, IMainThreadDispatcher? dispatcher = null)
    {
        _hwnd = hwnd;
        _dispatcher = dispatcher;
    }

    /// <summary>
    /// Call this from your window's WndProc when message == WM_HOTKEY (0x0312). wParam is the hotkey id.
    /// </summary>
    public void OnWmHotkey(int wParam)
    {
        if (!_idToKey.TryGetValue(wParam, out var id))
        {
            ColorPrinter.Gray($"[HOTKEY] Unknown wParam={wParam} (not registered or stale id)");
            return;
        }
        if (!_byId.TryGetValue(id, out var entry)) return;
        ColorPrinter.Gray($"[HOTKEY] Dispatching id={id}");
        if (_dispatcher != null)
            _dispatcher.Invoke(entry.Callback);
        else
            entry.Callback();
    }

    public bool Register(string id, string hotkeyCanonical, Action callback)
    {
        Guard.NotNullOrWhiteSpace(id);
        Guard.NotNull(callback);
        if (string.IsNullOrEmpty(hotkeyCanonical)) return false;

        Unregister(id);
        if (!ParseHotkey(hotkeyCanonical, out var mod, out var vk)) return false;

        int numId = _nextId++;
        if (!RegisterHotKey(_hwnd, numId, mod, vk))
            return false;

        _byId[id] = new Entry(numId, mod, vk, callback);
        _idToKey[numId] = id;
        return true;
    }

    public bool Unregister(string id)
    {
        if (!_byId.TryRemove(id, out var entry)) return true;
        _idToKey.TryRemove(entry.NumId, out _);
        return UnregisterHotKey(_hwnd, entry.NumId);
    }

    public void UnregisterAll()
    {
        foreach (var id in _byId.Keys.ToList())
            Unregister(id);
    }

    private static bool ParseHotkey(string canonical, out uint mod, out uint vk)
    {
        mod = 0;
        vk = 0;
        var parts = canonical.Split('+');
        int keyIndex = -1;
        for (int i = 0; i < parts.Length; i++)
        {
            var p = parts[i].Trim();
            if (p.Length == 0) continue;
            if (p == "ctrl" || p == "control") mod |= MOD_CONTROL;
            else if (p == "alt") mod |= MOD_ALT;
            else if (p == "shift") mod |= MOD_SHIFT;
            else if (p == "win" || p == "windows") mod |= MOD_WIN;
            else { keyIndex = i; break; }
        }
        if (keyIndex < 0) return false;
        var keyPart = parts[keyIndex].Trim().ToLowerInvariant();
        vk = KeyNameToVk(keyPart);
        return vk != 0;
    }

    private static uint KeyNameToVk(string name)
    {
        if (name.Length == 1)
        {
            char c = name[0];
            if (c >= 'a' && c <= 'z') return (uint)(c - 'a' + 0x41);
            if (c >= '0' && c <= '9') return (uint)(c - '0' + 0x30);
        }
        return name switch
        {
            "f1" => 0x70, "f2" => 0x71, "f3" => 0x72, "f4" => 0x73, "f5" => 0x74,
            "f6" => 0x75, "f7" => 0x76, "f8" => 0x77, "f9" => 0x78, "f10" => 0x79,
            "f11" => 0x7A, "f12" => 0x7B,
            "space" => 0x20, "enter" => 0x0D, "tab" => 0x09, "escape" or "esc" => 0x1B,
            _ => 0
        };
    }

    private sealed class Entry
    {
        public int NumId;
        public uint Mod, Vk;
        public Action Callback;
        public Entry(int numId, uint mod, uint vk, Action callback) { NumId = numId; Mod = mod; Vk = vk; Callback = callback; }
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);
}
