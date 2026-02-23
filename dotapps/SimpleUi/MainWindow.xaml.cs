using System.Diagnostics;
using System.IO;
using System.Windows;
using DotCore.UIInspect;

namespace DotApps.SimpleUi;

public partial class MainWindow : Window
{
    private const string BattleNetExePath = @"D:\applications\Games\Battle.net\Battle.net.exe";

    public MainWindow()
    {
        InitializeComponent();
    }

    private async void BtnLaunchBattleNet_Click(object sender, RoutedEventArgs e)
    {
        BtnLaunchBattleNet.IsEnabled = false;
        LstButtons.Items.Clear();
        TxtElectron.Text = "";

        try
        {
            var process = ProcessLauncher.Launch(BattleNetExePath);
            if (process == null)
            {
                TxtElectron.Text = "Failed to start: file not found or start failed.";
                return;
            }

            await Task.Delay(4000);

            if (process.HasExited)
            {
                TxtElectron.Text = "Process exited before inspection.";
                return;
            }

            InspectAndFill(process);
        }
        catch (Exception ex)
        {
            TxtElectron.Text = "Error: " + ex.Message;
        }
        finally
        {
            BtnLaunchBattleNet.IsEnabled = true;
        }
    }

    private void BtnRefreshUi_Click(object sender, RoutedEventArgs e)
    {
        var process = FindBattleNetProcess();
        if (process == null)
        {
            TxtElectron.Text = "Battle.net not running. Launch it first (button 1).";
            LstButtons.Items.Clear();
            return;
        }

        try
        {
            InspectAndFill(process);
        }
        catch (Exception ex)
        {
            TxtElectron.Text = "Error: " + ex.Message;
        }
    }

    private static Process? FindBattleNetProcess()
    {
        var name = Path.GetFileNameWithoutExtension(BattleNetExePath);
        var processes = Process.GetProcessesByName(name);
        if (processes.Length == 0)
            return null;

        Process? found = null;
        foreach (var p in processes)
        {
            if (p.HasExited) continue;
            try
            {
                var path = p.MainModule?.FileName;
                if (!string.IsNullOrEmpty(path) && path.Equals(BattleNetExePath, StringComparison.OrdinalIgnoreCase))
                {
                    found = p;
                    break;
                }
                found ??= p;
            }
            catch { /* no access */ }
        }

        if (found == null)
        {
            foreach (var p in processes)
                p?.Dispose();
            return null;
        }

        foreach (var p in processes)
        {
            if (p != null && !ReferenceEquals(p, found))
                p.Dispose();
        }
        return found;
    }

    private void InspectAndFill(Process process)
    {
        LstButtons.Items.Clear();

        var isElectron = ElectronDetector.IsElectron(process);
        TxtElectron.Text = isElectron ? "App is Electron-based." : "App is not detected as Electron.";

        var buttons = UIButtonEnumerator.GetClickableButtons(process);
        foreach (var item in buttons)
        {
            var display = string.IsNullOrEmpty(item.Name)
                ? $"[{item.ControlType}] (AutomationId: {item.AutomationId})"
                : $"{item.Name} [{item.ControlType}]";
            LstButtons.Items.Add(display);
        }

        if (buttons.Count == 0)
            LstButtons.Items.Add("(No clickable buttons found)");
    }
}
