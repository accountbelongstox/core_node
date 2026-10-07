// PY-REF: none (DOT-only)
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Core.Planner;

namespace DotApps.d3d4tester.Components;

/// <summary>How a paper-doll cell compares with the other side.</summary>
public enum DollCellState
{
    Empty,
    Neutral,
    Match,
    Mismatch,
}

/// <summary>One paper-doll cell: slot label, item text (name + rank), tooltip (affixes) and state.</summary>
public sealed record DollCell(string Slot, string Item, string Tooltip, DollCellState State);

/// <summary>
/// D3 character-screen grid (D3PaperDollLayout): one small card per slot, colored by state (match = success, mismatch = warning,
/// empty = inset). Show() replaces all cells; slots without a cell are drawn empty with their label.
/// </summary>
public sealed class D3PaperDoll : UserControl
{
    private const double CellHeight = 38;
    private const double CellCornerRadius = 4;
    private static readonly Thickness CellMargin = new(1.5);
    private static readonly Thickness CellPadding = new(4, 1, 4, 1);
    private const string BrushSuccess = "SuccessBrush";
    private const string BrushSuccessSubtle = "SuccessSubtleBrush";
    private const string BrushWarning = "WarningBrush";
    private const string BrushWarningSubtle = "WarningSubtleBrush";
    private const string BrushStroke = "CardStrokeBrush";
    private const string BrushCard = "CardBackgroundSecondaryBrush";
    private const string BrushInset = "InsetBackgroundBrush";
    private const string StyleCaption = "CaptionTextStyle";
    private const string StyleMuted = "MutedTextStyle";
    private const string FontSizeCaption = "FontSizeCaption";

    private readonly Grid _grid = new();

    public D3PaperDoll()
    {
        for (int c = 0; c < D3PaperDollLayout.Columns; c++) _grid.ColumnDefinitions.Add(new ColumnDefinition());
        for (int r = 0; r < D3PaperDollLayout.Rows; r++) _grid.RowDefinitions.Add(new RowDefinition { Height = new GridLength(CellHeight) });
        Content = _grid;
    }

    public void Show(IReadOnlyDictionary<string, DollCell> cells, Func<string, string> slotLabel)
    {
        _grid.Children.Clear();
        foreach (var (slot, (row, column)) in D3PaperDollLayout.Cells)
        {
            var cell = cells.TryGetValue(slot, out var c) ? c : new DollCell(slotLabel(slot), "", "", DollCellState.Empty);
            var card = Card(cell);
            Grid.SetRow(card, row);
            Grid.SetColumn(card, column);
            _grid.Children.Add(card);
        }
    }

    private static Border Card(DollCell cell)
    {
        var label = new TextBlock { Text = cell.Slot, TextTrimming = TextTrimming.CharacterEllipsis };
        label.SetResourceReference(StyleProperty, StyleMuted);
        label.SetResourceReference(TextBlock.FontSizeProperty, FontSizeCaption);
        var item = new TextBlock { Text = cell.Item, TextTrimming = TextTrimming.CharacterEllipsis };
        item.SetResourceReference(StyleProperty, StyleCaption);
        var border = new Border
        {
            Margin = CellMargin,
            Padding = CellPadding,
            CornerRadius = new CornerRadius(CellCornerRadius),
            BorderThickness = new Thickness(1),
            Child = new StackPanel { Children = { label, item } },
            ToolTip = string.IsNullOrEmpty(cell.Tooltip) ? null : cell.Tooltip,
        };
        var (stroke, fill) = cell.State switch
        {
            DollCellState.Match => (BrushSuccess, BrushSuccessSubtle),
            DollCellState.Mismatch => (BrushWarning, BrushWarningSubtle),
            DollCellState.Neutral => (BrushStroke, BrushCard),
            _ => (BrushStroke, BrushInset),
        };
        border.SetResourceReference(Border.BorderBrushProperty, stroke);
        border.SetResourceReference(Border.BackgroundProperty, fill);
        return border;
    }
}
