// PY-REF: none (DOT-only)
using System.Diagnostics;
using DotApps.d3d4tester.Core.Flow;
using DotCore.Foundations;
using DotCore.YoloDetect;
using DotCore.YoloTrain;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

public enum D4AgentFailure
{
    NoModel,
    ModelMissingClasses,
    ModelFileMissing,
    VideoUnreadable,
    Error,
}

/// <summary>
/// D4 vision agent (automated gameplay test): a closed loop of capture (live window or recorded video) -> YOLO detection + tracking ->
/// HUD vitals, minimap tracking and pinned-route guidance -> state machine decision -> Windows input, re-observing after every action. Video sources and
/// observe mode never send input (watch-only first, as the rollout plan requires). Runs on its own <see cref="FlowThread"/>;
/// every session writes an evaluation log (<see cref="D4AgentSessionLog"/>). The model is the configured path or the registry's
/// current "d4_agent" model.
/// </summary>
public sealed class D4VisionAgent
{
    private const string ThreadName = "D4Agent";
    private const string EndStopped = "stopped";
    private const string EndVideoFinished = "video finished";
    private const string EndTimeLimit = "time limit";
    private const double FpsSmoothing = 0.2;

    private readonly object _lock = new();
    private FlowThread? _thread;

    private D4VisionAgent() { }

    public static D4VisionAgent Instance { get; } = new();

    public bool IsRunning
    {
        get { lock (_lock) return _thread?.IsRunning == true; }
    }

    /// <summary>Raised on the agent thread after every frame (the receiver owns and disposes the preview).</summary>
    public event Action<D4AgentFrameReport>? FrameProcessed;

    public event Action<D4AgentSummary>? Finished;

    public event Action<D4AgentFailure, string>? Failed;

    /// <summary>Model the agent would use: the configured path, else the registry's current d4_agent model (with class check).</summary>
    public static YoloModelResolution ResolveModel(string? configuredPath) =>
        string.IsNullOrWhiteSpace(configuredPath)
            ? YoloModelRegistry.Default.Resolve(D4AgentConstants.ModelConsumer, D4AgentClasses.Required)
            : YoloModelRegistry.Check(Path.GetFullPath(configuredPath.Trim()), D4AgentClasses.Required);

    /// <summary>Make a model the registry's current d4_agent model; refused when it lacks the required classes.</summary>
    public static YoloModelResolution SetCurrentModel(string modelPath)
    {
        var check = YoloModelRegistry.Check(Path.GetFullPath(modelPath), D4AgentClasses.Required);
        if (check.IsOk) YoloModelRegistry.Default.SetCurrent(D4AgentConstants.ModelConsumer, check.ModelPath);
        return check;
    }

    /// <summary>Start a session; false when one is already running.</summary>
    public bool Start(D4AgentSettings settings)
    {
        lock (_lock)
        {
            if (_thread?.IsRunning == true) return false;
            FlowThread? thread = null;
            thread = new FlowThread(ThreadName, ctx =>
            {
                try
                {
                    RunSession(ctx, settings);
                }
                finally
                {
                    thread!.Stop();
                }
            });
            _thread = thread;
            thread.Start();
            return true;
        }
    }

    public void Stop()
    {
        lock (_lock) _thread?.Stop();
    }

