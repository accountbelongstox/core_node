using System.Windows;

namespace GifTextOverlay;

public partial class InputDialog
{
    public string? Value { get; private set; }

    public InputDialog()
    {
        InitializeComponent();
    }

    public static readonly System.Windows.DependencyProperty PromptProperty =
        System.Windows.DependencyProperty.Register(nameof(Prompt), typeof(string), typeof(InputDialog));
    public string Prompt
    {
        get => (string)GetValue(PromptProperty);
        set { SetValue(PromptProperty, value); }
    }

    public static readonly System.Windows.DependencyProperty DefaultValueProperty =
        System.Windows.DependencyProperty.Register(nameof(DefaultValue), typeof(string), typeof(InputDialog));
    public string DefaultValue
    {
        get => (string)GetValue(DefaultValueProperty);
        set { SetValue(DefaultValueProperty, value); }
    }

    protected override void OnContentRendered(System.EventArgs e)
    {
        base.OnContentRendered(e);
        TbPrompt.Text = Prompt ?? "";
        TbValue.Text = DefaultValue ?? "";
        TbValue.SelectAll();
        TbValue.Focus();
    }

    private void Ok_OnClick(object sender, RoutedEventArgs e)
    {
        Value = TbValue.Text?.Trim();
        DialogResult = true;
        Close();
    }

    private void Cancel_OnClick(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
