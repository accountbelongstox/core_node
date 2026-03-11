using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

namespace DotApps.d3check.Services;

/// <summary>
/// HTTP client for Python HTTP bridge (127.0.0.1:8765). Recording/segments/export/delete are executed by Python (GameAISDK).
/// </summary>
public sealed class YoloRecordBridgeClient
{
    public const int DefaultPort = 8765;
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _client;
    private readonly string _baseUrl;

    public YoloRecordBridgeClient(string host = "127.0.0.1", int port = DefaultPort)
    {
        _baseUrl = $"http://{host}:{port}";
        _client = new HttpClient { Timeout = TimeSpan.FromSeconds(15) };
    }

    /// <summary>True if bridge is reachable (e.g. Python main.py with HTTP bridge running).</summary>
    public async Task<bool> PingAsync()
    {
        try
        {
            var resp = await _client.GetAsync($"{_baseUrl}/api/status").ConfigureAwait(false);
            return resp.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>Whether Python is currently recording (GameAISDK).</summary>
    public async Task<(bool Ok, bool Recording)> GetRecordStatusAsync()
    {
        try
        {
            var resp = await _client.GetAsync($"{_baseUrl}/api/yolo/record/status").ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var ok = root.TryGetProperty("success", out var s) && s.GetBoolean();
            var recording = root.TryGetProperty("data", out var data) && data.TryGetProperty("recording", out var r) && r.GetBoolean();
            return (ok, recording);
        }
        catch
        {
            return (false, false);
        }
    }

    /// <summary>Start recording. serial = window handle (hwnd) for the capture window.</summary>
    public async Task<(bool Success, string? Error)> StartRecordAsync(string projectPath, int serial)
    {
        try
        {
            var body = new { project_path = projectPath, serial };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var resp = await _client.PostAsync($"{_baseUrl}/api/yolo/record/start", content).ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var success = root.TryGetProperty("success", out var s) && s.GetBoolean();
            var error = root.TryGetProperty("error", out var e) ? e.GetString() : null;
            return (success, success ? null : (error ?? "Unknown error"));
        }
        catch (HttpRequestException ex)
        {
            return (false, "Python bridge not running: " + ex.Message + " Start Python with: python main.py --http-bridge-only");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>Stop current recording.</summary>
    public async Task<(bool Success, string? Error)> StopRecordAsync()
    {
        try
        {
            var content = new StringContent("{}", Encoding.UTF8, "application/json");
            var resp = await _client.PostAsync($"{_baseUrl}/api/yolo/record/stop", content).ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var success = root.TryGetProperty("success", out var s) && s.GetBoolean();
            var error = root.TryGetProperty("error", out var e) ? e.GetString() : null;
            return (success, success ? null : (error ?? "Unknown error"));
        }
        catch (HttpRequestException ex)
        {
            return (false, "Python bridge not running: " + ex.Message + " Start Python with: python main.py --http-bridge-only");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    /// <summary>List segments in project. Returns (segment_id, segment_path) pairs.</summary>
    public async Task<(bool Success, List<(string SegmentId, string SegmentPath)> Segments, string? Error)> ListSegmentsAsync(string projectPath)
    {
        var list = new List<(string, string)>();
        try
        {
            var url = $"{_baseUrl}/api/yolo/segments?project_path={Uri.EscapeDataString(projectPath)}";
            var resp = await _client.GetAsync(url).ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var success = root.TryGetProperty("success", out var s) && s.GetBoolean();
            if (!success)
            {
                var err = root.TryGetProperty("error", out var e) ? e.GetString() : null;
                return (false, list, err ?? "Unknown error");
            }
            if (root.TryGetProperty("data", out var data) && data.ValueKind == JsonValueKind.Array)
            {
                foreach (var item in data.EnumerateArray())
                {
                    var segId = item.TryGetProperty("segment_id", out var id) ? id.GetString() ?? "" : "";
                    var segPath = item.TryGetProperty("segment_path", out var p) ? p.GetString() ?? "" : "";
                    list.Add((segId, segPath));
                }
            }
            return (true, list, null);
        }
        catch (HttpRequestException ex)
        {
            return (false, list, "Python bridge not running: " + ex.Message);
        }
        catch (Exception ex)
        {
            return (false, list, ex.Message);
        }
    }

    /// <summary>Get segment info: frames_count, has_video, status, size_mb.</summary>
    public async Task<(bool Success, SegmentInfo? Info, string? Error)> GetSegmentInfoAsync(string segmentPath)
    {
        try
        {
            var body = new { segment_path = segmentPath };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var resp = await _client.PostAsync($"{_baseUrl}/api/yolo/segment/info", content).ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var success = root.TryGetProperty("success", out var s) && s.GetBoolean();
            if (!success)
            {
                var err = root.TryGetProperty("error", out var e) ? e.GetString() : null;
                return (false, null, err ?? "Unknown error");
            }
            if (!root.TryGetProperty("data", out var data))
                return (true, new SegmentInfo(), null);
            var info = new SegmentInfo
            {
                FramesCount = data.TryGetProperty("frames_count", out var fc) ? fc.GetInt32() : 0,
                HasVideo = data.TryGetProperty("has_video", out var hv) && hv.GetBoolean(),
                Status = data.TryGetProperty("status", out var st) ? st.GetString() ?? "raw" : "raw",
                SizeMb = data.TryGetProperty("size_mb", out var sm) ? sm.GetDouble() : 0
            };
            return (true, info, null);
        }
        catch (HttpRequestException ex)
        {
            return (false, null, "Python bridge not running: " + ex.Message);
        }
        catch (Exception ex)
        {
            return (false, null, ex.Message);
        }
    }

    /// <summary>Export segment to frames (compose video to images).</summary>
    public async Task<(bool Success, string? FramesDir, string? Error)> ExportSegmentAsync(string segmentPath, string outputSubdir = "frames", int skipFrames = 1)
    {
        try
        {
            var body = new { segment_path = segmentPath, output_subdir = outputSubdir, skip_frames = skipFrames };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var resp = await _client.PostAsync($"{_baseUrl}/api/yolo/segment/export", content).ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var success = root.TryGetProperty("success", out var s) && s.GetBoolean();
            var framesDir = root.TryGetProperty("frames_dir", out var fd) ? fd.GetString() : null;
            var error = root.TryGetProperty("error", out var e) ? e.GetString() : null;
            return (success, framesDir, success ? null : (error ?? "Unknown error"));
        }
        catch (HttpRequestException ex)
        {
            return (false, null, "Python bridge not running: " + ex.Message);
        }
        catch (Exception ex)
        {
            return (false, null, ex.Message);
        }
    }

    /// <summary>Delete segment directory.</summary>
    public async Task<(bool Success, string? Error)> DeleteSegmentAsync(string segmentPath)
    {
        try
        {
            var body = new { segment_path = segmentPath };
            var content = new StringContent(JsonSerializer.Serialize(body), Encoding.UTF8, "application/json");
            var resp = await _client.PostAsync($"{_baseUrl}/api/yolo/segment/delete", content).ConfigureAwait(false);
            var json = await resp.Content.ReadAsStringAsync().ConfigureAwait(false);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            var success = root.TryGetProperty("success", out var s) && s.GetBoolean();
            var error = root.TryGetProperty("error", out var e) ? e.GetString() : null;
            return (success, success ? null : (error ?? "Unknown error"));
        }
        catch (HttpRequestException ex)
        {
            return (false, "Python bridge not running: " + ex.Message + " Start Python with: python main.py --http-bridge-only");
        }
        catch (Exception ex)
        {
            return (false, ex.Message);
        }
    }

    public class SegmentInfo
    {
        public int FramesCount { get; set; }
        public bool HasVideo { get; set; }
        public string Status { get; set; } = "raw";
        public double SizeMb { get; set; }
    }
}
