using System.Windows.Media;
using DotCore.VocAnnotator;

namespace DotCore.VocAnnotatorUI;

/// <summary>Annotator session: folders to open. AnnotationDir defaults to ImagesDir, ProjectDir (classes) to AnnotationDir.</summary>
public sealed record AnnotatorSession(string? ImagesDir, string? AnnotationDir = null, string? ProjectDir = null, string? StartImage = null);

/// <summary>Image list entry.</summary>
public sealed class AnnotatorImageItem : ObservableObject
{
    private bool _isLabeled;
    private int _boxCount;
    private bool _isReviewed = true;

    public AnnotatorImageItem(string path, DateTime modifiedUtc)
    {
        Path = path;
        FileName = System.IO.Path.GetFileName(path);
        ModifiedUtc = modifiedUtc;
    }

    public string Path { get; }

    public string FileName { get; }

    public DateTime ModifiedUtc { get; }

    /// <summary>Has a JSON or VOC annotation (possibly empty = reviewed background).</summary>
    public bool IsLabeled { get => _isLabeled; set => Set(ref _isLabeled, value); }

    public int BoxCount { get => _boxCount; set => Set(ref _boxCount, value); }

    /// <summary>False for model pseudo-labels nobody confirmed yet.</summary>
    public bool IsReviewed { get => _isReviewed; set => Set(ref _isReviewed, value); }
}

/// <summary>Class list entry; Index is the YOLO class id and the 1-9 hotkey (Index + 1).</summary>
public sealed class AnnotatorClassItem : ObservableObject
{
    private int _count;

    public AnnotatorClassItem(string name, int index, Color color)
    {
        Name = name;
        Index = index;
        Color = color;
        Brush = ClassPalette.Freeze(new SolidColorBrush(color));
    }

    public string Name { get; }

    public int Index { get; }

    public string Hotkey => Index < 9 ? (Index + 1).ToString() : "";

    public Color Color { get; }

    public Brush Brush { get; }

    public int Count { get => _count; set => Set(ref _count, value); }
}

/// <summary>Box list entry of the current image.</summary>
public sealed class AnnotatorBoxItem
{
    public AnnotatorBoxItem(int index, AnnotationBox box, Brush brush)
    {
        Index = index;
        Box = box;
        Brush = brush;
    }

    public int Index { get; }

    public AnnotationBox Box { get; }

    public Brush Brush { get; }

    public string Number => "#" + (Index + 1);

    public string Label => Box.Label;

    public string SizeText => $"{(int)Math.Round(Box.Width)} x {(int)Math.Round(Box.Height)}";

    public bool Difficult => Box.Difficult;
}

/// <summary>Class colors: configured class_colors first, else a fixed palette by class index (stable across sessions).</summary>
public static class ClassPalette
{
    public static readonly IReadOnlyList<Color> Colors = new[]
    {
        Color.FromRgb(0xE6, 0x19, 0x4B), Color.FromRgb(0x3C, 0xB4, 0x4B), Color.FromRgb(0x43, 0x63, 0xD8), Color.FromRgb(0xF5, 0x82, 0x31),
        Color.FromRgb(0x91, 0x1E, 0xB4), Color.FromRgb(0x42, 0xD4, 0xF4), Color.FromRgb(0xF0, 0x32, 0xE6), Color.FromRgb(0xBF, 0xEF, 0x45),
        Color.FromRgb(0xFA, 0xBE, 0xD4), Color.FromRgb(0x46, 0x99, 0x90), Color.FromRgb(0xDC, 0xBE, 0xFF), Color.FromRgb(0x9A, 0x63, 0x24),
        Color.FromRgb(0xFF, 0xE1, 0x19), Color.FromRgb(0x80, 0x00, 0x00), Color.FromRgb(0xAA, 0xFF, 0xC3), Color.FromRgb(0x00, 0x00, 0x75),
    };

    public static readonly Color Unknown = Color.FromRgb(0x9E, 0x9E, 0x9E);

    public static Color For(int index, IReadOnlyDictionary<string, List<int>> configured, string name)
    {
        if (configured.TryGetValue(name, out var rgb) && rgb.Count >= 3)
            return Color.FromRgb((byte)Math.Clamp(rgb[0], 0, 255), (byte)Math.Clamp(rgb[1], 0, 255), (byte)Math.Clamp(rgb[2], 0, 255));
        return index < 0 ? Unknown : Colors[index % Colors.Count];
    }

    public static List<int> ToRgb(Color c) => new() { c.R, c.G, c.B };

    /// <summary>Black or white, whichever reads better on the color.</summary>
    public static Color ContrastText(Color c) => 0.299 * c.R + 0.587 * c.G + 0.114 * c.B > 150 ? System.Windows.Media.Colors.Black : System.Windows.Media.Colors.White;

    public static T Freeze<T>(T freezable) where T : System.Windows.Freezable
    {
        freezable.Freeze();
        return freezable;
    }
}

/// <summary>Per-image undo / redo of the box list (snapshots).</summary>
public sealed class UndoHistory : UndoHistory<AnnotationBox>
{
}

/// <summary>Undo / redo of a list state as snapshots of its items (items must be immutable or snapshot copies).</summary>
public class UndoHistory<T>
{
    private const int MaxDepth = 200;
    private readonly LinkedList<List<T>> _undo = new();
    private readonly Stack<List<T>> _redo = new();

    public bool CanUndo => _undo.Count > 0;

    public bool CanRedo => _redo.Count > 0;

    public void Reset()
    {
        _undo.Clear();
        _redo.Clear();
    }

    /// <summary>Record the state before an edit.</summary>
    public void Push(IEnumerable<T> before)
    {
        _undo.AddLast(before.ToList());
        if (_undo.Count > MaxDepth) _undo.RemoveFirst();
        _redo.Clear();
    }

    public List<T>? Undo(IEnumerable<T> current)
    {
        if (_undo.Last is not { } last) return null;
        _undo.RemoveLast();
        _redo.Push(current.ToList());
        return last.Value;
    }

    public List<T>? Redo(IEnumerable<T> current)
    {
        if (_redo.Count == 0) return null;
        _undo.AddLast(current.ToList());
        return _redo.Pop();
    }
}
