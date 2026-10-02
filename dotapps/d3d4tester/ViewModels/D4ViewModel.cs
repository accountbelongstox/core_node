// PY-REF: pyapps/d3-check/ui/panels/d4_panel.py
using System.Collections.ObjectModel;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Input;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.D4;
using DotApps.d3d4tester.Ctl;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.Foundations;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>Semantic tone of a status value: Plain renders as text, the others as status chips.</summary>
public enum D4StatusTone
{
    Plain,
    Neutral,
    Success,
    Warning,
    Danger,
    Info
}

/// <summary>One tile of the D4 status grid (label, value, tone, icon glyph).</summary>
public sealed class D4StatusTileViewModel : BaseViewModel
{
    private string _label = "";
    private string _value = "";
    private D4StatusTone _tone = D4StatusTone.Plain;

    public D4StatusTileViewModel(string labelKey, string glyph)
    {
        LabelKey = labelKey;
        Glyph = glyph;
    }

    public string LabelKey { get; }
    public string Glyph { get; }
    public string Label { get => _label; set => SetProperty(ref _label, value); }
    public string Value { get => _value; set => SetProperty(ref _value, value); }
    public D4StatusTone Tone { get => _tone; set => SetProperty(ref _tone, value); }
}

/// <summary>
/// D4 EXP farming view model: start (team check off the UI thread, abort only when HasTeam == false) / stop (pipeline reset),
/// config persistence and the live status grid fed by <see cref="D4UiStatusUpdater.StatusUpdated"/>.
/// 1:1 Python pyapps/d3-check/ui/panels/d4_panel.py (_start_exp_farming, _stop_exp_farming, _update_status_from_data, _translate_status_value).
/// Fixes Python bug: Stop cleared debug_window_open/paused while the debug window stayed open; those flags now survive the reset.
/// </summary>
public sealed class D4ViewModel : BaseViewModel
{
    private const string LogPrefix = "[D4]";
    private const string TimeFormat = "HH:mm:ss";

    private readonly D4StatusTileViewModel _runningTile = new(I18nKeys.D4ExpFarmingGameStatusD4RunningStatus, "");
    private readonly D4StatusTileViewModel _gameStateTile = new(I18nKeys.D4ExpFarmingGameStatusGameState, "");
    private readonly D4StatusTileViewModel _teamStatusTile = new(I18nKeys.D4StatusTeamStatusLabel, "");
    private readonly D4StatusTileViewModel _locationTile = new(I18nKeys.D4StatusLocationLabel, "");
    private readonly D4StatusTileViewModel _mapTile = new(I18nKeys.D4ExpFarmingGameStatusCurrentMap, "");
    private readonly D4StatusTileViewModel _teamCountTile = new(I18nKeys.D4ExpFarmingGameStatusTeamCount, "");
    private readonly D4StatusTileViewModel _dungeonTile = new(I18nKeys.D4ExpFarmingGameStatusDungeonProgress, "");
    private readonly D4StatusTileViewModel _tickTile = new(I18nKeys.D4StatusTickCountLabel, "");
    private readonly D4StatusTileViewModel _coordsTile = new(I18nKeys.D4ExpFarmingGameStatusScreenCoordinates, "");
    private readonly D4StatusTileViewModel _sizeTile = new(I18nKeys.D4ExpFarmingGameStatusScreenSize, "");
    private readonly D4StatusTileViewModel _switchCountTile = new(I18nKeys.D4ExpFarmingGameStatusMapSwitchCount, "");
    private readonly D4StatusTileViewModel _switchStateTile = new(I18nKeys.D4ExpFarmingGameStatusMapSwitchState, "");
    private readonly RelayCommand _toggleExpFarmingCommand;

    private D4StatusSnapshot? _lastSnapshot;
    private bool _isExpFarmingRunning;
    private bool _isBusy;
    private string _startStopText = "";
    private string _updatedAtText = "";
    private bool _attached;

    public D4ViewModel()
    {
        Tiles = new ObservableCollection<D4StatusTileViewModel>
        {
            _runningTile, _gameStateTile, _teamStatusTile, _locationTile,
            _mapTile, _teamCountTile, _dungeonTile, _tickTile,
            _coordsTile, _sizeTile, _switchCountTile, _switchStateTile,
        };
        _toggleExpFarmingCommand = new RelayCommand(() => _ = ToggleExpFarmingAsync(), () => !IsBusy);
    }

    public ObservableCollection<D4StatusTileViewModel> Tiles { get; }

    public ICommand ToggleExpFarmingCommand => _toggleExpFarmingCommand;

    /// <summary>Panel log line (UI thread); the page appends it to the log box.</summary>
    public event Action<string>? LogRequested;

    public bool IsExpFarmingRunning
    {
        get => _isExpFarmingRunning;
        private set { if (SetProperty(ref _isExpFarmingRunning, value)) RefreshStartStopText(); }
    }

