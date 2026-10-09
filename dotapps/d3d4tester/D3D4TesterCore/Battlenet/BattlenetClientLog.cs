// PY-REF: none (DOT-only)
using System.IO;
using System.Text;
using System.Text.RegularExpressions;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>What the Battle.net client log reports that its UI tree does not show.</summary>
public enum BattlenetLogEventKind
{
    /// <summary>Login needs a web security check (Detail = challenge URL).</summary>
    SecurityChallenge,
    LoggedIn,
    /// <summary>Login failed (Detail = error, e.g. ERROR_LOGON_WEB_VERIFY_TIMEOUT (521)).</summary>
    LoginFailed,
    /// <summary>The oauth / sso token request was rejected: games launched now get no license.</summary>
    OauthRejected,
    /// <summary>A game exe was launched by the client (Detail = exe and args).</summary>
    GameLaunched,
}

public sealed record BattlenetLogEvent(BattlenetLogEventKind Kind, string Detail);

/// <summary>
/// Tail of the Battle.net client logs (%LocalAppData%\Battle.net\Logs\battle.net-*.log; each client start opens a new file). Reads only
/// lines written after <see cref="FromNow"/>, shared read so the client keeps writing.
/// </summary>
public sealed class BattlenetClientLog
{
    private const string LogFilePattern = "battle.net-*.log";
    private static readonly Regex ChallengeRegex = new(@"External Challenge URL: (\S+)", RegexOptions.Compiled);
    private static readonly Regex LoginFailedRegex = new(@"\[BNLogin\].*Login failed\. error=(.+)$", RegexOptions.Compiled);
    private static readonly Regex GameLaunchedRegex = new(@"\[InstallManager\].*Launched (.+)$", RegexOptions.Compiled);
    private const string LoggedInMarker = "Logged into Battle.net successfully";
    private const string OauthRejectedMarker = "Unexpected status code when requesting oauth token";

    private readonly Dictionary<string, long> _offsets = new(StringComparer.OrdinalIgnoreCase);
    private readonly DateTime _sinceUtc;

    private BattlenetClientLog(DateTime sinceUtc) => _sinceUtc = sinceUtc;

    public static string LogDirectory => Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "Battle.net", "Logs");

    /// <summary>Start reading at the current end of every existing log file.</summary>
    public static BattlenetClientLog FromNow()
    {
        var log = new BattlenetClientLog(DateTime.UtcNow);
        foreach (var file in LogFiles())
            log._offsets[file.FullName] = file.Length;
        return log;
    }

    /// <summary>Events from lines appended since the last read (new log files from a client restart included).</summary>
    public IReadOnlyList<BattlenetLogEvent> ReadNew()
    {
        var events = new List<BattlenetLogEvent>();
        foreach (var file in LogFiles().Where(f => f.LastWriteTimeUtc >= _sinceUtc).OrderBy(f => f.LastWriteTimeUtc))
        {
            foreach (var line in ReadAppendedLines(file))
            {
                if (Parse(line) is { } e) events.Add(e);
            }
        }
        return events;
    }

    private static BattlenetLogEvent? Parse(string line)
    {
        if (ChallengeRegex.Match(line) is { Success: true } c) return new(BattlenetLogEventKind.SecurityChallenge, c.Groups[1].Value);
        if (line.Contains(LoggedInMarker, StringComparison.Ordinal)) return new(BattlenetLogEventKind.LoggedIn, "");
        if (LoginFailedRegex.Match(line) is { Success: true } f) return new(BattlenetLogEventKind.LoginFailed, f.Groups[1].Value.Trim());
        if (line.Contains(OauthRejectedMarker, StringComparison.Ordinal)) return new(BattlenetLogEventKind.OauthRejected, line.Trim());
        if (GameLaunchedRegex.Match(line) is { Success: true } g) return new(BattlenetLogEventKind.GameLaunched, g.Groups[1].Value.Trim());
        return null;
    }

    private IEnumerable<string> ReadAppendedLines(FileInfo file)
    {
        long offset = _offsets.TryGetValue(file.FullName, out var o) ? o : 0;
        if (file.Length <= offset) return Array.Empty<string>();
        try
        {
            using var stream = new FileStream(file.FullName, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            stream.Seek(offset, SeekOrigin.Begin);
            using var reader = new StreamReader(stream, Encoding.UTF8);
            string text = reader.ReadToEnd();
            int lastNewline = text.LastIndexOf('\n');
            if (lastNewline < 0) return Array.Empty<string>();
            _offsets[file.FullName] = offset + Encoding.UTF8.GetByteCount(text.AsSpan(0, lastNewline + 1));
            return text[..lastNewline].Split('\n');
        }
        catch (IOException)
        {
            return Array.Empty<string>();
        }
    }

    private static IEnumerable<FileInfo> LogFiles()
    {
        var dir = new DirectoryInfo(LogDirectory);
        return dir.Exists ? dir.GetFiles(LogFilePattern) : Enumerable.Empty<FileInfo>();
    }
}
