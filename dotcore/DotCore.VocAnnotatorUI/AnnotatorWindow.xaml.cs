using System.ComponentModel;
using System.Windows;
using DotCore.Common;
using static DotCore.VocAnnotatorUI.AnnotatorI18n;

namespace DotCore.VocAnnotatorUI;

/// <summary>Window hosting AnnotatorView; closing saves or confirms pending edits.</summary>
public partial class AnnotatorWindow : Window
{
    private readonly AnnotatorView _view;

    public AnnotatorWindow(AnnotatorSession session)
    {
        InitializeComponent();
        _view = new AnnotatorView(session);
        Host.Content = _view;
        Title = T(AnnotatorI18nKeys.WindowTitle);
        Provider.LanguageChanged += OnLanguageChanged;
        Closed += (_, _) => Provider.LanguageChanged -= OnLanguageChanged;
    }

    protected override void OnClosing(CancelEventArgs e)
    {
        base.OnClosing(e);
        if (!e.Cancel && !_view.TryClose()) e.Cancel = true;
    }

    private void OnLanguageChanged(object? sender, LanguageChangedEventArgs e) =>
        Dispatcher.InvokeAsync(() => Title = T(AnnotatorI18nKeys.WindowTitle));
}
