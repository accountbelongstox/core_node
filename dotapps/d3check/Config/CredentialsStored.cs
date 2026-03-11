using System.Text.Json.Serialization;

namespace DotApps.d3check.Config;

/// <summary>Config storage format for Battle.net credentials. 1:1 Python: battlenet_asia_credentials / battlenet_cn_credentials object with email, password.</summary>
public class CredentialsStored
{
    [JsonPropertyName("email")]
    public string? Email { get; set; }

    [JsonPropertyName("password")]
    public string? Password { get; set; }
}
