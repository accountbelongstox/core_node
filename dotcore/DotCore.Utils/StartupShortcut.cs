// PY-REF: none (DOT-only)
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;
using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>Start-on-logon via a .lnk in the current user's Startup folder (Windows only; no-op elsewhere).</summary>
public static class StartupShortcut
{
    private const string LinkExtension = ".lnk";
    private const string LogTag = "[StartupShortcut]";

    /// <summary>Full path of the shortcut, or null when the Startup folder is unknown.</summary>
    public static string? GetPath(string name)
    {
        var dir = Environment.GetFolderPath(Environment.SpecialFolder.Startup);
        return string.IsNullOrEmpty(dir) ? null : Path.Combine(dir, name + LinkExtension);
    }

    public static bool Exists(string name) => GetPath(name) is { } p && File.Exists(p);

    /// <summary>Create/refresh (enabled) or delete (disabled) the shortcut; true when the folder matches the request.</summary>
    public static bool Set(string name, bool enabled, string? targetPath, string? arguments = null)
    {
        if (!OperatingSystem.IsWindows()) return false;
        var path = GetPath(name);
        if (path == null) return false;
        try
        {
            if (!enabled)
            {
                if (File.Exists(path)) File.Delete(path);
                return true;
            }
            if (string.IsNullOrEmpty(targetPath) || !File.Exists(targetPath))
            {
                ColorPrinter.Yellow($"{LogTag} Target not found: {targetPath}");
                return false;
            }
            if (IsCurrent(path, targetPath, arguments ?? "")) return true;
            var link = (IShellLinkW)new ShellLink();
            link.SetPath(targetPath);
            link.SetArguments(arguments ?? "");
            link.SetWorkingDirectory(Path.GetDirectoryName(targetPath) ?? "");
            link.SetIconLocation(targetPath, 0);
            ((IPersistFile)link).Save(path, true);
            ColorPrinter.Green($"{LogTag} Created {path} -> {targetPath}");
            return true;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogTag} {name}: {ex.Message}");
            return false;
        }
    }

    private static bool IsCurrent(string path, string targetPath, string arguments)
    {
        if (!File.Exists(path)) return false;
        try
        {
            var link = (IShellLinkW)new ShellLink();
            ((IPersistFile)link).Load(path, 0);
            var target = new StringBuilder(260);
            link.GetPath(target, target.Capacity, IntPtr.Zero, 0);
            var args = new StringBuilder(1024);
            link.GetArguments(args, args.Capacity);
            return string.Equals(target.ToString(), targetPath, StringComparison.OrdinalIgnoreCase)
                   && string.Equals(args.ToString(), arguments, StringComparison.Ordinal);
        }
        catch
        {
            return false;
        }
    }

    [ComImport]
    [Guid("00021401-0000-0000-C000-000000000046")]
    private class ShellLink { }

    [ComImport]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    [Guid("000214F9-0000-0000-C000-000000000046")]
    private interface IShellLinkW
    {
        void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszFile, int cch, IntPtr pfd, int fFlags);
        void GetIDList(out IntPtr ppidl);
        void SetIDList(IntPtr pidl);
        void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszName, int cch);
        void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string pszName);
        void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszDir, int cch);
        void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string pszDir);
        void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszArgs, int cch);
        void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string pszArgs);
        void GetHotkey(out short pwHotkey);
        void SetHotkey(short wHotkey);
        void GetShowCmd(out int piShowCmd);
        void SetShowCmd(int iShowCmd);
        void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder pszIconPath, int cch, out int piIcon);
        void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string pszIconPath, int iIcon);
        void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string pszPathRel, int dwReserved);
        void Resolve(IntPtr hwnd, int fFlags);
        void SetPath([MarshalAs(UnmanagedType.LPWStr)] string pszFile);
    }
}
