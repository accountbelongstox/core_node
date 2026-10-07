using System.Collections.Concurrent;
using System.Runtime.InteropServices;
using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>
/// Windows implementation of IGlobalHotkeyService using a pass-through low-level keyboard hook: keys always reach every app
/// (1:1 with Python keyboard.add_hotkey suppress=False). A match posts WM_HOTKEY to the window handle.
/// App must forward WM_HOTKEY (0x0312) to OnWmHotkey(wParam).
/// </summary>
public sealed class WindowsGlobalHotkeyService : IGlobalHotkeyService
{
    private const int WM_HOTKEY = 0x0312;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_QUIT = 0x0012;
    private const int WH_KEYBOARD_LL = 13;
    private const uint PM_NOREMOVE = 0x0000;
    private const uint MOD_ALT = 0x0001;
    private const uint MOD_CONTROL = 0x0002;
    private const uint MOD_SHIFT = 0x0004;
    private const uint MOD_WIN = 0x0008;
    private const int VK_SHIFT = 0x10;
    private const int VK_CONTROL = 0x11;
    private const int VK_MENU = 0x12;
    private const int VK_LWIN = 0x5B;
    private const int VK_RWIN = 0x5C;

    private readonly IntPtr _hwnd;
    private readonly IMainThreadDispatcher? _dispatcher;
    private readonly ConcurrentDictionary<string, Entry> _byId = new();
    private readonly ConcurrentDictionary<int, string> _idToKey = new();
    private readonly LowLevelKeyboardProc _hookProc;
    private readonly object _hookLock = new();
    private Thread? _hookThread;
    private uint _hookThreadId;
    private bool _hookInstalled;
    private int _nextId = 1;

    public WindowsGlobalHotkeyService(IntPtr hwnd, IMainThreadDispatcher? dispatcher = null)
    {
        _hwnd = hwnd;
        _dispatcher = dispatcher;
        _hookProc = HookProc;
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
        if (!EnsureHookThread()) return false;

        int numId = Interlocked.Increment(ref _nextId);
        _idToKey[numId] = id;
        _byId[id] = new Entry(numId, mod, vk, callback);
        return true;
    }

    public bool Unregister(string id)
    {
        if (!_byId.TryRemove(id, out var entry)) return true;
        _idToKey.TryRemove(entry.NumId, out _);
        if (_byId.IsEmpty) StopHookThread();
        return true;
    }

    public void UnregisterAll()
    {
        foreach (var id in _byId.Keys.ToList())
            Unregister(id);
    }

    private bool EnsureHookThread()
    {
        lock (_hookLock)
        {
            if (_hookThread != null) return _hookInstalled;
            using var ready = new ManualResetEventSlim(false);
            _hookThread = new Thread(() => HookThreadMain(ready)) { IsBackground = true, Name = "GlobalHotkeyHook" };
            _hookThread.Start();
            ready.Wait();
            if (!_hookInstalled)
            {
                ColorPrinter.Red($"[HOTKEY] SetWindowsHookEx failed (error={Marshal.GetLastPInvokeError()})");
                _hookThread = null;
            }
            return _hookInstalled;
        }
    }

    private void StopHookThread()
    {
        lock (_hookLock)
        {
            if (_hookThread == null || !_byId.IsEmpty) return;
            PostThreadMessage(_hookThreadId, WM_QUIT, IntPtr.Zero, IntPtr.Zero);
            _hookThread = null;
            _hookInstalled = false;
        }
    }

    private void HookThreadMain(ManualResetEventSlim ready)
    {
        _hookThreadId = GetCurrentThreadId();
        PeekMessage(out _, IntPtr.Zero, 0, 0, PM_NOREMOVE);
        var hook = SetWindowsHookEx(WH_KEYBOARD_LL, _hookProc, GetModuleHandle(null), 0);
        _hookInstalled = hook != IntPtr.Zero;
        ready.Set();
        if (hook == IntPtr.Zero) return;
        while (GetMessage(out var msg, IntPtr.Zero, 0, 0) > 0)
            DispatchMessage(ref msg);
        UnhookWindowsHookEx(hook);
    }

    private IntPtr HookProc(int nCode, IntPtr wParam, IntPtr lParam)
    {
        int message = wParam.ToInt32();
        if (nCode >= 0 && (message == WM_KEYDOWN || message == WM_SYSKEYDOWN))
        {
            uint vk = (uint)Marshal.ReadInt32(lParam);
            uint mods = CurrentModifiers();
            foreach (var entry in _byId.Values)
            {
                if (entry.Vk == vk && entry.Mod == mods)
                    PostMessage(_hwnd, WM_HOTKEY, (IntPtr)entry.NumId, IntPtr.Zero);
            }
        }
        return CallNextHookEx(IntPtr.Zero, nCode, wParam, lParam);
    }

    private static uint CurrentModifiers()
    {
        uint mods = 0;
        if (IsDown(VK_CONTROL)) mods |= MOD_CONTROL;
        if (IsDown(VK_MENU)) mods |= MOD_ALT;
        if (IsDown(VK_SHIFT)) mods |= MOD_SHIFT;
        if (IsDown(VK_LWIN) || IsDown(VK_RWIN)) mods |= MOD_WIN;
        return mods;
    }

    private static bool IsDown(int vk) => (GetAsyncKeyState(vk) & 0x8000) != 0;

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

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll")]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool PostMessage(IntPtr hWnd, int msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool PostThreadMessage(uint idThread, int msg, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool PeekMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax, uint wRemoveMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref MSG lpMsg);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode)]
    private static extern IntPtr GetModuleHandle(string? lpModuleName);
}
