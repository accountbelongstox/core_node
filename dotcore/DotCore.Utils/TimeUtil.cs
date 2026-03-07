namespace DotCore.Utils;

/// <summary>
/// Time utilities. Logic 1:1 with Python time/datetime usage: monotonic time for debounce, Unix timestamp.
/// </summary>
public static class TimeUtil
{
    /// <summary>
    /// Gets a monotonic timestamp in milliseconds (for debounce/delta). Uses Environment.TickCount64.
    /// </summary>
    public static long MonotonicMilliseconds => Environment.TickCount64;

    /// <summary>
    /// Gets Unix timestamp (seconds since 1970-01-01 UTC).
    /// </summary>
    public static long UnixSecondsUtc => DateTimeOffset.UtcNow.ToUnixTimeSeconds();

    /// <summary>
    /// Returns true if at least <paramref name="intervalMs"/> milliseconds have passed since <paramref name="lastTimeMs"/> (monotonic).
    /// Use for debounce/throttle. Logic 1:1 with Python debounce by time comparison.
    /// </summary>
    public static bool HasElapsed(long lastTimeMs, long intervalMs)
    {
        long now = MonotonicMilliseconds;
        return (now - lastTimeMs) >= intervalMs;
    }
}
