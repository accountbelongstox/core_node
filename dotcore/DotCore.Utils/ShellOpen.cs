using System.ComponentModel;
using System.Diagnostics;
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
        var psi = new ProcessStartInfo(exe)
        {
            UseShellExecute = OperatingSystem.IsWindows() && args.Length == 0,
            WorkingDirectory = Path.GetDirectoryName(exe) ?? ""
        };
        foreach (var a in args) psi.ArgumentList.Add(a);
        return Start(psi, exe);
    }

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
