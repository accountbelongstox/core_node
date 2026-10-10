// PY-REF: none (DOT-only)
using System.Collections.ObjectModel;
using System.Globalization;
using System.Text;
using System.Windows.Media.Imaging;
using System.Windows.Threading;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.D4.Agent;
using DotApps.d3d4tester.I18n;
using DotApps.d3d4tester.Ui;
using DotApps.d3d4tester.ViewModels.Base;
using DotCore.YoloTrain;

namespace DotApps.d3d4tester.ViewModels;

/// <summary>
/// D4 vision agent sub-tab: start / stop with the live d4_agent settings, model status, status tiles and preview fed by
/// <see cref="D4VisionAgent"/> (latest frame kept from the agent thread, applied on the UI thread every refresh tick).
/// </summary>
public sealed class D4AgentViewModel : BaseViewModel
{
    private const int RefreshIntervalMs = 250;
    private const string StatePrefixSeparator = "_";
    private const char CountSeparator = ':';

    private readonly DispatcherTimer _refresh;
    private double _lowHealthRatio;
    private D4AgentFrameReport? _latest;
    private BitmapSource? _latestPreview;
    private bool _isRunning;
    private string _modelStatus = "";
    private D4StatusTone _modelTone = D4StatusTone.Neutral;
    private BitmapSource? _preview;
    private bool _attached;

    private readonly D4StatusTileViewModel _tileState = new(I18nKeys.D4AgentTileState, "");
    private readonly D4StatusTileViewModel _tileHealth = new(I18nKeys.D4AgentTileHealth, "");
    private readonly D4StatusTileViewModel _tileFps = new(I18nKeys.D4AgentTileFps, "");
    private readonly D4StatusTileViewModel _tileDetections = new(I18nKeys.D4AgentTileDetections, "");
    private readonly D4StatusTileViewModel _tileOdometry = new(I18nKeys.D4AgentTileOdometry, "");
    private readonly D4StatusTileViewModel _tilePosition = new(I18nKeys.D4AgentTilePosition, "");
    private readonly D4StatusTileViewModel _tileFrontiers = new(I18nKeys.D4AgentTileFrontiers, "");
    private readonly D4StatusTileViewModel _tileActions = new(I18nKeys.D4AgentTileActions, "");
    private readonly D4StatusTileViewModel _tileDeaths = new(I18nKeys.D4AgentTileDeaths, "");
    private readonly D4StatusTileViewModel _tileStuck = new(I18nKeys.D4AgentTileStuck, "");
    private readonly D4StatusTileViewModel _tileLoot = new(I18nKeys.D4AgentTileLoot, "");
    private readonly D4StatusTileViewModel _tileFrames = new(I18nKeys.D4AgentTileFrames, "");

    public D4AgentViewModel()
    {
        Tiles = new ObservableCollection<D4StatusTileViewModel>
        {
            _tileState, _tileHealth, _tileFps, _tileDetections, _tileOdometry, _tilePosition,
            _tileFrontiers, _tileActions, _tileDeaths, _tileStuck, _tileLoot, _tileFrames,
        };
        ToggleCommand = new RelayCommand(Toggle);
        _refresh = new DispatcherTimer { Interval = TimeSpan.FromMilliseconds(RefreshIntervalMs) };
        _refresh.Tick += (_, _) => ApplyLatest();
    }

    public ObservableCollection<D4StatusTileViewModel> Tiles { get; }

    public RelayCommand ToggleCommand { get; }

    public event Action<string>? LogRequested;

    public bool IsRunning
    {
        get => _isRunning;
        private set
        {
            if (SetProperty(ref _isRunning, value)) RaisePropertyChanged(nameof(StartStopText));
        }
    }

    public string StartStopText => T(IsRunning ? I18nKeys.D4AgentStop : I18nKeys.D4AgentStart);

    public string RunningText => T(IsRunning ? I18nKeys.D4AgentRunning : I18nKeys.D4AgentStopped);

    public string ModelStatus { get => _modelStatus; private set => SetProperty(ref _modelStatus, value); }

    public D4StatusTone ModelTone { get => _modelTone; private set => SetProperty(ref _modelTone, value); }

    public BitmapSource? Preview { get => _preview; private set => SetProperty(ref _preview, value); }

