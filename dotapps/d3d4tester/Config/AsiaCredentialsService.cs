// PY-REF: dotapps/d3d4tester/reference/py_d3check/share/asia_credentials.py
using System.Text.Json;
using DotApps.d3d4tester.Constants;
using DotCore.Foundations;
using DotCore.Utils.Security;
using DotApps.d3d4tester.Core.Battlenet;

namespace DotApps.d3d4tester.Config;

/// <summary>
/// Battle.net Asia/CN credentials: read/write config with machine-bound encrypted password. 1:1 Python share.asia_credentials.
/// Config keys: battlenet_asia_credentials, battlenet_cn_credentials (top-level in d3check_config.json, same as Python).
/// Accounts are entered only on the Battle.net tab (BattlenetAccountService mirrors the active one here); missing credentials show that tab.
/// </summary>
public static class AsiaCredentialsService
{
    private static readonly object PromptLock = new();
    private static Action<string>? _promptPresenter;
    private static string? _promptRegion;

    private static string ConfigKeyForRegion(string region) =>
        region == BattlenetConstants.RegionCn ? ConfigKeys.BattlenetCnCredentials : ConfigKeys.BattlenetAsiaCredentials;

    private static readonly JsonSerializerOptions DeserializeOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase
    };

    /// <summary>Load CredentialsStored from config by key; explicit deserialize so we can DEBUG and avoid silent GetValue failure.</summary>
    private static CredentialsStored? LoadCredentialsStored(string keyPath)
    {
        string? rawJson = D3D4TesterConfigService.Instance.GetRawText(keyPath);
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            ColorPrinter.Gray($"[DEBUG][Credentials] LoadCredentialsStored key={keyPath} rawJson=null or empty");
            return null;
        }
        try
        {
            var stored = JsonSerializer.Deserialize<CredentialsStored>(rawJson, DeserializeOptions);
            ColorPrinter.Gray($"[DEBUG][Credentials] LoadCredentialsStored key={keyPath} deserialize ok emailLen={stored?.Email?.Length ?? 0}");
            return stored;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"[Credentials] LoadCredentialsStored key={keyPath} deserialize failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>Returns (email, password) for the given region; password decrypted. Null if missing or decrypt failed.</summary>
    public static (string email, string password)? GetCredentials(string region)
    {
        string key = ConfigKeyForRegion(region);
        ColorPrinter.Gray($"[DEBUG][Credentials] GetCredentials(region={region}) key={key} configPath={ConfigPaths.ConfigUserPath}");
        var raw = LoadCredentialsStored(key);
        if (raw == null)
        {
            ColorPrinter.Gray($"[DEBUG][Credentials] GetCredentials(region={region}) raw=null -> return null");
            return null;
        }
        string? email = (raw.Email ?? "").Trim();
        string? storedPassword = (raw.Password ?? "").Trim();
        if (string.IsNullOrEmpty(email) || string.IsNullOrEmpty(storedPassword))
        {
            ColorPrinter.Gray($"[Credentials] GetCredentials(region={region}) empty email or password.");
            ColorPrinter.Gray($"[DEBUG][Credentials] GetCredentials(region={region}) empty -> return null");
            return null;
        }

        string? password;
        if (PasswordCipher.IsLikelyCiphertext(storedPassword))
        {
            password = PasswordCipher.DecryptPassword(storedPassword);
            if (password == null)
            {
                ColorPrinter.Yellow($"[Credentials] Stored password decrypt failed (region={region}). Re-enter in dialog.");
                ColorPrinter.Gray($"[DEBUG][Credentials] GetCredentials(region={region}) decrypt failed -> return null");
                return null;
            }
        }
        else
            password = storedPassword;

        ColorPrinter.Gray($"[DEBUG][Credentials] GetCredentials(region={region}) success emailLen={email.Length}");
        return (email, password);
    }

    /// <summary>Save credentials for region; password is encrypted before storing. Writes to config and flushes to file (same as Python).</summary>
    public static void SaveCredentials(string region, string? email, string? password)
    {
        string key = ConfigKeyForRegion(region);
        string e = (email ?? "").Trim();
        string p = password ?? "";
        ColorPrinter.Gray($"[DEBUG][Credentials] SaveCredentials(region={region}) key={key} configPath={ConfigPaths.ConfigUserPath} emailLen={e.Length} passwordLen={p.Length}");
        string? cipher = PasswordCipher.EncryptPassword(p);
        string storedPassword = cipher ?? p;
        bool encrypted = cipher != null;
        ColorPrinter.Gray($"[Credentials] SaveCredentials encrypt={encrypted} storedLen={storedPassword?.Length ?? 0}");
        var entry = new CredentialsStored { Email = e, Password = storedPassword };
        var svc = D3D4TesterConfigService.Instance;
        svc.SetValueAsync(key, entry);
        svc.FlushPendingSave();
        ColorPrinter.Gray($"[DEBUG][Credentials] SaveCredentials(region={region}) written to config and file.");
    }

    /// <summary>Load credentials for region into (email, password) for UI; decrypts if ciphertext. 1:1 Python _load_credentials_into_vars.</summary>
    public static (string email, string password) LoadCredentialsForUi(string region)
    {
        string key = ConfigKeyForRegion(region);
        ColorPrinter.Gray($"[DEBUG][Credentials] LoadCredentialsForUi(region={region}) key={key} configPath={ConfigPaths.ConfigUserPath}");
        var raw = LoadCredentialsStored(key);
        string email = "";
        string password = "";
        if (raw != null)
        {
            email = (raw.Email ?? "").Trim();
            string? rawPwd = (raw.Password ?? "").Trim();
            if (!string.IsNullOrEmpty(rawPwd) && PasswordCipher.IsLikelyCiphertext(rawPwd))
            {
                password = PasswordCipher.DecryptPassword(rawPwd) ?? "";
                if (string.IsNullOrEmpty(password))
                    ColorPrinter.Yellow($"[Credentials] Could not decrypt stored password (region={region}). Re-enter.");
            }
            else
                password = rawPwd ?? "";
            ColorPrinter.Gray($"[DEBUG][Credentials] LoadCredentialsForUi(region={region}) emailLen={email.Length} passwordLen={password.Length}");
        }
        else
            ColorPrinter.Gray($"[DEBUG][Credentials] LoadCredentialsForUi(region={region}) raw=null -> empty fields");
        return (email, password);
    }

    /// <summary>UI presenter that shows the accounts of the Battle.net tab (the only place to enter credentials); set by MainWindow.</summary>
    public static void SetPromptPresenter(Action<string>? presenter)
    {
        lock (PromptLock) _promptPresenter = presenter;
    }

    /// <summary>True while the accounts were shown for a region that still has no saved credentials; flow ticks skip until they are saved.</summary>
    public static bool IsPromptPending
    {
        get
        {
            string? region;
            lock (PromptLock) region = _promptRegion;
            if (region == null) return false;
            if (!HasCredentials(region)) return true;
            lock (PromptLock)
                if (_promptRegion == region) _promptRegion = null;
            return false;
        }
    }

    /// <summary>Show the Battle.net accounts once per missing region (non-blocking); pending until credentials for it are saved.</summary>
    public static void ScheduleCredentialsPrompt(string region)
    {
        Action<string>? presenter;
        lock (PromptLock)
        {
            if (_promptRegion == region) return;
            presenter = _promptPresenter;
            if (presenter == null) return;
            _promptRegion = region;
        }
        ColorPrinter.Yellow($"[Credentials] no saved {region} account: showing Battle.net > region and accounts");
        presenter(region);
    }

    /// <summary>Email and password are stored for the region (no decrypt, no logging: polled by the flow).</summary>
    private static bool HasCredentials(string region)
    {
        string? rawJson = D3D4TesterConfigService.Instance.GetRawText(ConfigKeyForRegion(region));
        if (string.IsNullOrWhiteSpace(rawJson)) return false;
        try
        {
            var stored = JsonSerializer.Deserialize<CredentialsStored>(rawJson, DeserializeOptions);
            return !string.IsNullOrWhiteSpace(stored?.Email) && !string.IsNullOrWhiteSpace(stored?.Password);
        }
        catch (JsonException)
        {
            return false;
        }
    }
}
