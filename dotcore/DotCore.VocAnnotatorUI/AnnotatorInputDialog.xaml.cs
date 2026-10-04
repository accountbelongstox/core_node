using System.Windows;
using static DotCore.VocAnnotatorUI.AnnotatorI18n;

namespace DotCore.VocAnnotatorUI;

/// <summary>Single-line text prompt.</summary>
public partial class AnnotatorInputDialog : Window
{
    private AnnotatorInputDialog(string title, string label, string initial)
    {
        InitializeComponent();
        Title = title;
        LblPrompt.Text = label;
        TxtValue.Text = initial;
        BtnOk.Content = T(AnnotatorI18nKeys.Ok);
        BtnCancel.Content = T(AnnotatorI18nKeys.Cancel);
        Loaded += (_, _) =>
        {
            TxtValue.Focus();
            TxtValue.SelectAll();
        };
    }

    /// <summary>Entered text, or null when cancelled.</summary>
    public static string? Ask(Window? owner, string title, string label, string initial)
    {
        var dlg = new AnnotatorInputDialog(title, label, initial) { Owner = owner };
        return dlg.ShowDialog() == true ? dlg.TxtValue.Text : null;
    }

    private void BtnOk_Click(object sender, RoutedEventArgs e) => DialogResult = true;
}
