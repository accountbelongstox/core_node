// PY-REF: none (DOT-only)
using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Input;

namespace DotCore.VocAnnotatorUI;

/// <summary>
/// Shared canvas key map for every AnnotationCanvas host: F fit, Ctrl+1 actual size, + / - zoom, Space + drag pan,
/// Del / Back delete, Esc, Ctrl+Z undo, Ctrl+Y / Ctrl+Shift+Z redo. Hosts call TryHandleKeyDown / HandleKeyUp from their
/// Preview key handlers (or Attach) and keep their own keys (navigation, classes) after it.
/// </summary>
public sealed class AnnotationCanvasKeys
{
    public const double ZoomStep = 1.25;

    private readonly AnnotationCanvas _canvas;

    public AnnotationCanvasKeys(AnnotationCanvas canvas) => _canvas = canvas;

    public ICommand? Delete { get; init; }

    public ICommand? Undo { get; init; }

    public ICommand? Redo { get; init; }

    public ICommand? Escape { get; init; }

    /// <summary>Subscribe the map to the host's preview key events; host-specific keys run in hostKeyDown when the map did not handle the key.</summary>
    public static AnnotationCanvasKeys Attach(UIElement host, AnnotationCanvasKeys keys, KeyEventHandler? hostKeyDown = null)
    {
        host.PreviewKeyDown += (s, e) =>
        {
            if (!keys.TryHandleKeyDown(e)) hostKeyDown?.Invoke(s, e);
        };
        host.PreviewKeyUp += (_, e) => keys.HandleKeyUp(e);
        return keys;
    }

    /// <summary>True when the key was handled; text boxes keep their keys.</summary>
    public bool TryHandleKeyDown(KeyEventArgs e)
    {
        if (Keyboard.FocusedElement is TextBox) return false;
        var mods = Keyboard.Modifiers;
        bool ctrl = (mods & ModifierKeys.Control) != 0, shift = (mods & ModifierKeys.Shift) != 0;
        if (ctrl)
        {
            switch (e.Key)
            {
                case Key.Z when shift:
                case Key.Y: return Run(Redo, e);
                case Key.Z: return Run(Undo, e);
                case Key.D1:
                case Key.NumPad1: return Handled(e, () => _canvas.SetZoom(1));
                default: return false;
            }
        }
        switch (e.Key)
        {
            case Key.F: return Handled(e, _canvas.FitToView);
            case Key.OemPlus:
            case Key.Add: return Handled(e, () => _canvas.ZoomBy(ZoomStep));
            case Key.OemMinus:
            case Key.Subtract: return Handled(e, () => _canvas.ZoomBy(1 / ZoomStep));
            case Key.Delete:
            case Key.Back: return Run(Delete, e);
            case Key.Escape: return Run(Escape, e);
            case Key.Space:
                if (Keyboard.FocusedElement is ButtonBase or ListBoxItem or ComboBox) return false;
                return Handled(e, () => _canvas.PanKeyDown = true);
            default: return false;
        }
    }

    public void HandleKeyUp(KeyEventArgs e)
    {
        if (e.Key == Key.Space) _canvas.PanKeyDown = false;
    }

    private static bool Run(ICommand? command, KeyEventArgs e)
    {
        if (command == null) return false;
        if (command.CanExecute(null)) command.Execute(null);
        e.Handled = true;
        return true;
    }

    private static bool Handled(KeyEventArgs e, Action action)
    {
        action();
        e.Handled = true;
        return true;
    }
}
