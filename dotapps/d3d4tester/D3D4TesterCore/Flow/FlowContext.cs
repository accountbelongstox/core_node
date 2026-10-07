// PY-REF: none (DOT-only)
namespace DotApps.d3d4tester.Core.Flow;

/// <summary>
/// Cancellation of one sequential flow run. Every wait of a flow goes through <see cref="Wait"/>, so Stop (token) or a yield condition
/// (e.g. the Battle.net guard yielding to monitoring) ends the run within one slice by throwing <see cref="OperationCanceledException"/>.
/// </summary>
public sealed class FlowContext
{
    private const int WaitSliceMs = 250;

    private readonly CancellationToken _token;
    private readonly Func<bool>? _yieldWhen;
    private readonly DateTime? _deadlineUtc;

    public FlowContext(CancellationToken token, Func<bool>? yieldWhen = null, TimeSpan? timeout = null)
    {
        _token = token;
        _yieldWhen = yieldWhen;
        _deadlineUtc = timeout is { } t ? DateTime.UtcNow + t : null;
    }

    /// <summary>Same stop conditions plus yieldWhen: a nested run that gives way (throws) as soon as yieldWhen turns true.</summary>
    public FlowContext WithYield(Func<bool> yieldWhen) =>
        new(_token, () => (_yieldWhen?.Invoke() ?? false) || yieldWhen(), _deadlineUtc is { } d ? d - DateTime.UtcNow : null);

    /// <summary>A context that only ends by its timeout (manual one-shot actions).</summary>
    public static FlowContext WithTimeout(TimeSpan timeout) => new(CancellationToken.None, timeout: timeout);

    public bool IsStopped =>
        _token.IsCancellationRequested || (_yieldWhen?.Invoke() ?? false) || (_deadlineUtc is { } d && DateTime.UtcNow >= d);

    public void ThrowIfStopped()
    {
        if (IsStopped) throw new OperationCanceledException(_token);
    }

    /// <summary>Sleep in short slices; throws as soon as the context is stopped.</summary>
    public void Wait(double seconds)
    {
        var until = DateTime.UtcNow.AddSeconds(seconds);
        while (true)
        {
            ThrowIfStopped();
            int left = (int)(until - DateTime.UtcNow).TotalMilliseconds;
            if (left <= 0) return;
            _token.WaitHandle.WaitOne(Math.Min(left, WaitSliceMs));
        }
    }
}
