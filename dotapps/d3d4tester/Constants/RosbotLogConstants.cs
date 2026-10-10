// PY-REF: pyapps/d3-check/d3utils/log_analyzer.py
// PY-REF: pyapps/d3-check/providor/constants/common.py
namespace DotApps.d3d4tester.Constants;

/// <summary>ROSBOT logs.txt analysis constants. 1:1 Python d3utils.log_analyzer + providor.constants.common.</summary>
public static class RosbotLogConstants
{
    public const string LoginTryTriggerDefault = "Login try";
    public const int PickingEndLookback = 22;
    public const int SystemErrorLookbackLines = 10;
    public const int SystemErrorCooldownLines = 30;
    public const int RecentLinesMax = 22;
    public const int LineBufferMax = 6;
    public const double SmartEchoOcrMaxSeconds = 60.0;
    public const int SmartEchoTimerIntervalMs = 3000;
    public const string PickingEndSentinel = "Picking end";
    public const string EchoingFuryExplorationMarker = "Running: Echoing Fury Exploration";
    /// <summary>Level of a ROSBOT line it handled itself (caught exception, its own server check); never a restart reason.</summary>
    public const string WarnLevelMarker = " WARN - ";
    public const string DisconnectedMarker = "Disconnected";
    public const string SessionTimeoutMarker = "Session Time out";
    public const string SessionTimeoutMinMarker = "min";
    public const string SessionTimeoutWordMarker = "timeout";
}
