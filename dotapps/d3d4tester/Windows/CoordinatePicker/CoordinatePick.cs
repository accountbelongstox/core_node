using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace DotApps.d3d4tester.Windows.CoordinatePicker;

/// <summary>Pick shape. Config names (point/rect/circle) 1:1 Python CoordinatePicker pick types.</summary>
public enum CoordinatePickType
{
    Point,
    Rect,
    Circle,
}

/// <summary>
/// One picked coordinate in original screenshot pixels: point (X,Y), rect (top-left X,Y + Width,Height) or circle (center X,Y + Radius).
/// Name is editable from the canvas label and the history list. 1:1 Python pick dict (id, type, x, y, width, height, radius, name, timestamp).
/// </summary>
public sealed class CoordinatePick : INotifyPropertyChanged
{
    private string _name = "";
    private int _index;

    public CoordinatePick(string id, CoordinatePickType type, int x, int y, int width = 0, int height = 0, int radius = 0)
    {
        Id = id;
        Type = type;
        X = x;
        Y = y;
        Width = width;
        Height = height;
        Radius = radius;
    }

    public event PropertyChangedEventHandler? PropertyChanged;

    public string Id { get; }
    public CoordinatePickType Type { get; }
    public int X { get; }
    public int Y { get; }
    public int Width { get; }
    public int Height { get; }
    public int Radius { get; }
    public DateTime Timestamp { get; init; } = DateTime.Now;

    /// <summary>1-based position in the history list (ID column).</summary>
    public int Index
    {
        get => _index;
        set => SetField(ref _index, value);
    }

    public string Name
    {
        get => _name;
        set => SetField(ref _name, value ?? "");
    }

    /// <summary>Config/type name: point, rect, circle.</summary>
    public string TypeName => TypeToName(Type);

    /// <summary>History Coords column. 1:1 Python _update_history_display.</summary>
    public string CoordsText => Type switch
    {
        CoordinatePickType.Rect => $"{X},{Y} {Width}×{Height}",
        CoordinatePickType.Circle => $"({X},{Y}) r={Radius}",
        _ => $"({X}, {Y})",
    };

    /// <summary>Label anchor in original pixels: rect center, else (X,Y). 1:1 Python _redraw_all_labels.</summary>
    public (int X, int Y) LabelAnchor => Type == CoordinatePickType.Rect ? (X + Width / 2, Y + Height / 2) : (X, Y);

    public static string TypeToName(CoordinatePickType type) => type switch
    {
        CoordinatePickType.Rect => "rect",
        CoordinatePickType.Circle => "circle",
        _ => "point",
    };

    private void SetField<T>(ref T field, T value, [CallerMemberName] string? propertyName = null)
    {
        if (EqualityComparer<T>.Default.Equals(field, value)) return;
        field = value;
        PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(propertyName));
    }
}
