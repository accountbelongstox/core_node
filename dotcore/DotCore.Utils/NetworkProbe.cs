// PY-REF: none (DOT-only)
using System.Net.NetworkInformation;
using System.Net.Sockets;

namespace DotCore.Utils;

/// <summary>Internet reachability: a network interface is up and any of several public DNS hosts accepts a TCP connect.</summary>
public static class NetworkProbe
{
    private const int DnsPort = 53;
    private static readonly string[] DefaultHosts = { "223.5.5.5", "119.29.29.29", "1.1.1.1", "8.8.8.8" };
    private static readonly TimeSpan DefaultTimeout = TimeSpan.FromSeconds(3);

    public static bool IsInternetAvailable(TimeSpan? timeout = null)
    {
        if (!NetworkInterface.GetIsNetworkAvailable()) return false;
        using var cts = new CancellationTokenSource(timeout ?? DefaultTimeout);
        var attempts = DefaultHosts.Select(h => TryConnectAsync(h, DnsPort, cts.Token)).ToList();
        try
        {
            while (attempts.Count > 0)
            {
                var done = Task.WhenAny(attempts).GetAwaiter().GetResult();
                if (done.GetAwaiter().GetResult())
                {
                    cts.Cancel();
                    return true;
                }
                attempts.Remove(done);
            }
        }
        catch (OperationCanceledException) { }
        return false;
    }

    private static async Task<bool> TryConnectAsync(string host, int port, CancellationToken ct)
    {
        try
        {
            using var client = new TcpClient();
            await client.ConnectAsync(host, port, ct).ConfigureAwait(false);
            return true;
        }
        catch (Exception ex) when (ex is SocketException or OperationCanceledException or ObjectDisposedException)
        {
            return false;
        }
    }
}
