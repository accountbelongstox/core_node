// PY-REF: none (DOT-only)
using System.Text.Json;
using DotCore.Foundations;
using DotCore.MinimapPath;
using DotCore.Utils.ImagePreprocess;
using DotCore.YoloDetect;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>
/// Evaluation output of one session in {D4 tmp}/d4_agent/{start time}: one JSON line per frame (state, action, reason, vitals, map,
/// detection counts), optional annotated frames plus the minimap walkable mask for calibration, and summary.json with per-class
/// statistics (flicker = detections the tracker did not confirm, the false-positive hint of an offline replay) and state shares.
/// </summary>
public sealed class D4AgentSessionLog : IDisposable
{
    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = true };
    private static readonly Scalar OverlayColor = new(0, 255, 255);
    private static readonly Scalar AnchorColor = new(255, 0, 255);
    private static readonly Scalar TargetColor = new(0, 0, 255);
    private static readonly Scalar PlannedPathColor = new(255, 128, 0);

    private sealed class ClassCounter
    {
        public long Detections;
        public long Frames;
        public double ConfidenceSum;
        public long Flicker;
    }

    private readonly D4AgentSettings _settings;
    private readonly string _modelPath;
    private readonly DateTime _started = DateTime.Now;
    private readonly StreamWriter _writer;
    private readonly Dictionary<string, ClassCounter> _classes = new(StringComparer.Ordinal);
    private readonly Dictionary<string, long> _states = new(StringComparer.Ordinal);
    private double _fpsSum;
    private double _inferenceSum;
    private long _frames;

    public D4AgentSessionLog(D4AgentSettings settings, string modelPath)
    {
        _settings = settings;
        _modelPath = modelPath;
        SessionDir = Path.Combine(D4Constants.TmpDir, D4AgentConstants.OutputDirName, _started.ToString(D4AgentConstants.SessionDirFormat));
        Directory.CreateDirectory(SessionDir);
        _writer = new StreamWriter(Path.Combine(SessionDir, D4AgentConstants.DecisionsFileName)) { AutoFlush = false };
    }

    public string SessionDir { get; }

    public void Record(D4Observation o, D4AgentDecision decision, bool acted, double fps, double inferenceMs)
    {
        _frames++;
        _fpsSum += fps;
        _inferenceSum += inferenceMs;
        _states[decision.State.ToString()] = _states.GetValueOrDefault(decision.State.ToString()) + 1;
        foreach (var group in o.Detections.GroupBy(d => d.ClassName))
        {
            var c = _classes.TryGetValue(group.Key, out var existing) ? existing : _classes[group.Key] = new ClassCounter();
            int count = group.Count();
            c.Detections += count;
            c.Frames++;
            c.ConfidenceSum += group.Sum(d => (double)d.Confidence);
            c.Flicker += Math.Max(0, count - o.Confirmed(group.Key).Count());
        }
        var line = new
        {
            frame = o.FrameIndex,
            t = Math.Round(o.Timestamp.TotalSeconds, 3),
            state = decision.State.ToString(),
            action = decision.Action.ToString(),
            key = decision.Key,
            target = decision.Target is { } p ? new[] { p.X, p.Y } : null,
            track = decision.TrackId,
            reason = decision.Reason,
            acted,
            health = o.Vitals.Health is { } h ? Math.Round(h, 3) : (double?)null,
            skills = o.Vitals.SkillReady,
            pos = new[] { Math.Round(o.Map.Position.X, 1), Math.Round(o.Map.Position.Y, 1) },
            odometry = o.Map.Reliable,
            frontiers = o.Map.FrontierCount,
            route_waypoints = o.Route?.Route.Waypoints.Count ?? 0,
            route_planned = o.Route?.Planned ?? false,
            route_heading = o.Route?.Route.HeadingDegrees is { } heading ? Math.Round(heading, 1) : (double?)null,
            detections = o.Detections.GroupBy(d => d.ClassName).ToDictionary(g => g.Key, g => g.Count()),
            inference_ms = Math.Round(inferenceMs, 1),
        };
        _writer.WriteLine(JsonSerializer.Serialize(line));
    }

    /// <summary>Annotated copy of the frame (tracks, hero anchor, decision target, state line); caller disposes.</summary>
    public static Mat Annotate(Mat image, D4Observation o, D4AgentDecision decision)
    {
        var annotated = YoloOnnxDetector.Annotate(image, o.Tracks);
        if (o.Route is { } route)
        {
            MinimapRouteAnnotator.DrawInto(annotated, route.Route);
            for (int i = 0; i < route.PlannedPath.Count - 1; i++)
                Cv2.Line(annotated, route.PlannedPath[i], route.PlannedPath[i + 1], PlannedPathColor, 1);
        }
        Cv2.Circle(annotated, o.PlayerAnchor, 6, AnchorColor, 2);
        if (decision.Target is { } target)
        {
            Cv2.Line(annotated, o.PlayerAnchor, target, TargetColor, 2);
            Cv2.Circle(annotated, target, 8, TargetColor, 2);
        }
        string health = o.Vitals.Health is { } h ? $"{h:P0}" : "-";
        Cv2.PutText(annotated, $"{decision.State} {decision.Action} | HP {health} | {decision.Reason}", new Point(10, 28),
            HersheyFonts.HersheySimplex, 0.7, OverlayColor, 2);
        return annotated;
    }

    public void SaveDebugFrame(Mat annotated, Mat? minimapMask, long frameIndex)
    {
        string name = $"{frameIndex:D6}";
        ImageConvert.SaveMat(annotated, Path.Combine(SessionDir, D4AgentConstants.FramePrefix + name + D4Constants.ImageExtension));
        if (minimapMask != null && !minimapMask.Empty())
            ImageConvert.SaveMat(minimapMask, Path.Combine(SessionDir, D4AgentConstants.MinimapMaskPrefix + name + D4Constants.ImageExtension));
    }

    public D4AgentSummary Finish(D4AgentCounters counters, string endReason)
    {
        _writer.Flush();
        var classes = _classes.OrderByDescending(c => c.Value.Detections)
            .Select(c => new D4ClassStats(c.Key, c.Value.Detections, c.Value.Frames,
                c.Value.Detections > 0 ? Math.Round(c.Value.ConfidenceSum / c.Value.Detections, 3) : 0, c.Value.Flicker))
            .ToList();
        var summary = new D4AgentSummary(SessionDir, _settings.Source, _settings.Mode, _modelPath, _started,
            Math.Round((DateTime.Now - _started).TotalSeconds, 1),
            _frames > 0 ? Math.Round(_fpsSum / _frames, 2) : 0, _frames > 0 ? Math.Round(_inferenceSum / _frames, 1) : 0,
            counters, new Dictionary<string, long>(_states), classes, endReason);
        try
        {
            File.WriteAllText(Path.Combine(SessionDir, D4AgentConstants.SummaryFileName), JsonSerializer.Serialize(summary, JsonOptions));
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            ColorPrinter.Yellow($"{D4AgentConstants.LogTag} Summary not saved: {ex.Message}");
        }
        return summary;
    }

    public void Dispose() => _writer.Dispose();
}