    private void RunSession(FlowContext ctx, D4AgentSettings s)
    {
        var resolution = ResolveModel(s.ModelPath);
        if (!resolution.IsOk || resolution.ModelPath == null)
        {
            var failure = resolution.Status switch
            {
                YoloModelResolveStatus.MissingClasses => D4AgentFailure.ModelMissingClasses,
                YoloModelResolveStatus.FileMissing => D4AgentFailure.ModelFileMissing,
                _ => D4AgentFailure.NoModel,
            };
            string detail = resolution.MissingClasses.Count > 0 ? string.Join(", ", resolution.MissingClasses) : resolution.ModelPath ?? "";
            ColorPrinter.Yellow($"{D4AgentConstants.LogTag} No usable model ({resolution.Status}): {detail}");
            Failed?.Invoke(failure, detail);
            return;
        }

        ID4FrameSource source;
        try
        {
            source = s.IsVideo ? new D4VideoFrameSource(s.VideoPath, s.VideoFrameStep) : new D4LiveFrameSource();
        }
        catch (Exception ex) when (ex is FileNotFoundException or InvalidOperationException)
        {
            ColorPrinter.Yellow($"{D4AgentConstants.LogTag} {ex.Message}");
            Failed?.Invoke(D4AgentFailure.VideoUnreadable, s.VideoPath);
            return;
        }

        try
        {
            using (source)
            using (var lease = YoloModelHost.Shared.Acquire(resolution.ModelPath))
            {
                Loop(ctx, s, source, lease);
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            ColorPrinter.Red($"{D4AgentConstants.LogTag} {ex.GetType().Name}: {ex.Message}");
            Failed?.Invoke(D4AgentFailure.Error, ex.Message);
        }
    }

    private void Loop(FlowContext ctx, D4AgentSettings s, ID4FrameSource source, YoloModelLease lease)
    {
        var detector = lease.Detector;
        var inference = YoloArtifacts.RunDirOfModel(lease.ModelPath) is { } runDir ? YoloRunInfo.Load(runDir)?.Inference : null;
        var profile = YoloInferenceProfile.FromInference(inference) with { Confidence = s.Confidence };
        var tracker = new YoloFrameTracker(new YoloTrackerOptions(MinHits: D4AgentConstants.TrackerMinHits,
            MaxMisses: D4AgentConstants.TrackerMaxMisses, HighConfidence: s.Confidence, LowConfidence: s.Confidence / 2));
        var vitals = new D4VitalsReader();
        using var map = new D4MinimapTracker(s);
        var routeGuide = new D4RouteGuide(s);
        var brain = new D4AgentBrain(s, map);
        var actuator = new D4AgentActuator();
        using var log = new D4AgentSessionLog(s, lease.ModelPath);

        ColorPrinter.Green($"{D4AgentConstants.LogTag} Session started: source={s.Source} mode={s.Mode} model={lease.ModelPath} classes={string.Join(",", detector.ClassNames)}");
        ColorPrinter.Blue($"{D4AgentConstants.LogTag} Output: {log.SessionDir}");
        if (!s.MayAct) ColorPrinter.Blue($"{D4AgentConstants.LogTag} Observe only: no input is sent");
        else D4Manager.Instance.ActivateWindow();

        var deadline = s.MaxMinutes > 0 ? DateTime.UtcNow.AddMinutes(s.MaxMinutes) : (DateTime?)null;
        var clock = Stopwatch.StartNew();
        var watch = new Stopwatch();
        long frames = 0, actions = 0, enemyFrames = 0;
        double lastTickMs = -1, intervalEma = 0, lastPreviewMs = double.NegativeInfinity;
        D4AgentState? lastState = null;
        string endReason = EndStopped;
        try
        {
            while (true)
            {
                ctx.ThrowIfStopped();
                if (deadline is { } d && DateTime.UtcNow >= d)
                {
                    endReason = EndTimeLimit;
                    break;
                }
                double tickStart = clock.Elapsed.TotalMilliseconds;
                using var frame = source.Next();
                if (frame == null)
                {
                    if (source.IsFinite)
                    {
                        endReason = EndVideoFinished;
                        break;
                    }
                    ctx.Wait(D4AgentConstants.LiveNoWindowWaitMs / 1000.0);
                    continue;
                }

                watch.Restart();
                var detections = detector.DetectTimed(frame.Image, profile).Detections;
                double inferenceMs = watch.Elapsed.TotalMilliseconds;
                var tracks = tracker.Update(detections);
                var observation = new D4Observation(frames, frame.Timestamp, new Size(frame.Image.Width, frame.Image.Height), detections, tracks,
                    vitals.Read(frame), map.Update(frame),
                    new Point((int)(frame.Image.Width * D4AgentConstants.PlayerAnchorX), (int)(frame.Image.Height * D4AgentConstants.PlayerAnchorY)),
                    routeGuide.Update(frame));
                var decision = brain.Decide(observation);
                bool acted = s.MayAct && actuator.Execute(decision, frame);
                if (acted)
                {
                    brain.MarkExecuted(decision);
                    actions++;
                }
                frames++;
                if (observation.Confirmed(D4AgentClasses.Enemies).Any()) enemyFrames++;
                if (decision.State != lastState)
                {
                    lastState = decision.State;
                    ColorPrinter.Blue($"{D4AgentConstants.LogTag} #{observation.FrameIndex} {decision.State}: {decision.Reason}");
                }

                double now = clock.Elapsed.TotalMilliseconds;
                if (lastTickMs >= 0) intervalEma = intervalEma <= 0 ? now - lastTickMs : intervalEma + FpsSmoothing * (now - lastTickMs - intervalEma);
                lastTickMs = now;
                double fps = intervalEma > 0 ? 1000.0 / intervalEma : 0;
                log.Record(observation, decision, acted, fps, inferenceMs);

                bool debugFrame = s.DebugFrameEvery > 0 && observation.FrameIndex % s.DebugFrameEvery == 0;
                bool preview = FrameProcessed != null && now - lastPreviewMs >= D4AgentConstants.PreviewIntervalMs;
                Mat? previewImage = null;
                if (debugFrame || preview)
                {
                    using var annotated = D4AgentSessionLog.Annotate(frame.Image, observation, decision);
                    if (debugFrame) log.SaveDebugFrame(annotated, map.LastMask, observation.FrameIndex);
                    if (preview)
                    {
                        lastPreviewMs = now;
                        previewImage = Downscale(annotated);
                    }
                }
                var counters = new D4AgentCounters(frames, actions, brain.Deaths, brain.StuckEvents, brain.LootPicked, brain.LootAbandoned, enemyFrames);
                FrameProcessed?.Invoke(new D4AgentFrameReport(observation, decision, acted, fps, inferenceMs, counters, previewImage));

                if (!source.IsFinite && s.TargetFps > 0)
                {
                    double wait = 1000.0 / s.TargetFps - (clock.Elapsed.TotalMilliseconds - tickStart);
                    if (wait > 0) ctx.Wait(wait / 1000.0);
                }
            }
        }
        catch (OperationCanceledException)
        {
            endReason = EndStopped;
        }

        var summary = log.Finish(new D4AgentCounters(frames, actions, brain.Deaths, brain.StuckEvents, brain.LootPicked, brain.LootAbandoned, enemyFrames), endReason);
        ColorPrinter.Green($"{D4AgentConstants.LogTag} Session ended ({endReason}): {frames} frames, {actions} actions, {summary.MeanFps} fps, summary {Path.Combine(log.SessionDir, D4AgentConstants.SummaryFileName)}");
        Finished?.Invoke(summary);
    }

    private static Mat Downscale(Mat image)
    {
        if (image.Width <= D4AgentConstants.PreviewMaxWidth) return image.Clone();
        double scale = D4AgentConstants.PreviewMaxWidth / (double)image.Width;
        var small = new Mat();
        Cv2.Resize(image, small, new Size(D4AgentConstants.PreviewMaxWidth, (int)(image.Height * scale)), interpolation: InterpolationFlags.Area);
        return small;
    }
}
