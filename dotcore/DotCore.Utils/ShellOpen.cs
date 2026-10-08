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

    /// <summary>True when this process runs with an administrator (elevated) token.</summary>
    public static bool IsElevated => Environment.IsPrivilegedProcess;

    private static int _elevationDeclined;

    /// <summary>
    /// Windows: start a program elevated (administrator) and detached from this app, so it outlives app restarts while this app can
    /// still drive its windows. Already elevated: breakaway from our job, our elevated token is kept (no UAC prompt). Not elevated:
    /// ShellExecute "runas" (one UAC prompt; the system creates the process outside our process tree). After a declined prompt the
    /// rest of the session starts programs normally (no repeated prompts). Other OSes: normal start.
    /// </summary>
    public static bool StartProgramElevated(string executablePath, params string[] args)
    {
        string exe = Path.GetFullPath(executablePath);
        if (!File.Exists(exe)) return false;
        if (!OperatingSystem.IsWindows() || Volatile.Read(ref _elevationDeclined) == 1) return StartProgram(exe, args);
        string workingDirectory = Path.GetDirectoryName(exe) ?? "";
        if (IsElevated)
        {
            string commandLine = string.Join(" ", new[] { exe }.Concat(args).Select(QuoteArgument));
            if (StartBreakaway(exe, commandLine, workingDirectory)) return true;
            var psi = new ProcessStartInfo(exe) { UseShellExecute = false, WorkingDirectory = workingDirectory };
            foreach (var a in args) psi.ArgumentList.Add(a);
            return Start(psi, exe);
        }
        return StartRunas(exe, args, workingDirectory, startNormallyWhenDeclined: true);
    }

    /// <summary>Restart this app elevated (UAC prompt) with the same arguments; true when the elevated copy was started.</summary>
    public static bool RelaunchSelfElevated(IReadOnlyList<string> args)
    {
        string? exe = Environment.ProcessPath;
        return OperatingSystem.IsWindows() && !IsElevated && exe != null && StartRunas(exe, args, Path.GetDirectoryName(exe) ?? "", startNormallyWhenDeclined: false);
    }

    private static bool StartRunas(string exe, IReadOnlyList<string> args, string workingDirectory, bool startNormallyWhenDeclined)
    {
        var psi = new ProcessStartInfo(exe)
        {
            UseShellExecute = true,
            Verb = RunasVerb,
            WorkingDirectory = workingDirectory,
            Arguments = string.Join(" ", args.Select(QuoteArgument)),
        };
        try
        {
            using var p = Process.Start(psi);
            ColorPrinter.Gray($"{LogTag} started elevated (runas): {exe}");
            return true;
        }
        catch (Win32Exception ex) when (ex.NativeErrorCode == ErrorCancelled)
        {
            Interlocked.Exchange(ref _elevationDeclined, 1);
            ColorPrinter.Yellow($"{LogTag} administrator prompt declined, programs start normally from now on: {exe}");
            return startNormallyWhenDeclined && StartProgram(exe, args.ToArray());
        }
        catch (Exception ex) when (ex is Win32Exception or InvalidOperationException)
        {
            ColorPrinter.Yellow($"{LogTag} elevated start failed ({ex.Message}): {exe}");
            return false;
        }
    }

    /// <summary>
    /// Windows: start a program that must outlive this app (Battle.net, ROSBOT). A host such as dotnet watch runs us in a
    /// kill-on-close job, so a normal child dies whenever the app restarts or exits.
    /// 1) Parent = the desktop shell (explorer.exe) via PROC_THREAD_ATTRIBUTE_PARENT_PROCESS: the program is not our child and
    ///    inherits the shell's job instead of ours, exactly like a desktop launch.
    /// 2) Fallback CREATE_BREAKAWAY_FROM_JOB (still our child, but outside our job).
    /// False when both fail (caller falls back to a normal start).
    /// </summary>
    private static bool StartOutsideJob(string exe, IReadOnlyList<string> args, string workingDirectory)
    {
        string commandLine = string.Join(" ", new[] { exe }.Concat(args).Select(QuoteArgument));
        if (StartWithShellParent(exe, commandLine, workingDirectory)) return true;
        return StartBreakaway(exe, commandLine, workingDirectory);
    }

    /// <summary>Our child outside our job (CREATE_BREAKAWAY_FROM_JOB): keeps our token, survives our job closing.</summary>
    private static bool StartBreakaway(string exe, string commandLine, string workingDirectory)
    {
        var si = new StartupInfo { cb = Marshal.SizeOf<StartupInfo>() };
        if (!CreateProcessW(exe, commandLine, IntPtr.Zero, IntPtr.Zero, false, CreateBreakawayFromJob | CreateNewProcessGroup,
                IntPtr.Zero, workingDirectory, ref si, out var pi))
        {
            ColorPrinter.Gray($"{LogTag} breakaway start not allowed (error {Marshal.GetLastWin32Error()}), normal start: {exe}");
            return false;
        }
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
        ColorPrinter.Gray($"{LogTag} started outside the job (breakaway): {exe}");
        return true;
    }

    private static bool StartWithShellParent(string exe, string commandLine, string workingDirectory)
    {
        IntPtr shell = GetShellWindow();
        if (shell == IntPtr.Zero || GetWindowThreadProcessId(shell, out uint shellPid) == 0 || shellPid == 0) return false;
        IntPtr parent = OpenProcess(ProcessCreateProcess, false, shellPid);
        if (parent == IntPtr.Zero) return false;
        IntPtr attributes = IntPtr.Zero;
        IntPtr parentValue = Marshal.AllocHGlobal(IntPtr.Size);
        try
        {
            IntPtr size = IntPtr.Zero;
            InitializeProcThreadAttributeList(IntPtr.Zero, 1, 0, ref size);
            attributes = Marshal.AllocHGlobal(size);
            if (!InitializeProcThreadAttributeList(attributes, 1, 0, ref size)) return false;
            Marshal.WriteIntPtr(parentValue, parent);
            if (!UpdateProcThreadAttribute(attributes, 0, ProcThreadAttributeParentProcess, parentValue, (IntPtr)IntPtr.Size, IntPtr.Zero, IntPtr.Zero))
                return false;
            var six = new StartupInfoEx { StartupInfo = new StartupInfo { cb = Marshal.SizeOf<StartupInfoEx>() }, lpAttributeList = attributes };
            if (!CreateProcessEx(exe, commandLine, IntPtr.Zero, IntPtr.Zero, false, ExtendedStartupInfoPresent | CreateNewProcessGroup,
                    IntPtr.Zero, workingDirectory, ref six, out var pi))
            {
                ColorPrinter.Gray($"{LogTag} start with shell parent failed (error {Marshal.GetLastWin32Error()}): {exe}");
                return false;
            }
            CloseHandle(pi.hThread);
            CloseHandle(pi.hProcess);
            ColorPrinter.Gray($"{LogTag} started with the desktop shell as parent: {exe}");
            return true;
        }
        finally
        {
            if (attributes != IntPtr.Zero)
            {
                DeleteProcThreadAttributeList(attributes);
                Marshal.FreeHGlobal(attributes);
            }
            Marshal.FreeHGlobal(parentValue);
            CloseHandle(parent);
        }
    }

    private static string QuoteArgument(string arg) =>
        arg.Length > 0 && arg.IndexOfAny(new[] { ' ', '\t', '"' }) < 0 ? arg : "\"" + arg.Replace("\"", "\\\"") + "\"";

    private const string RunasVerb = "runas";
    private const int ErrorCancelled = 1223;
    private const uint CreateBreakawayFromJob = 0x01000000;
    private const uint CreateNewProcessGroup = 0x00000200;
    private const uint ExtendedStartupInfoPresent = 0x00080000;
    private const uint ProcessCreateProcess = 0x0080;
    private static readonly IntPtr ProcThreadAttributeParentProcess = (IntPtr)0x00020000;

    [StructLayout(LayoutKind.Sequential)]
    private struct StartupInfoEx
    {
        public StartupInfo StartupInfo;
        public IntPtr lpAttributeList;
    }

    [DllImport("user32.dll")]
    private static extern IntPtr GetShellWindow();

    [DllImport("user32.dll")]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern IntPtr OpenProcess(uint access, bool inheritHandle, uint processId);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool InitializeProcThreadAttributeList(IntPtr attributeList, int attributeCount, int flags, ref IntPtr size);

    [DllImport("kernel32.dll", SetLastError = true)]
    private static extern bool UpdateProcThreadAttribute(IntPtr attributeList, uint flags, IntPtr attribute, IntPtr value, IntPtr size, IntPtr previousValue, IntPtr returnSize);

    [DllImport("kernel32.dll")]
    private static extern void DeleteProcThreadAttributeList(IntPtr attributeList);

    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Unicode, EntryPoint = "CreateProcessW")]
    private static extern bool CreateProcessEx(string applicationName, string commandLine, IntPtr processAttributes, IntPtr threadAttributes,
        bool inheritHandles, uint creationFlags, IntPtr environment, string currentDirectory, ref StartupInfoEx startupInfo, out ProcessInformation processInformation);

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