    public bool IsBusy
    {
        get => _isBusy;
        private set
        {
            if (!SetProperty(ref _isBusy, value)) return;
            RefreshStartStopText();
            _toggleExpFarmingCommand.RaiseCanExecuteChanged();
        }
    }

    public string StartStopText { get => _startStopText; private set => SetProperty(ref _startStopText, value); }

    public string UpdatedAtText { get => _updatedAtText; private set => SetProperty(ref _updatedAtText, value); }

    /// <summary>Subscribe to live status updates and show the current state (page Loaded).</summary>
    public void Attach()
    {
        if (_attached) return;
        _attached = true;
        D4UiStatusUpdater.Instance.StatusUpdated += OnStatusUpdated;
        IsExpFarmingRunning = D4Controller.Instance.IsExpFarmingRunning();
        RefreshI18n();
        Apply(D4Controller.Instance.GetState());
    }

    /// <summary>Unsubscribe (page Unloaded).</summary>
    public void Detach()
    {
        if (!_attached) return;
        _attached = false;
        D4UiStatusUpdater.Instance.StatusUpdated -= OnStatusUpdated;
    }

    /// <summary>Re-read every label and value in the current language.</summary>
    public void RefreshI18n()
    {
        var p = D3D4TesterI18n.Provider;
        foreach (var tile in Tiles)
            tile.Label = p.GetUiText(tile.LabelKey);
        RefreshStartStopText();
        if (_lastSnapshot != null) Apply(_lastSnapshot);
    }

