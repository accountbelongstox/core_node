// PY-REF: none (DOT-only)
using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core;
using DotApps.d3d4tester.Core.Battlenet;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.I18n;
using DotCore.Foundations;
using DotCore.Utils;

namespace DotApps.d3d4tester.Components;

/// <summary>
/// Resource table: system, this app, Battle.net, D3, D4, ROSBOT — CPU %, memory, dedicated GPU memory, GPU %. Samples once per
/// second on a worker thread while the block is visible and the window is not minimized (DotCore.Utils.SystemResourceSampler);
/// process ids come from the single owner of each entity (BattlenetManager, D3Manager, D4Manager, RosbotManager).
/// </summary>
public partial class ResourceMonitorBlock : UserControl
{
    private const int IntervalMs = 1000;
    private const double Gib = 1024.0 * 1024 * 1024;
    private const double Mib = 1024.0 * 1024;
    private const string EmptyCell = "-";
    private const string GroupSystem = "system";
    private const string GroupSelf = "self";
    private const string GroupBattlenet = "battlenet";
    private const string GroupD3 = "d3";
    private const string GroupD4 = "d4";
    private const string GroupRosbot = "rosbot";
    private static readonly string[] RowGroups = { GroupSystem, GroupSelf, GroupBattlenet, GroupD3, GroupD4, GroupRosbot };
    private static readonly string[] ColumnKeys =
    {
        I18nKeys.ResourceColumnName, I18nKeys.ResourceColumnCpu, I18nKeys.ResourceColumnMemory, I18nKeys.ResourceColumnGpuMemory, I18nKeys.ResourceColumnGpu,
    };

    private readonly DispatcherTimer _timer = new() { Interval = TimeSpan.FromMilliseconds(IntervalMs) };
    private readonly TextBlock[] _headers = new TextBlock[ColumnKeys.Length];
    private readonly Dictionary<string, TextBlock[]> _cells = new(StringComparer.Ordinal);
    private SystemResourceSampler? _sampler;
    private int _sampling;
    private Window? _stateWindow;

    public ResourceMonitorBlock()
    {
        InitializeComponent();
        BuildGrid();
        _timer.Tick += (_, _) => StartSample();
        IsVisibleChanged += (_, _) => UpdateTimer();
        Loaded += (_, _) =>
        {
            RefreshI18n();
            AttachWindow(Window.GetWindow(this));
            UpdateTimer();
        };
        Unloaded += (_, _) =>
        {
            _timer.Stop();
            AttachWindow(null);
        };
    }

    /// <summary>Subscribe the hosting window's StateChanged once (re-Loaded pages do not stack handlers); null unsubscribes.</summary>
    private void AttachWindow(Window? window)
    {
        if (ReferenceEquals(_stateWindow, window)) return;
        if (_stateWindow != null) _stateWindow.StateChanged -= OnWindowStateChanged;
        _stateWindow = window;
        if (_stateWindow != null) _stateWindow.StateChanged += OnWindowStateChanged;
    }