    /// <summary>Model path that a start would use (configured or registry current), for the model tester; null when none.</summary>
    public string? ResolvedModelPath => D4VisionAgent.ResolveModel(D4AgentOptions.ReadLive().ModelPath).ModelPath;

    public void Attach()
    {
        if (_attached) return;
        _attached = true;
        var agent = D4VisionAgent.Instance;
        agent.FrameProcessed += OnFrame;
        agent.Finished += OnFinished;
        agent.Failed += OnFailed;
        IsRunning = agent.IsRunning;
        RaisePropertyChanged(nameof(RunningText));
        _refresh.Start();
        RefreshI18n();
    }

    public void Detach()
    {
        if (!_attached) return;
        _attached = false;
        var agent = D4VisionAgent.Instance;
        agent.FrameProcessed -= OnFrame;
        agent.Finished -= OnFinished;
        agent.Failed -= OnFailed;
        _refresh.Stop();
    }

    public void RefreshI18n()
    {
        foreach (var tile in Tiles) tile.Label = T(tile.LabelKey);
        RaisePropertyChanged(nameof(StartStopText));
        RaisePropertyChanged(nameof(RunningText));
        RefreshModelStatus();
        if (_latest == null) ResetTiles();
    }

    public void RefreshModelStatus()
    {
        var resolution = D4VisionAgent.ResolveModel(D4AgentOptions.ReadLive().ModelPath);
        (ModelStatus, ModelTone) = resolution.Status switch
        {
            YoloModelResolveStatus.Ok => (F(I18nKeys.D4AgentModelCurrent, resolution.ModelPath ?? ""), D4StatusTone.Success),
            YoloModelResolveStatus.MissingClasses => (F(I18nKeys.D4AgentModelMissingClasses, string.Join(", ", resolution.MissingClasses)), D4StatusTone.Danger),
            YoloModelResolveStatus.FileMissing => (F(I18nKeys.D4AgentModelFileMissing, resolution.ModelPath ?? ""), D4StatusTone.Danger),
            _ => (T(I18nKeys.D4AgentModelNone), D4StatusTone.Warning),
        };
    }

    private void Toggle()
    {
        var agent = D4VisionAgent.Instance;
        if (agent.IsRunning)
        {
            agent.Stop();
            return;
        }
        var settings = D4AgentOptions.ReadLive();
        if (settings.IsVideo && string.IsNullOrWhiteSpace(settings.VideoPath))
        {
            Log(T(I18nKeys.D4AgentLogNoVideo));
            return;
        }
        if (settings.Mode == D4AgentConstants.ModeAct)
            Log(T(settings.IsVideo ? I18nKeys.D4AgentLogVideoObserveOnly : I18nKeys.D4AgentLogActWarning));
        _latest = null;
        _lowHealthRatio = settings.LowHealthRatio;
        if (!agent.Start(settings))
        {
            Log(T(I18nKeys.D4AgentLogAlreadyRunning));
            return;
        }
        ResetTiles();
        Log(F(I18nKeys.D4AgentLogStarted, T(settings.IsVideo ? I18nKeys.D4AgentSourceVideo : I18nKeys.D4AgentSourceLive),
            T(settings.MayAct ? I18nKeys.D4AgentModeAct : I18nKeys.D4AgentModeObserve)));
        IsRunning = true;
        RaisePropertyChanged(nameof(RunningText));
    }

    /// <summary>Agent thread: keep the newest report and its preview (decoded here, frozen) for the next UI tick.</summary>
    private void OnFrame(D4AgentFrameReport report)
    {
        if (report.Preview is { } mat)
        {
            using (mat) Volatile.Write(ref _latestPreview, MatImageSource.ToBitmapSource(mat));
        }
        Volatile.Write(ref _latest, report);
    }

    private void OnFinished(D4AgentSummary summary) =>
        Ui(() =>
        {
            Log(F(I18nKeys.D4AgentLogFinished, summary.EndReason, summary.Counters.Frames, summary.Counters.Actions, summary.MeanFps, summary.SessionDir));
            SetStopped();
        });

    private void OnFailed(D4AgentFailure failure, string detail) =>
        Ui(() =>
        {
            Log(failure switch
            {
                D4AgentFailure.NoModel => T(I18nKeys.D4AgentFailNoModel),
                D4AgentFailure.ModelMissingClasses => F(I18nKeys.D4AgentFailMissingClasses, detail),
                D4AgentFailure.ModelFileMissing => F(I18nKeys.D4AgentFailModelFileMissing, detail),
                D4AgentFailure.VideoUnreadable => F(I18nKeys.D4AgentFailVideo, detail),
                _ => F(I18nKeys.D4AgentFailError, detail),
            });
            SetStopped();
        });

