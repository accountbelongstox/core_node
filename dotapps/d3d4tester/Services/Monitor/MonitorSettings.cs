// PY-REF: none (DOT-only)
using System.IO;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Monitor;
using DotCore.Utils.Security;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>Typed reads of monitor.* config (live values via ConfigBinding), secrets stored with <see cref="PasswordCipher"/>.</summary>
public static class MonitorSettings
{
    private const string ScreenshotsDirName = "screenshots";
    public const int D3MemoryLimitMbDefault = 8192;
    public const int D3ShrinkWidthDefault = 1072;
    public const int D3ShrinkHeightDefault = 603;
    public const int D3ShrinkMinWidth = 1070;
    public const int D3ShrinkMinHeight = 600;
    public const int PeriodicMinutesDefault = 1;
    public const int FightThresholdDefault = 280;
    public const int TownPortalThresholdDefault = 10;
    public static readonly int[] UrshiDefaults = { 100, 6, 140 };
    public static readonly int[] FinishIllusionDefaults = { 100, 25 };
    public static readonly int[] FindIllusionDefaults = { 60, 1, 2 };
    public static readonly string UrshiDefault = string.Join(ThresholdSeparator, UrshiDefaults);
    public static readonly string FinishIllusionDefault = string.Join(ThresholdSeparator, FinishIllusionDefaults);
    public static readonly string FindIllusionDefault = string.Join(ThresholdSeparator, FindIllusionDefaults);
    private const string ThresholdSeparator = ",";
    public const string CropDefault = "0,0,0,0";

    public static bool GetBool(string key, bool defaultValue = false) => ConfigBinding.GetValue(key, defaultValue);

    public static int GetInt(string key, int defaultValue) => ConfigBinding.GetIntValue(key, int.MinValue, int.MaxValue, defaultValue);

    /// <summary>Non-negative int from a trigger argument; invalid -> defaultValue.</summary>
    public static int ParseArg(string? text, int defaultValue = 0) => ConfigBinding.ParseInt(text, 0, int.MaxValue, defaultValue);

    public static string GetString(string key, string defaultValue = "") => ConfigBinding.GetValue(key, defaultValue) ?? defaultValue;

    /// <summary>Secret config value, decrypted when stored as cipher text.</summary>
    public static string GetSecret(string key)
    {
        string raw = GetString(key);
        return PasswordCipher.IsLikelyCiphertext(raw) ? PasswordCipher.DecryptPassword(raw) ?? "" : raw;
    }

    public static void SetSecret(string key, string? plain) =>
        ConfigBinding.SetValue(key, string.IsNullOrEmpty(plain) ? "" : PasswordCipher.EncryptPassword(plain) ?? "");

    public static bool ScreenshotEnabled(string kind) =>
        GetBool(ConfigKeys.MonitorScreenshotKey(kind, ConfigKeys.MonitorScreenshotEnabledSuffix));

    public static int ScreenshotKeep(string kind) =>
        Math.Max(0, GetInt(ConfigKeys.MonitorScreenshotKey(kind, ConfigKeys.MonitorScreenshotKeepSuffix), 0));

    /// <summary>Configured folder for kind, else &lt;user data&gt;/screenshots/&lt;kind&gt;.</summary>
    public static string ScreenshotDir(string kind)
    {
        string dir = GetString(ConfigKeys.MonitorScreenshotKey(kind, ConfigKeys.MonitorScreenshotDirSuffix)).Trim();
        return string.IsNullOrEmpty(dir) ? DefaultScreenshotDir(kind) : dir;
    }

    public static string DefaultScreenshotDir(string kind) => Path.Combine(ConfigPaths.CurrentUserDataPath, ScreenshotsDirName, kind);

    public static string LogTimeoutMode => GetString(ConfigKeys.MonitorLogTimeoutMode, MonitorLogTimeoutModes.LogOnly);
}
