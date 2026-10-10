// PY-REF: none (DOT-only)
using DotCore.YoloDetect;
using OpenCvSharp;

namespace DotApps.d3d4tester.Core.D4.Agent;

/// <summary>Decision states in priority order (death first, exploration last).</summary>
public enum D4AgentState
{
    Idle,
    Dead,
    LowHealth,
    Evade,
    Menu,
    FightBoss,
    FightElite,
    FightMonster,
    Loot,
    Interact,
    FollowRoute,
    Explore,
    Stuck,
}

public enum D4ActionKind
{
    None,
    Move,
    Attack,
    Pickup,
    Interact,
    PressKey,
}

/// <summary>Where frames come from and whether the agent may send input (video and observe never do).</summary>
public sealed record D4AgentSettings
{
    public string Source { get; init; } = D4AgentConstants.SourceLive;
    public string VideoPath { get; init; } = "";
    public int VideoFrameStep { get; init; } = 1;
    public string Mode { get; init; } = D4AgentConstants.ModeObserve;
    public string ModelPath { get; init; } = "";
    public float Confidence { get; init; } = 0.4f;
    public double TargetFps { get; init; } = 8;
    public double LowHealthRatio { get; init; } = 0.35;
    public IReadOnlyList<string> SkillKeys { get; init; } = Array.Empty<string>();
    public int SkillMinIntervalMs { get; init; } = 400;
    public string PotionKey { get; init; } = "q";
    public double PotionCooldownSec { get; init; } = 10;
    public string MenuCloseKey { get; init; } = "esc";
    public bool PickupLoot { get; init; } = true;
    public bool Explore { get; init; } = true;
    public double MinimapRotationDeg { get; init; }
    public int WalkableValueMin { get; init; } = 60;
    public int WalkableValueMax { get; init; } = 210;
    public int WalkableSaturationMax { get; init; } = 45;
    public int DebugFrameEvery { get; init; }
    public int MaxMinutes { get; init; }

    public bool IsVideo => Source == D4AgentConstants.SourceVideo;

    public bool MayAct => !IsVideo && Mode == D4AgentConstants.ModeAct;
}

/// <summary>Health ratio (0..1, null = globe not readable), per-slot skill readiness and the death-screen flag.</summary>
public sealed record D4Vitals(double? Health, IReadOnlyList<bool> SkillReady, bool DeathScreen, double MeanSaturation);

/// <summary>Map tracking result: hero position in map pixels, the last odometry step, its reliability and exploration counts.</summary>
public sealed record D4MapStatus(Point2d Position, Point2d Step, bool Reliable, int FreeCells, int FrontierCount);

/// <summary>One frame of perception: client size, detections, confirmed tracks, vitals, map, the hero screen anchor and the pinned route.</summary>
public sealed record D4Observation(
    long FrameIndex,
    TimeSpan Timestamp,
    Size ClientSize,
    IReadOnlyList<YoloDetection> Detections,
    IReadOnlyList<YoloTrack> Tracks,
    D4Vitals Vitals,
    D4MapStatus Map,
    Point PlayerAnchor,
    D4RouteStatus? Route = null)
{
    public IEnumerable<YoloTrack> Confirmed(params string[] classes) =>
        Tracks.Where(t => t.Misses == 0 && t.Hits >= D4AgentConstants.TrackerMinHits && classes.Contains(t.ClassName));
}

/// <summary>What the brain wants done: client-relative target point, key, the track it is about and a log reason.</summary>
public sealed record D4AgentDecision(D4AgentState State, D4ActionKind Action, Point? Target, string? Key, int? TrackId, string Reason)
{
    public static D4AgentDecision Idle(string reason) => new(D4AgentState.Idle, D4ActionKind.None, null, null, null, reason);
}

/// <summary>Snapshot raised after every processed frame (preview is a downscaled annotated copy owned by the receiver, or null).</summary>
public sealed record D4AgentFrameReport(
    D4Observation Observation,
    D4AgentDecision Decision,
    bool Acted,
    double Fps,
    double InferenceMs,
    D4AgentCounters Counters,
    Mat? Preview);

/// <summary>Running totals of a session.</summary>
public sealed record D4AgentCounters(long Frames, long Actions, long Deaths, long StuckEvents, long LootPicked, long LootAbandoned, long FramesWithEnemies);

/// <summary>Per-class detection statistics of a session (flicker = detections not confirmed by the tracker, a false-positive hint).</summary>
public sealed record D4ClassStats(string ClassName, long Detections, long FramesWithClass, double MeanConfidence, long Flicker);

public sealed record D4AgentSummary(
    string SessionDir,
    string Source,
    string Mode,
    string ModelPath,
    DateTime StartedAt,
    double DurationSec,
    double MeanFps,
    double MeanInferenceMs,
    D4AgentCounters Counters,
    IReadOnlyDictionary<string, long> StateFrames,
    IReadOnlyList<D4ClassStats> Classes,
    string EndReason);
