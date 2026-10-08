// PY-REF: none (DOT-only)
using System.Text.Json;
using System.Text.Json.Serialization;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotCore.Foundations;
using DotCore.Utils.Security;

namespace DotApps.d3d4tester.Config;

/// <summary>One saved Battle.net account (password stays encrypted in config; never exposed here).</summary>
public sealed record BattlenetAccount(string Label, string Email, bool IsActive);

/// <summary>
/// Saved Battle.net accounts per region (battlenet_accounts.cn / .asia in the user config, passwords encrypted with PasswordCipher).
/// The active account is mirrored into the existing per-region credentials (AsiaCredentialsService, shared with Python), which
/// the login flow and the web login automation read. The current credentials are adopted into the list on first use.
/// </summary>
public static class BattlenetAccountService
{
    private const string LogTag = "[BNAccounts]";

    private sealed class StoredAccount
    {
        [JsonPropertyName("label")] public string Label { get; set; } = "";
        [JsonPropertyName("email")] public string Email { get; set; } = "";
        [JsonPropertyName("password")] public string Password { get; set; } = "";
    }

    private static string KeyFor(string region) => $"{ConfigKeys.BattlenetAccounts}.{region}";

    /// <summary>Accounts of a region; the active one is flagged.</summary>
    public static IReadOnlyList<BattlenetAccount> List(string region)
    {
        var stored = Load(region);
        string active = ActiveEmail(region);
        if (active.Length > 0 && stored.All(a => !SameEmail(a.Email, active)))
        {
            var (email, password) = AsiaCredentialsService.LoadCredentialsForUi(region);
            stored.Add(new StoredAccount { Label = email, Email = email, Password = PasswordCipher.EncryptPassword(password) ?? password });
            Save(region, stored);
        }
        return stored.Select(a => new BattlenetAccount(string.IsNullOrWhiteSpace(a.Label) ? a.Email : a.Label, a.Email, SameEmail(a.Email, active))).ToList();
    }

    /// <summary>Add or update by email; updating the active account also updates the active credentials.</summary>
    public static void Upsert(string region, string label, string email, string password)
    {
        email = email.Trim();
        if (email.Length == 0 || password.Length == 0) return;
        var stored = Load(region);
        var entry = stored.FirstOrDefault(a => SameEmail(a.Email, email));
        if (entry == null)
        {
            entry = new StoredAccount { Email = email };
            stored.Add(entry);
        }
        entry.Label = string.IsNullOrWhiteSpace(label) ? email : label.Trim();
        entry.Password = PasswordCipher.EncryptPassword(password) ?? password;
        Save(region, stored);
        if (SameEmail(ActiveEmail(region), email) || ActiveEmail(region).Length == 0)
            AsiaCredentialsService.SaveCredentials(region, email, password);
        ColorPrinter.Blue($"{LogTag} saved {region} account {Mask(email)}");
    }

    /// <summary>Remove by email. Removing the active account activates the first remaining one, else clears the region credentials (so List does not re-add it).</summary>
    public static void Remove(string region, string email)
    {
        bool wasActive = SameEmail(ActiveEmail(region), email);
        var stored = Load(region);
        stored.RemoveAll(a => SameEmail(a.Email, email));
        Save(region, stored);
        ColorPrinter.Blue($"{LogTag} removed {region} account {Mask(email)}");
        if (!wasActive) return;
        if (stored.Count > 0 && Activate(region, stored[0].Email)) return;
        AsiaCredentialsService.SaveCredentials(region, "", "");
        ColorPrinter.Blue($"{LogTag} {region} credentials cleared (active account removed)");
    }

    /// <summary>Make an account active (credentials used by the login flow). False when unknown or its password cannot be decrypted.</summary>
    public static bool Activate(string region, string email)
    {
        var entry = Load(region).FirstOrDefault(a => SameEmail(a.Email, email));
        if (entry == null) return false;
        string? password = PasswordCipher.IsLikelyCiphertext(entry.Password) ? PasswordCipher.DecryptPassword(entry.Password) : entry.Password;
        if (string.IsNullOrEmpty(password))
        {
            ColorPrinter.Yellow($"{LogTag} cannot decrypt the password of {Mask(email)}; edit the account again");
            return false;
        }
        AsiaCredentialsService.SaveCredentials(region, entry.Email, password);
        ColorPrinter.Blue($"{LogTag} active {region} account -> {Mask(email)}");
        return true;
    }

    public static string ActiveEmail(string region) => AsiaCredentialsService.LoadCredentialsForUi(region).email?.Trim() ?? "";

    private static List<StoredAccount> Load(string region)
    {
        string? raw = D3D4TesterConfigService.Instance.GetRawText(KeyFor(region));
        if (string.IsNullOrWhiteSpace(raw)) return new List<StoredAccount>();
        try
        {
            return JsonSerializer.Deserialize<List<StoredAccount>>(raw) ?? new List<StoredAccount>();
        }
        catch (JsonException ex)
        {
            ColorPrinter.Yellow($"{LogTag} {KeyFor(region)} unreadable: {ex.Message}");
            return new List<StoredAccount>();
        }
    }

    private static void Save(string region, List<StoredAccount> accounts) =>
        D3D4TesterConfigService.Instance.SetValueAsync(KeyFor(region), accounts);

    private static bool SameEmail(string a, string b) => string.Equals(a.Trim(), b.Trim(), StringComparison.OrdinalIgnoreCase);

    private const int MaskVisibleChars = 2;

    private static string Mask(string email) => SecretMask.Mask(email, MaskVisibleChars);
}
