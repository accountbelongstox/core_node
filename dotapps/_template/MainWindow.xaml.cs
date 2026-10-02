using System.Windows;
using {{ROOT_NAMESPACE}}.Ui;

namespace {{ROOT_NAMESPACE}};

public partial class MainWindow : Window, IMainWindowHost
{
    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        UiRegistry.RegisterMainUi(this, this);
        TitleBar.RestoreSizeRequested += (_, _) => RestorePresetSize();
        TitleBar.RestartRequested += (_, _) => RestartApp();
    }

    private void RestorePresetSize()
    {
        WindowState = WindowState.Normal;
        Width = 640;
        Height = 480;
    }

    private static void RestartApp()
    {
        var path = Environment.ProcessPath ?? System.Diagnostics.Process.GetCurrentProcess().MainModule?.FileName;
        if (!string.IsNullOrEmpty(path))
            System.Diagnostics.Process.Start(path);
        Application.Current.Shutdown();
    }

    protected override void OnClosed(EventArgs e)
    {
        UiRegistry.UnregisterMainUi();
        base.OnClosed(e);
    }

    public object? GetPanel(string key) => key == "main" ? TabHome?.Content : null;
}
