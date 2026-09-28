using System.IO;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace DotApps.d3check.Services;

/// <summary>
/// BN UI 调试输出目录与智能命名：目录固定于代码内，同一 UI 内容复用同一文件名，不同内容新文件名，积累不删。
/// Per spec: Services/ for UI-related services (path/naming).
/// </summary>
public static class BnUiDebugPaths
{
    /// <summary>默认存放目录：绝对路径 D:\programing\core_node\dotapps\d3check\docs\uidocs。</summary>
    public static string GetBaseDirectory()
    {
        const string dir = @"D:\programing\core_node\dotapps\d3check\docs\uidocs";
        try
        {
            Directory.CreateDirectory(dir);
            return dir;
        }
        catch
        {
            string fallback = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "d3check", "bn_ui_debug");
            Directory.CreateDirectory(fallback);
            return fallback;
        }
    }

    /// <summary>根据当前 dump 内容解析写入路径：若与已有某文件内容一致则复用该路径；否则按“无中文则 EN—— + 特征”智能命名新文件。</summary>
    public static string ResolveTargetPath(string dump)
    {
        string baseDir = GetBaseDirectory();
        string signature = GetContentSignature(dump);

        foreach (string path in Directory.EnumerateFiles(baseDir, "*.txt"))
        {
            try
            {
                string existing = File.ReadAllText(path, Encoding.UTF8);
                if (existing == dump)
                    return path;
            }
            catch
            {
                /* skip */
            }
        }

        string baseName = GetSmartBaseName(dump);
        string fileName = SanitizeFileName(baseName) + "_" + signature + ".txt";
        return Path.Combine(baseDir, fileName);
    }

    private static string GetContentSignature(string dump)
    {
        byte[] hash = SHA256.HashData(Encoding.UTF8.GetBytes(dump));
        return Convert.ToHexString(hash).Substring(0, 8);
    }

    private static bool HasChinese(string s)
    {
        if (string.IsNullOrEmpty(s)) return false;
        foreach (char c in s)
        {
            if (c >= 0x4E00 && c <= 0x9FFF) return true;
            if (c >= 0x3400 && c <= 0x4DBF) return true;
        }
        return false;
    }

    private static string GetSmartBaseName(string dump)
    {
        Match m = Regex.Match(dump, @"Name=""([^""]+)""");
        string windowName = m.Success ? m.Groups[1].Value.Trim() : "";
        if (string.IsNullOrEmpty(windowName)) windowName = "BN_UI";
        if (!HasChinese(dump))
            return "EN——" + windowName;
        return windowName;
    }

    private static string SanitizeFileName(string name)
    {
        char[] invalid = Path.GetInvalidFileNameChars();
        var sb = new StringBuilder();
        foreach (char c in name)
        {
            if (c < 32 || Array.IndexOf(invalid, c) >= 0)
                sb.Append('_');
            else
                sb.Append(c);
        }
        string s = sb.ToString();
        return string.IsNullOrEmpty(s) ? "BN_UI" : s;
    }
}
