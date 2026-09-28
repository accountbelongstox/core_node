using System.Collections.Concurrent;
using System.Collections.Generic;

namespace DotApps.d3check.Services;

/// <summary>
/// Queue of new log lines from <see cref="RosbotLogFileWatcher"/>; drained on the global poll tick (1:1 Python log_line_bridge + rosbot_task_processor drain).
/// </summary>
public static class RosbotLogLineBridge
{
    public const int DrainMaxPerTick = 200;
    private const int QueueMax = 10000;
    private static readonly ConcurrentQueue<string> Queue = new();
    private static int _dropCount;

    public static void Enqueue(string line)
    {
        if (string.IsNullOrWhiteSpace(line)) return;
        if (Queue.Count >= QueueMax)
        {
            Queue.TryDequeue(out _);
            _dropCount++;
        }
        Queue.Enqueue(line.TrimEnd());
    }

    public static IReadOnlyList<string> Drain()
    {
        var list = new List<string>(Math.Min(DrainMaxPerTick, 32));
        for (int i = 0; i < DrainMaxPerTick; i++)
        {
            if (!Queue.TryDequeue(out var line)) break;
            list.Add(line);
        }
        return list;
    }

    public static int GetQueueSize() => Queue.Count;
    public static int GetDropCount() => _dropCount;
}
