// PY-REF: dotapps/d3d4tester/reference/py_d3check/ui/components/system_tray.py
using System.Runtime.InteropServices;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Interop;
using System.Windows.Media;

namespace DotCore.UITheme.Tray;

/// <summary>
/// Notification-area icon without WinForms: Shell_NotifyIcon on a message-only HwndSource, themed WPF ContextMenu
/// on right click, Activated on left click / double click, balloon notifications and re-add after Explorer restarts.
/// Create, use and dispose on the UI thread. 1:1 Python pystray Icon (title, menu, run/stop, notify).
/// </summary>
public sealed class NotifyTrayIcon : IDisposable
{
    private const int HwndMessage = -3;
    private const int WmApp = 0x8000;
    private const int WmTrayCallback = WmApp + 1;
    private const int WmLButtonUp = 0x0202;
    private const int WmLButtonDblClk = 0x0203;
    private const int WmRButtonUp = 0x0205;
    private const int WmContextMenu = 0x007B;
    private const uint NimAdd = 0;
    private const uint NimModify = 1;
    private const uint NimDelete = 2;
    private const uint NifMessage = 0x01;
    private const uint NifIcon = 0x02;
    private const uint NifTip = 0x04;
    private const uint NifInfo = 0x10;
    private const uint NiifInfo = 0x01;
    private const int TipMaxLength = 127;
    private const int InfoMaxLength = 255;
    private const int InfoTitleMaxLength = 63;
    private const string TaskbarCreatedMessage = "TaskbarCreated";
    private const string MessageWindowName = "DotCoreNotifyTrayIcon";

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct NotifyIconData
    {
        public int CbSize;
        public IntPtr HWnd;
        public uint UId;
        public uint UFlags;
        public uint UCallbackMessage;
        public IntPtr HIcon;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)] public string SzTip;
        public uint DwState;
        public uint DwStateMask;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)] public string SzInfo;
        public uint UTimeoutOrVersion;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)] public string SzInfoTitle;
        public uint DwInfoFlags;
        public Guid GuidItem;
        public IntPtr HBalloonIcon;
    }

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    private static extern bool Shell_NotifyIcon(uint message, ref NotifyIconData data);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int RegisterWindowMessage(string name);

    [DllImport("user32.dll")]
    private static extern bool SetForegroundWindow(IntPtr hWnd);

    private static uint _nextId = 1;

    private readonly uint _id;
    private readonly int _taskbarCreatedMsg;
    private HwndSource? _source;
    private IntPtr _hIcon;
    private string _tooltip = "";
    private bool _added;
    private bool _disposed;

    public NotifyTrayIcon()
    {
        _id = _nextId++;
        _taskbarCreatedMsg = SafeRegisterWindowMessage(TaskbarCreatedMessage);
    }

    /// <summary>Menu shown on right click (styled by the app's ContextMenu/MenuItem resources).</summary>
    public ContextMenu? ContextMenu { get; set; }

    /// <summary>Raised on left click and double click (typical action: show the main window).</summary>
    public event EventHandler? Activated;

    /// <summary>True while the icon is in the notification area.</summary>
    public bool IsVisible => _added;

    /// <summary>Adds the icon to the notification area. Returns false when the shell rejects it.</summary>
    public bool Show(ImageSource icon, string tooltip)
    {
        if (_disposed) return false;
        EnsureSource();
        SetIconHandle(icon);
        _tooltip = tooltip ?? "";
        var data = CreateData(NifMessage | NifIcon | NifTip);
        _added = Call(_added ? NimModify : NimAdd, ref data);
        return _added;
    }

    /// <summary>Updates the hover text. 1:1 Python update_tooltip.</summary>
    public void SetTooltip(string tooltip)
    {
        _tooltip = tooltip ?? "";
        if (!_added) return;
        var data = CreateData(NifTip);
        Call(NimModify, ref data);
    }

    /// <summary>Replaces the icon image.</summary>
    public void SetIcon(ImageSource icon)
    {
        SetIconHandle(icon);
        if (!_added) return;
        var data = CreateData(NifIcon);
        Call(NimModify, ref data);
    }

    /// <summary>Shows a balloon / toast notification. 1:1 Python show_notification(title, message).</summary>
    public void ShowNotification(string title, string message)
    {
        if (!_added) return;
        var data = CreateData(NifInfo);
        data.SzInfoTitle = Truncate(title, InfoTitleMaxLength);
        data.SzInfo = Truncate(message, InfoMaxLength);
        data.DwInfoFlags = NiifInfo;
        Call(NimModify, ref data);
    }

    /// <summary>Removes the icon from the notification area (can be shown again).</summary>
    public void Hide()
    {
        if (!_added) return;
        var data = CreateData(0);
        Call(NimDelete, ref data);
        _added = false;
    }

    public void Dispose()
    {
        if (_disposed) return;
        _disposed = true;
        Hide();
        if (ContextMenu != null) ContextMenu.IsOpen = false;
        TrayIconImage.Destroy(_hIcon);
        _hIcon = IntPtr.Zero;
        if (_source != null)
        {
            _source.RemoveHook(WndProc);
            _source.Dispose();
            _source = null;
        }
    }

    private void EnsureSource()
    {
        if (_source != null) return;
        var parameters = new HwndSourceParameters(MessageWindowName)
        {
            ParentWindow = new IntPtr(HwndMessage),
            Width = 0,
            Height = 0,
            WindowStyle = 0,
        };
        _source = new HwndSource(parameters);
        _source.AddHook(WndProc);
    }

    private void SetIconHandle(ImageSource icon)
    {
        var handle = TrayIconImage.CreateHIcon(icon, TrayIconImage.SmallIconSize);
        if (handle == IntPtr.Zero) return;
        TrayIconImage.Destroy(_hIcon);
        _hIcon = handle;
    }

    private NotifyIconData CreateData(uint flags) => new()
    {
        CbSize = Marshal.SizeOf<NotifyIconData>(),
        HWnd = _source?.Handle ?? IntPtr.Zero,
        UId = _id,
        UFlags = flags,
        UCallbackMessage = WmTrayCallback,
        HIcon = _hIcon,
        SzTip = Truncate(_tooltip, TipMaxLength),
        SzInfo = "",
        SzInfoTitle = "",
    };

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        if (msg == WmTrayCallback)
        {
            switch (lParam.ToInt32() & 0xFFFF)
            {
                case WmLButtonUp:
                case WmLButtonDblClk:
                    Activated?.Invoke(this, EventArgs.Empty);
                    break;
                case WmRButtonUp:
                case WmContextMenu:
                    OpenContextMenu();
                    break;
            }
            handled = true;
        }
        else if (_taskbarCreatedMsg != 0 && msg == _taskbarCreatedMsg && _added)
        {
            var data = CreateData(NifMessage | NifIcon | NifTip);
            _added = Call(NimAdd, ref data);
        }
        return IntPtr.Zero;
    }

    private void OpenContextMenu()
    {
        var menu = ContextMenu;
        if (menu == null) return;
        menu.Placement = PlacementMode.MousePoint;
        menu.IsOpen = true;
        if (PresentationSource.FromVisual(menu) is HwndSource popupSource)
            SafeSetForeground(popupSource.Handle);
    }

    private static bool Call(uint message, ref NotifyIconData data)
    {
        try { return Shell_NotifyIcon(message, ref data); }
        catch (DllNotFoundException) { return false; }
        catch (EntryPointNotFoundException) { return false; }
    }

    private static int SafeRegisterWindowMessage(string name)
    {
        try { return RegisterWindowMessage(name); }
        catch (DllNotFoundException) { return 0; }
    }

    private static void SafeSetForeground(IntPtr hwnd)
    {
        try { SetForegroundWindow(hwnd); }
        catch (DllNotFoundException) { }
    }

    private static string Truncate(string? text, int max) =>
        string.IsNullOrEmpty(text) ? "" : (text.Length <= max ? text : text[..max]);
}
