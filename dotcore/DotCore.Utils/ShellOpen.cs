// PY-REF: pyapps/d3-check/utils/_obsolete_program_manager.py
using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using DotCore.Foundations;

namespace DotCore.Utils;

/// <summary>
/// Open path / directory / file / URL with the default handler and start programs.
/// 1:1 Python pycore/pyfoundations/system_launcher.py (open_path, open_dir, open_file, open_file_with_notepad, start_program).
/// Windows: shell execute; macOS: open; Linux: xdg-open.
/// </summary>
public static class ShellOpen
{
    private const string LogTag = "[SystemLauncher]";
    private const string WindowsNotepad = "notepad.exe";
    private const string MacOpen = "open";
    private const string LinuxOpen = "xdg-open";
    private static readonly string[] LinuxFallbackEditors = { "gnome-text-editor", "gedit", "kate", "mousepad", "xed" };

    /// <summary>Open any path with its default app; no existence check. 1:1 Python open_path.</summary>
    public static bool OpenPath(string path) => LaunchTarget(Path.GetFullPath(path));

    /// <summary>Open a directory in the file manager; a file opens its parent. False if missing. 1:1 Python open_dir.</summary>
    public static bool OpenDir(string path)
    {
        string full = Path.GetFullPath(path);
        if (File.Exists(full)) full = Path.GetDirectoryName(full) ?? full;
        else if (!Directory.Exists(full)) return false;
        return LaunchTarget(full);
    }

    /// <summary>Open an existing file with its default app. 1:1 Python open_file.</summary>
    public static bool OpenFile(string path)
    {
        string full = Path.GetFullPath(path);
        return File.Exists(full) && LaunchTarget(full);
    }

    /// <summary>Open an http(s) URL in the default browser.</summary>
    public static bool OpenUrl(string url)
    {
        if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            return false;
        return LaunchTarget(uri.AbsoluteUri);
    }

    /// <summary>Open a file in a text editor (Notepad / TextEdit / editor or xdg-open). 1:1 Python open_file_with_notepad.</summary>
    public static bool OpenFileWithNotepad(string path, string? editor = null)
    {
        string full = Path.GetFullPath(path);
        if (!File.Exists(full)) return false;
        if (OperatingSystem.IsWindows()) return SpawnDetached(WindowsNotepad, full);
        if (OperatingSystem.IsMacOS()) return SpawnDetached(MacOpen, "-e", full);
        var candidates = new List<string>();
        if (!string.IsNullOrWhiteSpace(editor)) candidates.Add(editor);
        candidates.Add(LinuxOpen);
        candidates.AddRange(LinuxFallbackEditors);
        foreach (var candidate in candidates)
            if (SpawnDetached(candidate, full)) return true;
        return false;
    }

    /// <summary>Start an existing executable with arguments; working directory = its folder. 1:1 Python start_program.</summary>
    public static bool StartProgram(string executablePath, params string[] args)
    {
        string exe = Path.GetFullPath(executablePath);
        if (!File.Exists(exe)) return false;
        if (OperatingSystem.IsWindows() && StartOutsideJob(exe, args, Path.GetDirectoryName(exe) ?? ""))
            return true;
        var psi = new ProcessStartInfo(exe)
        {
            UseShellExecute = OperatingSystem.IsWindows() && args.Length == 0,
            WorkingDirectory = Path.GetDirectoryName(exe) ?? ""
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        return Start(psi, exe);
    }

    /// <summary>
    /// Windows: create the process with CREATE_BREAKAWAY_FROM_JOB so it does not belong to our job object. A host such as
    /// dotnet watch runs us in a kill-on-close job; a client started from inside it (Battle.net, ROSBOT) would be killed whenever
    /// this app restarts or exits. False when the job forbids breakaway (caller falls back to a normal start).
    /// </summary>
    private static bool StartOutsideJob(string exe, IReadOnlyList<string> args, string workingDirectory)
    {
        string commandLine = string.Join(" ", new[] { exe }.Concat(args).Select(QuoteArgument));
        var si = new StartupInfo { cb = Marshal.SizeOf<StartupInfo>() };
        if (!CreateProcessW(exe, commandLine, IntPtr.Zero, IntPtr.Zero, false, CreateBreakawayFromJob | CreateNewProcessGroup,
                IntPtr.Zero, workingDirectory, ref si, out var pi))
        {
            ColorPrinter.Gray($"{LogTag} breakaway start not allowed (error {Marshal.GetLastWin32Error()}), normal start: {exe}");
            return false;
        }
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        return true;
    }

    private static string QuoteArgument(string arg) =>
        arg.Length > 0 && arg.IndexOfAny(new[] { ' ', '\t', '"' }) < 0 ? arg : "\"" + arg.Replace("\"", "\\\"") + "\"";

    private const uint CreateBreakawayFromJob = 0x01000000;
    private const uint CreateNewProcessGroup = 0x00000200;

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfo
    {
        public int cb;
        public IntPtr lpReserved, lpDesktop, lpTitle;
        public int dwX, dwY, dwXSize, dwYSize, dwXCountChars, dwYCountChars, dwFillAttribute, dwFlags;
        public short wShowWindow, cbReserved2;
        public IntPtr lpReserved2, hStdInput, hStdOutput, hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct ProcessInformation
    {
        public IntPtr hProcess, hThread;
        public int dwProcessId, dwThreadId;
    }

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    private static extern bool CreateProcessW(string applicationName, string commandLine, IntPtr processAttributes, IntPtr threadAttributes,
        bool inheritHandles, uint creationFlags, IntPtr environment, string currentDirectory, ref StartupInfo startupInfo, out ProcessInformation processInformation);

    [DllImport("kernel32.dll")]
    private static extern bool CloseHandle(IntPtr handle);

    private static bool LaunchTarget(string target)
    {
        if (OperatingSystem.IsWindows())
            return Start(new ProcessStartInfo(target) { UseShellExecute = true }, target);
        return SpawnDetached(OperatingSystem.IsMacOS() ? MacOpen : LinuxOpen, target);
    }

    private static bool SpawnDetached(string fileName, params string[] args)
    {
        var psi = new ProcessStartInfo(fileName) { UseShellExecute = false };
        foreach (var a in args) psi.ArgumentList.Add(a);
        return Start(psi, fileName);
    }

    private static bool Start(ProcessStartInfo psi, string label)
    {
        try
        {
            using var p = Process.Start(psi);
            return true;
        }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException or FileNotFoundException)
        {
            ColorPrinter.Yellow($"{LogTag} open {label} failed: {ex.Message}");
            return false;
        }
    }
}
