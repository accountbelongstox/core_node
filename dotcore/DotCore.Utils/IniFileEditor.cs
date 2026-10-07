// PY-REF: none (DOT-only)
using System.Text;

namespace DotCore.Utils;

public enum IniSetResult
{
    Unchanged,
    Replaced,
    Inserted,
    FileMissing,
    NoAnchor,
}

/// <summary>
/// Line-level INI edit that keeps the file as its owner wrote it: encoding (UTF-8 with / without BOM, UTF-16, other single-byte
/// text round-tripped as Latin-1), line endings, comments and order. SetValue replaces the value of the first existing key, or
/// inserts the key at the end of the first section that holds one of the anchor keys; it never invents a section or a file.
/// </summary>
public static class IniFileEditor
{
    private static readonly byte[] Utf8Bom = { 0xEF, 0xBB, 0xBF };
    private static readonly byte[] Utf16LeBom = { 0xFF, 0xFE };
    private static readonly byte[] Utf16BeBom = { 0xFE, 0xFF };
    private const char CarriageReturn = '\r';
    private const char LineFeed = '\n';
    private const char Assign = '=';
    private const char SectionStart = '[';
    private const char SectionEnd = ']';
    private static readonly char[] CommentStarts = { ';', '#' };

    public static IniSetResult SetValue(string path, string key, string value, IReadOnlyCollection<string> anchorKeys)
    {
        if (!File.Exists(path)) return IniSetResult.FileMissing;
        byte[] bytes = File.ReadAllBytes(path);
        var (encoding, preamble) = DetectEncoding(bytes);
        string text = encoding.GetString(bytes, preamble.Length, bytes.Length - preamble.Length);
        var lines = text.Split(LineFeed).ToList();
        bool crlf = text.Contains("\r\n", StringComparison.Ordinal);

        int anchor = -1;
        for (int i = 0; i < lines.Count; i++)
        {
            if (TryKey(lines[i], out string name, out int eq) is false) continue;
            if (string.Equals(name, key, StringComparison.OrdinalIgnoreCase))
            {
                string body = lines[i].TrimEnd(CarriageReturn);
                if (body[(eq + 1)..].Trim() == value) return IniSetResult.Unchanged;
                lines[i] = body[..(eq + 1)] + LeadingSpace(body, eq) + value + (lines[i].EndsWith(CarriageReturn) ? CarriageReturn.ToString() : "");
                Write(path, encoding, preamble, lines);
                return IniSetResult.Replaced;
            }
            if (anchor < 0 && anchorKeys.Contains(name, StringComparer.OrdinalIgnoreCase)) anchor = i;
        }
        if (anchor < 0) return IniSetResult.NoAnchor;

        int insertAt = anchor + 1;
        for (int i = anchor + 1; i < lines.Count && !IsSection(lines[i]); i++)
            if (lines[i].Trim().Length > 0) insertAt = i + 1;
        TryKey(lines[anchor], out string anchorName, out int anchorEq);
        string anchorBody = lines[anchor].TrimEnd(CarriageReturn);
        int nameStart = anchorBody.IndexOf(anchorName, StringComparison.Ordinal);
        string separator = anchorBody[(nameStart + anchorName.Length)..(anchorEq + 1)] + LeadingSpace(anchorBody, anchorEq);
        string newLine = anchorBody[..nameStart] + key + separator + value + (crlf ? CarriageReturn.ToString() : "");
        if (insertAt == lines.Count && lines[^1].Length == 0) insertAt = lines.Count - 1;
        lines.Insert(insertAt, newLine);
        Write(path, encoding, preamble, lines);
        return IniSetResult.Inserted;
    }

    private static bool TryKey(string line, out string name, out int eq)
    {
        name = "";
        eq = -1;
        string trimmed = line.Trim();
        if (trimmed.Length == 0 || CommentStarts.Contains(trimmed[0]) || IsSection(line)) return false;
        eq = line.IndexOf(Assign);
        if (eq <= 0) return false;
        name = line[..eq].Trim();
        return name.Length > 0;
    }

    private static bool IsSection(string line)
    {
        string trimmed = line.Trim();
        return trimmed.Length > 1 && trimmed[0] == SectionStart && trimmed[^1] == SectionEnd;
    }

    private static string LeadingSpace(string body, int eq)
    {
        int i = eq + 1;
        while (i < body.Length && body[i] == ' ') i++;
        return body[(eq + 1)..i];
    }

    private static (Encoding Encoding, byte[] Preamble) DetectEncoding(byte[] bytes)
    {
        if (StartsWith(bytes, Utf8Bom)) return (new UTF8Encoding(false), Utf8Bom);
        if (StartsWith(bytes, Utf16LeBom)) return (new UnicodeEncoding(false, false), Utf16LeBom);
        if (StartsWith(bytes, Utf16BeBom)) return (new UnicodeEncoding(true, false), Utf16BeBom);
        var strictUtf8 = new UTF8Encoding(false, true);
        try
        {
            strictUtf8.GetString(bytes);
            return (strictUtf8, Array.Empty<byte>());
        }
        catch (DecoderFallbackException)
        {
            return (Encoding.Latin1, Array.Empty<byte>());
        }
    }

    private static bool StartsWith(byte[] bytes, byte[] prefix) => bytes.Length >= prefix.Length && bytes.AsSpan(0, prefix.Length).SequenceEqual(prefix);

    private static void Write(string path, Encoding encoding, byte[] preamble, List<string> lines)
    {
        byte[] body = encoding.GetBytes(string.Join(LineFeed, lines));
        string temp = path + ".tmp";
        using (var stream = new FileStream(temp, FileMode.Create, FileAccess.Write))
        {
            stream.Write(preamble);
            stream.Write(body);
        }
        File.Move(temp, path, true);
    }
}