    private void SetStopped()
    {
        IsRunning = false;
        RaisePropertyChanged(nameof(RunningText));
    }

    private void ApplyLatest()
    {
        if (IsRunning != D4VisionAgent.Instance.IsRunning && !D4VisionAgent.Instance.IsRunning) SetStopped();
        if (Interlocked.Exchange(ref _latestPreview, null) is { } image) Preview = image;
        if (Interlocked.Exchange(ref _latest, null) is not { } r) return;
        var o = r.Observation;
        var c = r.Counters;
        _tileState.Value = StateText(r.Decision.State);
        _tileState.Tone = r.Decision.State switch
        {
            D4AgentState.Dead or D4AgentState.LowHealth or D4AgentState.Stuck => D4StatusTone.Danger,
            D4AgentState.Evade or D4AgentState.FightBoss or D4AgentState.FightElite => D4StatusTone.Warning,
            D4AgentState.Idle => D4StatusTone.Neutral,
            _ => D4StatusTone.Info,
        };
        _tileHealth.Value = o.Vitals.Health is { } h ? h.ToString("P0", CultureInfo.CurrentCulture) : "-";
        _tileHealth.Tone = o.Vitals.Health is { } hv && hv < _lowHealthRatio ? D4StatusTone.Danger : D4StatusTone.Plain;
        _tileFps.Value = $"{r.Fps:0.0} / {r.InferenceMs:0} ms";
        _tileDetections.Value = o.Detections.Count == 0 ? "0" : DetectionSummary(o);
        _tileOdometry.Value = T(o.Map.Reliable ? I18nKeys.D4AgentOdometryOk : I18nKeys.D4AgentOdometryLost);
        _tileOdometry.Tone = o.Map.Reliable ? D4StatusTone.Success : D4StatusTone.Warning;
        _tilePosition.Value = $"{o.Map.Position.X:0}, {o.Map.Position.Y:0}";
        _tileFrontiers.Value = $"{o.Map.FreeCells} / {o.Map.FrontierCount}";
        _tileActions.Value = I(c.Actions);
        _tileDeaths.Value = I(c.Deaths);
        _tileStuck.Value = I(c.StuckEvents);
        _tileLoot.Value = $"{I(c.LootPicked)} / {I(c.LootAbandoned)}";
        _tileFrames.Value = I(c.Frames);
    }

    private void ResetTiles()
    {
        foreach (var tile in Tiles)
        {
            tile.Value = "-";
            tile.Tone = D4StatusTone.Plain;
        }
        _tileState.Value = StateText(D4AgentState.Idle);
        Preview = null;
    }

    private static string DetectionSummary(D4Observation o)
    {
        var sb = new StringBuilder();
        foreach (var g in o.Detections.GroupBy(d => d.ClassName).OrderByDescending(g => g.Count()))
        {
            if (sb.Length > 0) sb.Append(' ');
            sb.Append(g.Key).Append(CountSeparator).Append(g.Count());
        }
        return sb.ToString();
    }

    /// <summary>i18n state name: FightBoss -> state.fight_boss.</summary>
    private static string StateText(D4AgentState state)
    {
        var name = string.Concat(state.ToString().Select((ch, i) => i > 0 && char.IsUpper(ch) ? StatePrefixSeparator + char.ToLowerInvariant(ch) : char.ToLowerInvariant(ch).ToString()));
        return T(I18nKeys.D4AgentStatePrefix + name);
    }

    private void Log(string message) => LogRequested?.Invoke($"[{DateTime.Now:HH:mm:ss}] {message}");

    private static void Ui(Action action)
    {
        var dispatcher = System.Windows.Application.Current?.Dispatcher;
        if (dispatcher == null || dispatcher.CheckAccess()) action();
        else dispatcher.BeginInvoke(action);
    }

    private static string I(long value) => value.ToString(CultureInfo.InvariantCulture);

    private static string T(string key) => D3D4TesterI18n.Provider.GetUiText(key);

    private static string F(string key, params object[] args) => string.Format(CultureInfo.CurrentCulture, T(key), args);
}
