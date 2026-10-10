// PY-REF: none (DOT-only)
using System.Globalization;
using System.IO;
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Core.Flow;

namespace DotApps.d3d4tester.Core.D4;

/// <summary>What one D4 run logged about its launch and the server license check.</summary>
public sealed record D4LicenseCheck(bool LaunchedWithSso, int? LicenseCount, bool NoValidLicense)
{
    public bool Licensed => !NoValidLicense && LicenseCount is > 0;
}

/// <summary>
/// D4 client debug log: FenrisDebug.txt in the install folder, written live (older runs rotate to _FenrisDebug-N.txt; line times are UTC).
/// After login the game asks the server for its content licenses: num_licenses 0 / ERROR_LOGON_NO_VALID_LICENSES_FOUND (315306) means
/// the logged-in account owns no D4 license, a server answer that no client-side step changes.
/// </summary>
public static class D4ClientLog
{
    private const string FileName = "FenrisDebug.txt";
    private const string CommandLineMarker = "[Game] Command Line:";
    private const string SsoArg = "-sso";
    private const string NoValidLicenseMarker = "ERROR_LOGON_NO_VALID_LICENSES_FOUND";
    private const string LineTimeFormat = "yyyy.MM.dd HH:mm:ss";
    private const int LineTimeOffset = 2;
    private const double PollSec = 2.0;
    private static readonly Regex LicenseCountRegex = new(@"num_licenses: (\d+)", RegexOptions.Compiled);
    private static readonly TimeSpan RunStartSlack = TimeSpan.FromSeconds(30);

    /// <summary>Poll the log of the run started after sinceUtc until the license answer shows; null when it does not within timeoutSec.</summary>
    public static D4LicenseCheck? WaitForLicenseCheck(string installDir, DateTime sinceUtc, FlowContext ctx, double timeoutSec)
    {
        var deadline = DateTime.UtcNow.AddSeconds(timeoutSec);
        D4LicenseCheck? last = null;
        while (DateTime.UtcNow < deadline)
        {
            last = Read(Path.Combine(installDir, FileName), sinceUtc) ?? last;
            if (last is { NoValidLicense: true } or { LicenseCount: not null }) return last;
            ctx.Wait(PollSec);
        }
        return last is { NoValidLicense: true } or { LicenseCount: not null } ? last : null;
    }

    private static D4LicenseCheck? Read(string path, DateTime sinceUtc)
    {
        string[] lines;
        try
        {
            using var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
            using var reader = new StreamReader(stream);
            lines = reader.ReadToEnd().Split('\n');
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return null;
        }
        if (lines.Length == 0 || RunStartUtc(lines[0]) is not { } start || start < sinceUtc - RunStartSlack) return null;
        bool sso = false, noLicense = false;
        int? count = null;
        foreach (var line in lines)
        {
            if (line.Contains(CommandLineMarker, StringComparison.Ordinal)) sso = line.Contains(SsoArg, StringComparison.Ordinal);
            if (line.Contains(NoValidLicenseMarker, StringComparison.Ordinal)) noLicense = true;
            if (LicenseCountRegex.Match(line) is { Success: true } m) count = int.Parse(m.Groups[1].Value, CultureInfo.InvariantCulture);
        }
        return new D4LicenseCheck(sso, count, noLicense);
    }

    private static DateTime? RunStartUtc(string firstLine) =>
        firstLine.Length >= LineTimeOffset + LineTimeFormat.Length
        && DateTime.TryParseExact(firstLine.AsSpan(LineTimeOffset, LineTimeFormat.Length), LineTimeFormat, CultureInfo.InvariantCulture,
            DateTimeStyles.AssumeUniversal | DateTimeStyles.AdjustToUniversal, out var t)
            ? t
            : null;
}
