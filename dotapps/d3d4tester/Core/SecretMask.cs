namespace DotApps.d3d4tester.Core;

/// <summary>Masks secrets (account emails, ROSBOT keys) for logs and lists: first and last visibleChars kept, the middle replaced.</summary>
public static class SecretMask
{
    public const string Fill = "****";

    public static string Mask(string? text, int visibleChars)
    {
        var s = text ?? "";
        return s.Length <= visibleChars * 2 ? Fill : s[..visibleChars] + Fill + s[^visibleChars..];
    }

    /// <summary>Only the first prefixChars kept, the rest replaced.</summary>
    public static string Prefix(string? text, int prefixChars)
    {
        var s = text ?? "";
        return s.Length <= prefixChars ? Fill : s[..prefixChars] + Fill;
    }
}
