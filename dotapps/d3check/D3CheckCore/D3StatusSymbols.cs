using DotCore.Common;

namespace DotApps.d3check.Core;

/// <summary>
/// D3-specific status formatting for bottom bar: Battle.net, D3, ROSBOT. Uses public lib StatusDisplaySymbols for symbols.
/// </summary>
public static class D3StatusSymbols
{
    public const string LabelBattleNet = "Battle.net";
    public const string LabelD3 = "D3";
    public const string LabelRosbot = "ROSBOT";

    /// <summary>Format for status item: "✓ Battle.net" or "○ Battle.net".</summary>
    public static string FormatStatus(bool found, string label) =>
        $"{(found ? StatusDisplaySymbols.Found : StatusDisplaySymbols.NotFound)} {label}";
}