    private void OnWindowStateChanged(object? sender, EventArgs e) => UpdateTimer();

    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        LblTitle.Text = p.GetUiText(I18nKeys.ResourceTitle);
        for (int i = 0; i < ColumnKeys.Length; i++) _headers[i].Text = p.GetUiText(ColumnKeys[i]);
        foreach (var group in RowGroups) _cells[group][0].Text = p.GetUiText(I18nKeys.ResourceRowPrefix + group);
    }

    private void BuildGrid()
    {
        double[] weights = { 1.0, 0.9, 1.6, 1.4, 0.8 };
        for (int c = 0; c < ColumnKeys.Length; c++)
            UsageGrid.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(weights[c], GridUnitType.Star) });
        for (int r = 0; r <= RowGroups.Length; r++)
            UsageGrid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        for (int c = 0; c < ColumnKeys.Length; c++)
        {
            _headers[c] = Cell(0, c);
            _headers[c].SetResourceReference(StyleProperty, "CaptionTextStyle");
        }
        for (int r = 0; r < RowGroups.Length; r++)
        {
            var row = new TextBlock[ColumnKeys.Length];
            for (int c = 0; c < ColumnKeys.Length; c++) row[c] = Cell(r + 1, c);
            _cells[RowGroups[r]] = row;
        }
    }

    private TextBlock Cell(int row, int column)
    {
        var tb = new TextBlock { Margin = new Thickness(0, 0, 6, 0), Text = EmptyCell, TextTrimming = TextTrimming.CharacterEllipsis };
        Grid.SetRow(tb, row);
        Grid.SetColumn(tb, column);
        UsageGrid.Children.Add(tb);
        return tb;
    }

    private void UpdateTimer()
    {
        bool active = IsVisible && Window.GetWindow(this) is { WindowState: not WindowState.Minimized };
        if (active && !_timer.IsEnabled)
        {
            _timer.Start();
            StartSample();
        }
        else if (!active && _timer.IsEnabled)
        {
            _timer.Stop();
        }
    }

    private void StartSample()
    {
        if (Interlocked.Exchange(ref _sampling, 1) == 1) return;
        Task.Run(() =>
        {
            try
            {
                _sampler ??= new SystemResourceSampler();
                var snapshot = _sampler.Sample(CollectGroups());
                Dispatcher.InvokeAsync(() => Apply(snapshot));
            }
            catch (Exception ex)
            {
                ColorPrinter.Yellow($"[ResourceMonitor] sample failed: {ex.Message}");
            }
            finally
            {
                Interlocked.Exchange(ref _sampling, 0);
            }
        });
    }

    private static Dictionary<string, IReadOnlyCollection<int>> CollectGroups() => new(StringComparer.Ordinal)
    {
        [GroupSelf] = new[] { Environment.ProcessId },
        [GroupBattlenet] = BattlenetManager.Instance.GetProcessIds(),
        [GroupD3] = D3Manager.Instance.GetProcessIds(),
        [GroupD4] = D4Manager.Instance.GetProcessIds(),
        [GroupRosbot] = RosbotManager.Instance.CollectRosbotPids(),
    };

    private void Apply(ResourceSnapshot snapshot)
    {
        var s = snapshot.System;
        SetRow(GroupSystem, Percent(s.CpuPercent), UsedOfTotal(s.MemoryUsedBytes, s.MemoryTotalBytes),
            s.GpuMemoryUsedBytes is { } used ? (s.GpuMemoryTotalBytes is { } total ? UsedOfTotal(used, total) : Size(used)) : EmptyCell,
            s.GpuPercent is { } g ? Percent(g) : EmptyCell);
        foreach (var (group, u) in snapshot.Groups)
        {
            if (u.ProcessCount == 0)
            {
                SetRow(group, EmptyCell, EmptyCell, EmptyCell, EmptyCell);
                continue;
            }
            SetRow(group, Percent(u.CpuPercent), Size(u.MemoryBytes),
                u.GpuMemoryBytes is { } gm ? Size(gm) : EmptyCell, u.GpuPercent is { } gp ? Percent(gp) : EmptyCell);
        }
    }

    private void SetRow(string group, string cpu, string memory, string gpuMemory, string gpu)
    {
        var row = _cells[group];
        row[1].Text = cpu;
        row[2].Text = memory;
        row[3].Text = gpuMemory;
        row[4].Text = gpu;
    }

    private static string Percent(double value) => value.ToString("0.0", CultureInfo.InvariantCulture) + "%";

    private static string Size(long bytes) => bytes >= Gib
        ? (bytes / Gib).ToString("0.0", CultureInfo.InvariantCulture) + " GB"
        : (bytes / Mib).ToString("0", CultureInfo.InvariantCulture) + " MB";

    /// <summary>Used / total in one unit, e.g. "12.7/15.2 GB" (fits a narrow column).</summary>
    private static string UsedOfTotal(long used, long total) =>
        (used / Gib).ToString("0.0", CultureInfo.InvariantCulture) + "/" + (total / Gib).ToString("0.0", CultureInfo.InvariantCulture) + " GB";
}
