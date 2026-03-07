using System.Windows;
using DotApps.abc.Ui;

namespace DotApps.abc;

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
        ApplyWindowChromeIfAvailable();
        TitleBar.RestoreSizeRequested += (_, _) => RestorePresetSize();
        TitleBar.RestartRequested += (_, _) => RestartApp();
    }

    private void ApplyWindowChromeIfAvailable()
    {
        var asm = typeof(Window).Assembly;
        var chromeType = asm.GetType("Microsoft.Windows.Shell.WindowChrome") ?? asm.GetType("System.Windows.Shell.WindowChrome");
        if (chromeType != null)
        {
            try
            {
                var setChrome = chromeType.GetMethod("SetWindowChrome", new[] { typeof(Window), chromeType });
                var chromeInstance = Activator.CreateInstance(chromeType);
                chromeType.GetProperty("CaptionHeight")?.SetValue(chromeInstance, 0.0);
                chromeType.GetProperty("ResizeBorderThickness")?.SetValue(chromeInstance, new Thickness(4));
                chromeType.GetProperty("UseAeroCaptionButtons")?.SetValue(chromeInstance, false);
                setChrome?.Invoke(null, new object[] { this, chromeInstance! });
                return;
            }
            catch { /* fallback */ }
        }
        RootGrid.Margin = new Thickness(0, -1, 0, 0);
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
