// PY-REF: none (DOT-only)
using System.Diagnostics;
using System.Globalization;

namespace DotCore.YoloTrain;

/// <summary>Owner of a runs-dir lock: process id, start time and the job description.</summary>
public sealed record YoloRunLockInfo(int ProcessId, DateTime StartedUtc, string Description);

/// <summary>
/// {runsDir}/.lock held open exclusively (FileShare.Read) while a training job uses the runs dir, so a second app instance does not
/// start a concurrent run there. A crashed owner releases it automatically (the OS closes the handle); the stale file is reused.
/// </summary>
public sealed class YoloRunLock : IDisposable
{
    public const string FileName = ".lock";

    private readonly FileStream _stream;

    private YoloRunLock(string path, FileStream stream, YoloRunLockInfo info)
    {
        Path = path;
        _stream = stream;
        Info = info;
    }

    public string Path { get; }

    public YoloRunLockInfo Info { get; }

    public static string PathFor(string runsDir) => System.IO.Path.Combine(runsDir, FileName);

    /// <summary>Acquires the lock, or returns null with the live owner (when readable) in `owner`.</summary>
    public static YoloRunLock? TryAcquire(string runsDir, string description, out YoloRunLockInfo? owner)
    {
        owner = null;
        Directory.CreateDirectory(runsDir);
        var path = PathFor(runsDir);
        FileStream stream;
        try
        {
            stream = new FileStream(path, FileMode.OpenOrCreate, FileAccess.ReadWrite, FileShare.Read);
        }
        catch (IOException)
        {
            owner = ReadOwner(runsDir);
            return null;
        }
        var info = new YoloRunLockInfo(Environment.ProcessId, DateTime.UtcNow, description);
        stream.SetLength(0);
        using (var writer = new StreamWriter(stream, leaveOpen: true))
            writer.Write(string.Join("\n", info.ProcessId.ToString(CultureInfo.InvariantCulture), info.StartedUtc.ToString("o", CultureInfo.InvariantCulture), description) + "\n");
        stream.Flush(true);
        return new YoloRunLock(path, stream, info);
    }

    /// <summary>Owner of a held lock, or null when the runs dir is free (missing file, released or owner process gone).</summary>
    public static YoloRunLockInfo? ReadOwner(string runsDir)
    {
        var path = PathFor(runsDir);
        if (!File.Exists(path)) return null;
        try
        {
            using var probe = new FileStream(path, FileMode.Open, FileAccess.ReadWrite, FileShare.Read);
            return null;
        }
        catch (IOException) { }
        try
        {
            using var read = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
            using var reader = new StreamReader(read);
            var lines = reader.ReadToEnd().Split('\n');
            if (lines.Length < 2 || !int.TryParse(lines[0], out var pid)) return new YoloRunLockInfo(0, DateTime.MinValue, "");
            DateTime.TryParse(lines[1], CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var started);
            if (!IsAlive(pid)) return null;
            return new YoloRunLockInfo(pid, started, lines.Length > 2 ? lines[2].Trim() : "");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return new YoloRunLockInfo(0, DateTime.MinValue, "");
        }
    }

    public void Dispose()
    {
        _stream.Dispose();
        try { File.Delete(Path); } catch (Exception ex) when (ex is IOException or UnauthorizedAccessException) { }
    }

    private static bool IsAlive(int pid)
    {
        try
        {
            using var p = Process.GetProcessById(pid);
            return !p.HasExited;
        }
        catch (Exception ex) when (ex is ArgumentException or InvalidOperationException or System.ComponentModel.Win32Exception)
        {
            return false;
        }
    }
}