    private void OnStatusUpdated(D4StatusSnapshot snapshot)
    {
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher == null) return;
        dispatcher.BeginInvoke(() => Apply(snapshot));
    }

    private async Task ToggleExpFarmingAsync()
    {
        if (IsBusy) return;
        try
        {
            if (!D4Controller.Instance.IsExpFarmingRunning()) await StartExpFarmingAsync();
            else await StopExpFarmingAsync();
        }
        catch (Exception ex)
        {
            ColorPrinter.Red($"{LogPrefix} EXP Farming toggle failed: {ex.Message}");
        }
    }

    /// <summary>1:1 _start_exp_farming: capture + team check, abort only when no team, then start and persist.</summary>
    private async Task StartExpFarmingAsync()
    {
        var p = D3D4TesterI18n.Provider;
        IsBusy = true;
        try
        {
            Log(p.GetUiText(I18nKeys.D4TeamCheckChecking));
            ColorPrinter.Blue($"{LogPrefix} Checking team status before starting EXP farming");
            var result = await Task.Run(RunTeamCheck);
            if (result.HasTeam == false)
            {
                Log(p.GetUiText(I18nKeys.D4TeamCheckAbortNoTeam));
                ColorPrinter.Red($"{LogPrefix} No team detected, aborting start");
                return;
            }
            if (!result.Completed)
            {
                Log(p.GetUiText(I18nKeys.D4TeamCheckContinueWarning));
                ColorPrinter.Yellow($"{LogPrefix} Team check failed");
            }
            else if (result.HasTeam == null)
            {
                Log(p.GetUiText(I18nKeys.D4TeamCheckUnknown));
                ColorPrinter.Yellow($"{LogPrefix} Team status unknown");
            }
            else
            {
                Log(p.GetUiText(I18nKeys.D4TeamCheckHasTeam));
                ColorPrinter.Green($"{LogPrefix} Team detected");
            }

            D4Controller.Instance.StartExpFarming();
            IsExpFarmingRunning = true;
            PersistRunning(true);
            D4TickLoop.Instance.EnsureRunning();
            Apply(D4Controller.Instance.GetState());
            Log($"[{p.GetUiText(I18nKeys.D4ExpFarmingStatusRunning)}] {p.GetUiText(I18nKeys.D4PageLogStarted)}");
            ColorPrinter.Green($"{LogPrefix} EXP Farming started via UI");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private static D4TeamCheckResult RunTeamCheck()
    {
        var data = D4InterfaceData.Instance;
        ColorPrinter.Blue($"{LogPrefix} Capturing screenshot to initialize window data...");
        var result = D4Pipeline.Instance.CheckTeamFormation();
        if (data.WindowDetected)
            ColorPrinter.Green($"{LogPrefix} Window data initialized: fullscreen={data.FullscreenSize}, window={data.GameWindowSize}, windowed={data.IsWindowedMode()}");
        return result;
    }

    /// <summary>1:1 _stop_exp_farming: stop, reset shared data (debug window flags kept), refresh, persist.</summary>
    private async Task StopExpFarmingAsync()
    {
        var p = D3D4TesterI18n.Provider;
        IsBusy = true;
        try
        {
            D4Controller.Instance.StopExpFarming();
            IsExpFarmingRunning = false;
            await Task.Run(ResetKeepingDebugWindow);
            Apply(D4Controller.Instance.GetState());
            PersistRunning(false);
            Log($"[{p.GetUiText(I18nKeys.D4ExpFarmingStatusStopped)}] {p.GetUiText(I18nKeys.D4PageLogStopped)}");
            ColorPrinter.Yellow($"{LogPrefix} EXP Farming stopped via UI");
        }
        finally
        {
            IsBusy = false;
        }
    }

    private static void ResetKeepingDebugWindow()
    {
        var data = D4InterfaceData.Instance;
        bool debugOpen = data.DebugWindowOpen;
        bool debugPaused = data.DebugWindowPaused;
        D4Pipeline.Instance.Reset();
        data.DebugWindowOpen = debugOpen;
        data.DebugWindowPaused = debugPaused;
    }

    private static void PersistRunning(bool running)
    {
        var config = D3D4TesterConfigService.Instance;
        config.SetValueAsync(ConfigKeys.D4SettingsExpFarmingRunning, running);
        config.QueueSave();
    }

    private void Log(string message) => LogRequested?.Invoke(message);

    private void RefreshStartStopText()
    {
        var p = D3D4TesterI18n.Provider;
        StartStopText = IsBusy && !IsExpFarmingRunning
            ? p.GetUiText(I18nKeys.D4TeamCheckChecking)
            : p.GetUiText(IsExpFarmingRunning ? I18nKeys.D4ExpFarmingStopButton : I18nKeys.D4ExpFarmingStartButton);
    }

    /// <summary>Localized values + tones. 1:1 _update_status_from_data / _translate_status_value.</summary>
    private void Apply(D4StatusSnapshot s)
    {
        _lastSnapshot = s;
        var p = D3D4TesterI18n.Provider;
        string unknown = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusUnknown);
        string running = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusRunning);
        string stopped = p.GetUiText(I18nKeys.D4ExpFarmingGameStatusStopped);

        Set(_runningTile, s.ExpFarmingRunning ? running : stopped, s.ExpFarmingRunning ? D4StatusTone.Success : D4StatusTone.Neutral);
        switch (s.GameState)
        {
            case D4GameState.Running: Set(_gameStateTile, running, D4StatusTone.Success); break;
            case D4GameState.Active: Set(_gameStateTile, p.GetUiText(I18nKeys.D4StatusActive), D4StatusTone.Info); break;
            default: Set(_gameStateTile, stopped, D4StatusTone.Neutral); break;
        }
        switch (s.HasTeam)
        {
            case true: Set(_teamStatusTile, p.GetUiText(I18nKeys.D4TeamCheckHasTeam), D4StatusTone.Success); break;
            case false: Set(_teamStatusTile, p.GetUiText(I18nKeys.D4TeamCheckNoTeam), D4StatusTone.Danger); break;
            default: Set(_teamStatusTile, unknown, D4StatusTone.Neutral); break;
        }
        switch (s.LocationType)
        {
            case D4LocationType.Town: Set(_locationTile, p.GetUiText(I18nKeys.D4LocationTown), D4StatusTone.Info); break;
            case D4LocationType.Dungeon: Set(_locationTile, p.GetUiText(I18nKeys.D4LocationDungeon), D4StatusTone.Warning); break;
            default: Set(_locationTile, p.GetUiText(I18nKeys.D4LocationUnknown), D4StatusTone.Neutral); break;
        }
        Set(_mapTile, s.CurrentMap ?? unknown, D4StatusTone.Plain);
        Set(_teamCountTile, $"{s.TeamTotal} ({s.TeamLocal}/{s.TeamNonLocal})", D4StatusTone.Plain);
        Set(_dungeonTile, s.DungeonProgress ?? unknown, D4StatusTone.Plain);
        Set(_tickTile, s.TickCount.ToString(), D4StatusTone.Plain);
        Set(_coordsTile, s.ScreenCoordinates is { } c ? $"({c.X}, {c.Y})" : unknown, D4StatusTone.Plain);
        string mode = p.GetUiText(s.IsWindowed ? I18nKeys.D4ExpFarmingGameStatusWindowed : I18nKeys.D4ExpFarmingGameStatusFullscreen);
        Set(_sizeTile, s.ScreenSize is { } z ? $"{z.Width}x{z.Height} ({mode})" : unknown, D4StatusTone.Plain);
        Set(_switchCountTile, s.MapSwitchCount.ToString(), D4StatusTone.Plain);
        switch (s.MapSwitchState)
        {
            case D4MapSwitchState.Switching: Set(_switchStateTile, p.GetUiText(I18nKeys.D4MapStateSwitching), D4StatusTone.Warning); break;
            case D4MapSwitchState.PostSwitch: Set(_switchStateTile, p.GetUiText(I18nKeys.D4MapStatePostSwitch), D4StatusTone.Info); break;
            default: Set(_switchStateTile, p.GetUiText(I18nKeys.D4MapStateNormal), D4StatusTone.Neutral); break;
        }
        UpdatedAtText = string.Format(p.GetUiText(I18nKeys.D4StatusUpdatedAt), s.Timestamp.ToString(TimeFormat));
    }

    private static void Set(D4StatusTileViewModel tile, string value, D4StatusTone tone)
    {
        tile.Value = value;
        tile.Tone = tone;
    }
}
