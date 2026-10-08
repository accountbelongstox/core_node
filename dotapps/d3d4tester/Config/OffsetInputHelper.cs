// PY-REF: pyapps/d3-check/ui/utils/offset_input.py
using System.Text.RegularExpressions;
using DotApps.d3d4tester.Constants;

namespace DotApps.d3d4tester.Config;

/// <summary>
/// Parse and format four offset values (top, left, bottom, right). Any non-numeric run is one separator.
/// 1:1 Python ui/utils/offset_input.py OffsetInputHelper.
/// </summary>
public sealed class OffsetInputHelper
{
    private static readonly Regex NumberRegex = new(@"-?\d+", RegexOptions.Compiled);

    public static OffsetInputHelper BagOffset { get; } = new(AppConstants.BagOffsetMin, AppConstants.BagOffsetMax);

    private readonly int _minVal;
    private readonly int _maxVal;

    public OffsetInputHelper(int minVal, int maxVal)
    {
        _minVal = minVal;
        _maxVal = maxVal;
    }

    public (int Top, int Left, int Bottom, int Right) Parse(string? raw)
    {
        var matches = NumberRegex.Matches((raw ?? "").Trim());
        var output = new int[4];
        for (int i = 0; i < 4; i++)
        {
            int v = 0;
            if (i < matches.Count && !int.TryParse(matches[i].Value, out v))
                v = matches[i].Value.StartsWith('-') ? int.MinValue : int.MaxValue;
            output[i] = Math.Max(_minVal, Math.Min(_maxVal, v));
        }
        return (output[0], output[1], output[2], output[3]);
    }

    public static string Format(int top, int left, int bottom, int right) => $"{top},{left},{bottom},{right}";
}
