using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace DotCore.Utils.Security;

/// <summary>
/// Machine-bound password encryption/decryption. Fernet-compatible with Python pycore.pyutils.security.password_cipher.
/// Payload is VERIFY_PREFIX + plaintext; encrypt returns base64url token; decrypt strips prefix and returns plaintext.
/// </summary>
public static class PasswordCipher
{
    public const string VerifyPrefix = "VX";
    public const string CipherStoragePrefix = "ENC:";

    private const byte FernetVersion = 0x80;
    private const int IvLength = 16;
    private const int HmacLength = 32;
    private const int TimestampLength = 8;
    private const int MinB64Length = 76;

    /// <summary>Encrypt plaintext with machine-bound key; prepend VERIFY_PREFIX. Returns base64url token or null on failure.</summary>
    public static string? EncryptPassword(string? plain)
    {
        if (plain == null) return null;
        try
        {
            byte[] keyBytes = GetFernetKeyBytes();
            byte[] signingKey = keyBytes.AsSpan(0, 16).ToArray();
            byte[] encryptionKey = keyBytes.AsSpan(16, 16).ToArray();

            long timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
            byte[] payload = Encoding.UTF8.GetBytes(VerifyPrefix + plain);
            byte[] padded = PadPkcs7(payload, 16);
            byte[] iv = new byte[IvLength];
            RandomNumberGenerator.Fill(iv);

            using var aes = Aes.Create();
            aes.Key = encryptionKey;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            using var enc = aes.CreateEncryptor();
            byte[] ciphertext = enc.TransformFinalBlock(padded, 0, padded.Length);

            byte[] toHmac = new byte[1 + TimestampLength + IvLength + ciphertext.Length];
            toHmac[0] = FernetVersion;
            for (int i = 0; i < 8; i++) toHmac[1 + i] = (byte)((timestamp >> (56 - i * 8)) & 0xff);
            iv.CopyTo(toHmac, 9);
            ciphertext.CopyTo(toHmac, 9 + IvLength);

            byte[] hmac;
            using (var h = new HMACSHA256(signingKey))
                hmac = h.ComputeHash(toHmac);

            byte[] token = new byte[toHmac.Length + HmacLength];
            toHmac.CopyTo(token, 0);
            hmac.CopyTo(token, toHmac.Length);
            return Base64UrlEncode(token);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Decrypt ciphertext (base64url). If first two bytes of plaintext are VERIFY_PREFIX, return the rest; else null.</summary>
    public static string? DecryptPassword(string? cipherB64)
    {
        if (string.IsNullOrWhiteSpace(cipherB64)) return null;
        cipherB64 = cipherB64.Trim();
        if (cipherB64.StartsWith(CipherStoragePrefix, StringComparison.Ordinal))
            cipherB64 = cipherB64.Substring(CipherStoragePrefix.Length).Trim();
        if (string.IsNullOrEmpty(cipherB64)) return null;
        try
        {
            byte[]? token = Base64UrlDecode(cipherB64);
            if (token == null || token.Length < 1 + TimestampLength + IvLength + HmacLength) return null;
            if (token[0] != FernetVersion) return null;

            byte[] keyBytes = GetFernetKeyBytes();
            byte[] signingKey = keyBytes.AsSpan(0, 16).ToArray();
            byte[] encryptionKey = keyBytes.AsSpan(16, 16).ToArray();

            int cipherLen = token.Length - 1 - TimestampLength - IvLength - HmacLength;
            if (cipherLen < 0 || cipherLen % 16 != 0) return null;

            byte[] toHmac = token.AsSpan(0, token.Length - HmacLength).ToArray();
            byte[] storedHmac = token.AsSpan(token.Length - HmacLength, HmacLength).ToArray();
            using (var h = new HMACSHA256(signingKey))
            {
                byte[] computed = h.ComputeHash(toHmac);
                if (!CryptographicOperations.FixedTimeEquals(computed, storedHmac)) return null;
            }

            byte[] iv = token.AsSpan(9, IvLength).ToArray();
            byte[] ciphertext = token.AsSpan(9 + IvLength, cipherLen).ToArray();
            using var aes = Aes.Create();
            aes.Key = encryptionKey;
            aes.IV = iv;
            aes.Mode = CipherMode.CBC;
            using var dec = aes.CreateDecryptor();
            byte[] padded = dec.TransformFinalBlock(ciphertext, 0, ciphertext.Length);
            byte[]? plain = UnpadPkcs7(padded);
            if (plain == null) return null;
            string s = Encoding.UTF8.GetString(plain);
            if (!s.StartsWith(VerifyPrefix, StringComparison.Ordinal)) return null;
            return s.Substring(VerifyPrefix.Length);
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Heuristic: true if string looks like Fernet ciphertext. 1:1 Python is_likely_ciphertext.</summary>
    public static bool IsLikelyCiphertext(string? s)
    {
        if (string.IsNullOrWhiteSpace(s)) return false;
        s = s.Trim();
        string rest = s.StartsWith(CipherStoragePrefix, StringComparison.Ordinal) ? s.Substring(CipherStoragePrefix.Length).Trim() : s;
        if (string.IsNullOrEmpty(rest)) return false;
        if (!Regex.IsMatch(rest, @"^[A-Za-z0-9_-]+=*$")) return false;
        if (rest.Length < MinB64Length) return false;
        try
        {
            byte[]? raw = Base64UrlDecode(rest);
            if (raw == null || raw.Length < 57) return false;
            return raw[0] == FernetVersion;
        }
        catch { return false; }
    }

    private static byte[] GetFernetKeyBytes()
    {
        string mid = MachineIdProvider.GetMachineId();
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(mid));
        return hash;
    }

    private static byte[] PadPkcs7(byte[] data, int blockSize)
    {
        int pad = blockSize - (data.Length % blockSize);
        var result = new byte[data.Length + pad];
        data.CopyTo(result, 0);
        for (int i = data.Length; i < result.Length; i++) result[i] = (byte)pad;
        return result;
    }

    private static byte[]? UnpadPkcs7(byte[] data)
    {
        if (data.Length == 0) return null;
        int pad = data[^1];
        if (pad <= 0 || pad > 16) return null;
        for (int i = data.Length - pad; i < data.Length; i++)
            if (data[i] != pad) return null;
        return data.AsSpan(0, data.Length - pad).ToArray();
    }

    private static string Base64UrlEncode(byte[] data)
    {
        return Convert.ToBase64String(data).TrimEnd('=').Replace('+', '-').Replace('/', '_');
    }

    private static byte[]? Base64UrlDecode(string s)
    {
        s = s.Replace('-', '+').Replace('_', '/');
        switch (s.Length % 4) { case 2: s += "=="; break; case 3: s += "="; break; }
        try { return Convert.FromBase64String(s); }
        catch { return null; }
    }
}
