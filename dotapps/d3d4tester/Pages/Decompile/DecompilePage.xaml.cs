// PY-REF: none (DOT-only)
using System.IO;
using System.Windows;
using System.Windows.Controls;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Services;
using DotCore.Decompile;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Pages.Decompile;

/// <summary>
/// Decompile tab (sub-tabs: ROSBOT bridge, tools, log): install the toolchain into the data dir, decompile ROSBOT (exe + plugins +
/// settings report), RBAssist or any file; the log sub-tab is selected when an operation starts.
/// </summary>
public partial class DecompilePage : UserControl
{
    private const string LogTag = "[Decompile]";
    private bool _busy;
    private CancellationTokenSource? _operation;
    private string? _chainStatusKey;

    public DecompilePage()
    {
        InitializeComponent();
        Loaded += (_, _) =>
        {
            RefreshI18n();
            RefreshState();
        };
    }

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        TabTools.Header = p.GetUiText(I18nKeys.DecompileToolsTitle);
        TabLog.Header = p.GetUiText(I18nKeys.DecompileLog);
        BtnInstall.ToolTip = p.GetUiText(I18nKeys.DecompileToolsDesc);
        BtnInstall.Content = p.GetUiText(I18nKeys.DecompileInstall);
        LblRosbotTitle.Text = p.GetUiText(I18nKeys.DecompileRosbotTitle);
        BtnRosbot.ToolTip = p.GetUiText(I18nKeys.DecompileRosbotDesc);
        BtnRosbot.Content = p.GetUiText(I18nKeys.DecompileRosbotButton);
        BtnRecoverSources.Content = p.GetUiText(I18nKeys.DecompileRecoverSources);
        LblRbAssistTitle.Text = p.GetUiText(I18nKeys.DecompileRbAssistTitle);
        BtnRbAssist.ToolTip = p.GetUiText(I18nKeys.DecompileRbAssistDesc);
        BtnBrowseRbAssist.Content = p.GetUiText(I18nKeys.DecompileBrowse);
        BtnRbAssist.Content = p.GetUiText(I18nKeys.DecompileRbAssistButton);
        LblFileTitle.Text = p.GetUiText(I18nKeys.DecompileFileTitle);
        BtnFile.ToolTip = p.GetUiText(I18nKeys.DecompileFileDesc);
        BtnFile.Content = p.GetUiText(I18nKeys.DecompileFileButton);
        BtnExportIl.Content = p.GetUiText(I18nKeys.DecompileExportIl);
        BtnOpenOutput.Content = p.GetUiText(I18nKeys.DecompileOpenOutput);
        BtnChain.Content = p.GetUiText(I18nKeys.DecompileChain);
        BtnChain.ToolTip = p.GetUiText(I18nKeys.DecompileChainDesc);
        BtnCancel.Content = p.GetUiText(I18nKeys.DecompileCancel);
        RefreshState();
    }

    private void RefreshState()
    {
        var p = D3D4TesterI18n.Provider;
        var tools = DecompileService.Tools;
        string Line(string name, bool ok) => $"{name}: {p.GetUiText(ok ? I18nKeys.DecompileInstalled : I18nKeys.DecompileMissing)}";
        TxtToolsStatus.Text = string.Join(Environment.NewLine,
            Line("ILSpy (ilspycmd)", tools.HasIlSpy), Line("de4dot-cex", tools.HasDe4dot), Line("autoit-ripper", tools.HasAutoItRipper), Line("UPX", tools.HasUpx));
        TxtRosbotDir.Text = ConfigBinding.GetValue(ConfigKeys.RosSettingsRosDirectory, "") ?? "";
        if (string.IsNullOrWhiteSpace(TxtRbAssistPath.Text)) TxtRbAssistPath.Text = DecompileService.FindRbAssist() ?? "";
        TxtOutputDir.Text = DecompileService.OutputRoot;
        foreach (var b in new[] { BtnInstall, BtnRosbot, BtnRbAssist, BtnFile, BtnBrowseRbAssist, BtnChain, BtnExportIl, BtnRecoverSources }) b.IsEnabled = !_busy;
        BtnCancel.IsEnabled = _busy;
        TxtRbAssistPath.IsEnabled = !_busy;
        TxtChainStatus.Text = _chainStatusKey == null ? "" : p.GetUiText(_chainStatusKey);
    }

    private void BtnInstall_Click(object sender, RoutedEventArgs e) => _ = RunAsync((log, token) => DecompileService.InstallToolsAsync(log, token));

    private void BtnChain_Click(object sender, RoutedEventArgs e)
    {
        string path = TxtRbAssistPath.Text;
        _ = RunAsync(async (log, token) =>
        {
            var report = await DecompileService.TestChainAsync(path, log, token);
            await Dispatcher.InvokeAsync(() => _chainStatusKey = report.Passed ? I18nKeys.DecompilePassed : I18nKeys.DecompileIncomplete);
        });
    }

    private void BtnCancel_Click(object sender, RoutedEventArgs e) => _operation?.Cancel();

    private void BtnRecoverSources_Click(object sender, RoutedEventArgs e) => _ = RunAsync(async (log, token) =>
    {
        var report = await DecompileService.RecoverSourcesAsync(log, token);
        if (report == null) return;
        await Dispatcher.InvokeAsync(() => _chainStatusKey = report.AllProtectedBodiesRecovered
            ? I18nKeys.DecompilePassed : I18nKeys.DecompileIncomplete);
    });

    private void BtnRosbot_Click(object sender, RoutedEventArgs e) => _ = RunAsync(async (log, token) =>
    {
        foreach (var r in await DecompileService.DecompileRosbotAsync(log, token)) Report(r, log);
    });

    private void BtnRbAssist_Click(object sender, RoutedEventArgs e)
    {
        string path = TxtRbAssistPath.Text;
        _ = RunAsync(async (log, token) =>
        {
            if (await DecompileService.DecompileRbAssistAsync(path, log, token) is { } r) Report(r, log);
        });
    }

    private void BtnBrowseRbAssist_Click(object sender, RoutedEventArgs e)
    {
        if (PickFile() is { } path) TxtRbAssistPath.Text = path;
    }

    private void BtnFile_Click(object sender, RoutedEventArgs e)
    {
        if (PickFile() is not { } path) return;
        _ = RunAsync(async (log, token) => Report(await DecompileService.DecompileFileAsync(path, log, token), log));
    }

    private void BtnExportIl_Click(object sender, RoutedEventArgs e)
    {
        if (PickFile() is not { } path) return;
        _ = RunAsync(async (log, token) => Report(await DecompileService.ExportIlAsync(path, log, token), log));
    }

    private void BtnOpenOutput_Click(object sender, RoutedEventArgs e)
    {
        Directory.CreateDirectory(DecompileService.OutputRoot);
        ShellOpen.OpenDir(DecompileService.OutputRoot);
    }

    private string? PickFile()
    {
        var dlg = new Microsoft.Win32.OpenFileDialog { Filter = D3D4TesterI18n.Provider.GetUiText(I18nKeys.DecompileFileFilter) };
        return dlg.ShowDialog(Window.GetWindow(this)) == true ? dlg.FileName : null;
    }

    private static void Report(DecompileResult r, Action<string> log)
    {
        var status = r.Partial ? I18nKeys.DecompileResultPartial : r.Ok ? I18nKeys.DecompileResultOk : I18nKeys.DecompileResultFailed;
        log($"{D3D4TesterI18n.Provider.GetUiText(status)} [{r.Kind}] {r.Summary} -> {r.OutputDir}");
    }

    /// <summary>Run one operation on a worker thread with buttons disabled; tool output streams into the log box and ColorPrinter.</summary>
    private async Task RunAsync(Func<Action<string>, CancellationToken, Task> work)
    {
        if (_busy) return;
        _busy = true;
        _operation = DecompileService.BeginOperation();
        TabsDecompile.SelectedItem = TabLog;
        RefreshState();
        void Log(string line)
        {
            ColorPrinter.Gray($"{LogTag} {line}");
            Dispatcher.BeginInvoke(() =>
            {
                TxtLog.AppendText(line + Environment.NewLine);
                TxtLog.ScrollToEnd();
            });
        }
        try
        {
            await Task.Run(() => work(Log, _operation.Token));
        }
        catch (OperationCanceledException)
        {
            _chainStatusKey = I18nKeys.DecompileCancelled;
            Log(D3D4TesterI18n.Provider.GetUiText(I18nKeys.DecompileCancelled));
        }
        catch (Exception ex)
        {
            Log(ex.Message);
        }
        finally
        {
            _busy = false;
            _operation.Dispose();
            _operation = null;
            RefreshState();
        }
    }
}
