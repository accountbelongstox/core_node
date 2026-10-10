using System.Text.RegularExpressions;

namespace DotCore.Utils.Text;

/// <summary>
/// Typo-tolerant text matching for OCR output: <see cref="Normalize"/> keeps letters, digits and CJK characters (regex, lower case),
/// <see cref="Similarity"/> is the longest-common-subsequence ratio 2 * LCS / (len a + len b) of the normalized texts, so a read with
/// a wrong or missing character still scores high ("冲心参" vs "冲心拳" = 0.67, "百裂" vs "百裂拳" = 0.8). <see cref="Best"/> picks the
/// candidate most similar to any of several names (e.g. a Chinese and an English name).
/// </summary>
public static class FuzzyText
{
    /// <summary>Default minimum similarity for an OCR read to count as a name.</summary>
    public const double DefaultMinSimilarity = 0.6;

    private static readonly Regex Noise = new(@"[^\p{L}\p{Nd}]+", RegexOptions.Compiled | RegexOptions.CultureInvariant);

    public static string Normalize(string? text) => Noise.Replace(text ?? "", "").ToLowerInvariant();

    /// <summary>Length of the longest common subsequence (characters in order, gaps allowed).</summary>
    public static int Lcs(string a, string b)
    {
        if (a.Length == 0 || b.Length == 0) return 0;
        var prev = new int[b.Length + 1];
        var curr = new int[b.Length + 1];
        for (int i = 1; i <= a.Length; i++)
        {
            for (int j = 1; j <= b.Length; j++)
                curr[j] = a[i - 1] == b[j - 1] ? prev[j - 1] + 1 : Math.Max(prev[j], curr[j - 1]);
            (prev, curr) = (curr, prev);
        }
        return prev[b.Length];
    }

    /// <summary>2 * LCS / (len a + len b) of the normalized texts, 0..1 (0 when either is empty).</summary>
    public static double Similarity(string? a, string? b)
    {
        string na = Normalize(a), nb = Normalize(b);
        return na.Length == 0 || nb.Length == 0 ? 0 : 2.0 * Lcs(na, nb) / (na.Length + nb.Length);
    }

    /// <summary>Best candidate by its highest similarity to any of the names; null when none reaches minSimilarity.</summary>
    public static (T Item, double Score)? Best<T>(IEnumerable<T> candidates, Func<T, string> text, IReadOnlyCollection<string> names,
        double minSimilarity = DefaultMinSimilarity)
    {
        (T Item, double Score)? best = null;
        foreach (var c in candidates)
        {
            string t = text(c);
            double score = names.Count == 0 ? 0 : names.Max(n => Similarity(t, n));
            if (score >= minSimilarity && (best == null || score > best.Value.Score)) best = (c, score);
        }
        return best;
    }
}
