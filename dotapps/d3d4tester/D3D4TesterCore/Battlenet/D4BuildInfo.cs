// PY-REF: none (DOT-only)
using System.IO;
using DotCore.Foundations;
using DotCore.Utils;
using C = DotApps.d3d4tester.Core.Battlenet.BattlenetConstants;

namespace DotApps.d3d4tester.Core.Battlenet;

/// <summary>Installed D4 folder and the branch of its active build ("cn" = China build, anything else = international).</summary>
public sealed record D4BuildState(string InstallDir, string Branch)
{
    public bool IsCnBuild => string.Equals(Branch, C.D4BranchCn, StringComparison.OrdinalIgnoreCase);

    /// <summary>True when the build belongs to region (cn needs the China build, asia an international one).</summary>
    public bool MatchesRegion(string region) => IsCnBuild == (region == C.RegionCn);
}

/// <summary>
/// Read-only D4 build lookup. CN and international D4 are one Battle.net product (fenris) on different branches, so one folder holds
/// one branch at a time: the folder is the configured D4 install path, else the fenris install in the agent product.db; the branch
/// is the Active row of its .build.info. Null when D4 is not installed or the files are unreadable.
/// </summary>
public static class D4BuildInfo
{
    private const string LogTag = "[D4Build]";
    private const char ColumnSeparator = '|';
    private const char ColumnTypeSeparator = '!';
    private const string BranchColumn = "Branch";
    private const string ActiveColumn = "Active";
    private const string ActiveValue = "1";
    private const int WireLengthDelimited = 2;
    private const int DbProductInstallField = 1;
    private const int InstallProductCodeField = 2;
    private const int InstallSettingsField = 3;
    private const int SettingsInstallPathField = 1;

    public static D4BuildState? Read(string? configuredDir)
    {
        try
        {
            string? dir = HasBuildInfo(configuredDir) ? configuredDir : FindAgentInstallDir();
            if (!HasBuildInfo(dir)) return null;
            string? branch = ReadActiveBranch(Path.Combine(dir!, C.BuildInfoFileName));
            return branch == null ? null : new D4BuildState(dir!, branch);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{LogTag} D4 build info not readable: {ex.Message}");
            return null;
        }
    }

    private static bool HasBuildInfo(string? dir) =>
        !string.IsNullOrWhiteSpace(dir) && File.Exists(Path.Combine(dir, C.BuildInfoFileName));

    /// <summary>Install path of the fenris entry in %ProgramData%\Battle.net\Agent\product.db.</summary>
    private static string? FindAgentInstallDir()
    {
        string db = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), C.AgentDirName, C.AgentSubDirName, C.ProductDbFileName);
        if (!File.Exists(db)) return null;
        foreach (var install in ProtobufWire.Read(File.ReadAllBytes(db)).Where(f => f.Number == DbProductInstallField && f.WireType == WireLengthDelimited))
        {
            var fields = ProtobufWire.Read(install.Bytes);
            if (!fields.Any(f => f.Number == InstallProductCodeField && f.AsString() == C.D4ProductCode)) continue;
            var settings = fields.FirstOrDefault(f => f.Number == InstallSettingsField);
            string? path = ProtobufWire.Read(settings.Bytes).FirstOrDefault(f => f.Number == SettingsInstallPathField).Bytes is { Length: > 0 } p
                ? System.Text.Encoding.UTF8.GetString(p.Span) : null;
            if (path != null) return Path.GetFullPath(path);
        }
        return null;
    }

    /// <summary>Branch of the row whose Active column is 1 (header "Branch!STRING:0|Active!DEC:1|...").</summary>
    private static string? ReadActiveBranch(string buildInfoPath)
    {
        var lines = File.ReadAllLines(buildInfoPath).Where(l => l.Length > 0).ToList();
        if (lines.Count < 2) return null;
        var header = lines[0].Split(ColumnSeparator).Select(h => h.Split(ColumnTypeSeparator)[0]).ToList();
        int branch = header.IndexOf(BranchColumn), active = header.IndexOf(ActiveColumn);
        if (branch < 0) return null;
        var rows = lines.Skip(1).Select(l => l.Split(ColumnSeparator)).Where(r => r.Length > branch).ToList();
        var row = rows.FirstOrDefault(r => active >= 0 && r.Length > active && r[active] == ActiveValue) ?? rows.FirstOrDefault();
        return row?[branch].Trim() is { Length: > 0 } value ? value : null;
    }
}
