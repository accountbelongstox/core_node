using System.Collections;
using System.Net;
using System.Text;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Web;
using DotCore.Foundations;

namespace DotCore.Infrastructure.Http;

/// <summary>
/// Small local JSON HTTP host (HttpListener): GET/POST route registration, CORS for browser userscripts, start/stop.
/// GET handlers receive query params as {name: [values]} (Python parse_qs); POST handlers receive the JSON object body.
/// A handler result that is a JSON object/dictionary is sent as is; anything else is wrapped as {success: true, data}.
/// 1:1 Python pyapps/d3-check/controller/http_bridge_controller.py (start/stop/is_running, RequestHandler).
/// </summary>
public sealed class LocalJsonHttpHost : IDisposable
{
    public const string DefaultHost = "127.0.0.1";
    public const int DefaultPort = 8765;
    public const string DefaultLogTag = "[HTTPBridgeController]";
    public const string ErrorRouteNotFound = "Route not found";
    public const string ErrorInvalidJson = "Invalid JSON body";
    public const string ErrorBodyNotObject = "JSON body must be an object";

    private const string JsonContentType = "application/json; charset=utf-8";
    private const string CorsAllowOrigin = "*";
    private const string CorsAllowMethods = "GET, POST, OPTIONS";
    private const string CorsAllowHeaders = "Content-Type";
    private const int StopJoinTimeoutMs = 2000;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private readonly object _lock = new();
    private readonly Dictionary<string, Func<JsonObject, object?>> _getHandlers = new(StringComparer.Ordinal);
    private readonly Dictionary<string, Func<JsonObject, object?>> _postHandlers = new(StringComparer.Ordinal);
    private HttpListener? _listener;
    private Thread? _thread;

    public LocalJsonHttpHost(string host = DefaultHost, int port = DefaultPort, string logTag = DefaultLogTag)
    {
        Host = string.IsNullOrWhiteSpace(host) ? DefaultHost : host;
        Port = port;
        LogTag = logTag ?? DefaultLogTag;
    }

    public string Host { get; }
    public int Port { get; }
    public string LogTag { get; }

    public bool IsRunning
    {
        get
        {
            lock (_lock)
                return _listener != null && _listener.IsListening && _thread != null && _thread.IsAlive;
        }
    }

    /// <summary>Register a GET route (exact path, e.g. /api/status). Handler gets query params as {name: [values]}.</summary>
    public void MapGet(string path, Func<JsonObject, object?> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        lock (_lock)
            _getHandlers[path] = handler;
    }

    /// <summary>Register a POST route (exact path). Handler gets the JSON object body ({} when empty).</summary>
    public void MapPost(string path, Func<JsonObject, object?> handler)
    {
        ArgumentNullException.ThrowIfNull(handler);
        lock (_lock)
            _postHandlers[path] = handler;
    }

    /// <summary>Start listening on http://host:port/ in a background thread. No-op if already running. Returns false on bind failure.</summary>
    public bool Start()
    {
        lock (_lock)
        {
            if (_listener != null && _listener.IsListening && _thread != null && _thread.IsAlive)
                return true;
            var listener = new HttpListener();
            listener.Prefixes.Add($"http://{Host}:{Port}/");
            try
            {
                listener.Start();
            }
            catch (Exception ex)
            {
                ColorPrinter.Red($"{LogTag} Server start failed on http://{Host}:{Port}: {ex.Message}");
                listener.Close();
                return false;
            }
            _listener = listener;
            _thread = new Thread(() => ServeForever(listener))
            {
                IsBackground = true,
                Name = $"HTTPBridge-{Host}:{Port}",
            };
            _thread.Start();
        }
        ColorPrinter.Green($"{LogTag} Server started on http://{Host}:{Port}");
        return true;
    }

    /// <summary>Stop the server and wait briefly for the listener thread.</summary>
    public void Stop()
    {
        HttpListener? listener;
        Thread? thread;
        lock (_lock)
        {
            listener = _listener;
            thread = _thread;
            _listener = null;
            _thread = null;
        }
        if (listener == null)
            return;
        try
        {
            listener.Stop();
            listener.Close();
        }
        catch
        {
            // already closed
        }
        if (thread != null && thread != Thread.CurrentThread)
            thread.Join(StopJoinTimeoutMs);
        ColorPrinter.Blue($"{LogTag} Server stopped");
    }

    public void Dispose() => Stop();

    private void ServeForever(HttpListener listener)
    {
        while (listener.IsListening)
        {
            HttpListenerContext ctx;
            try
            {
                ctx = listener.GetContext();
            }
            catch
            {
                break;
            }
            ThreadPool.QueueUserWorkItem(_ => HandleRequest(ctx));
        }
    }

    private void HandleRequest(HttpListenerContext ctx)
    {
        try
        {
            var request = ctx.Request;
            var path = request.Url?.AbsolutePath ?? "/";
            var method = request.HttpMethod.ToUpperInvariant();
            if (method == "OPTIONS")
            {
                ctx.Response.StatusCode = 204;
                AddCommonHeaders(ctx.Response);
                ctx.Response.Close();
                return;
            }
            if (method == "GET")
            {
                var handler = GetHandler(_getHandlers, path);
                if (handler == null)
                {
                    SendJson(ctx.Response, 404, ErrorPayload(ErrorRouteNotFound));
                    return;
                }
                Invoke(ctx.Response, handler, ParseQuery(request.Url?.Query));
                return;
            }
            if (method == "POST")
            {
                var handler = GetHandler(_postHandlers, path);
                if (handler == null)
                {
                    SendJson(ctx.Response, 404, ErrorPayload(ErrorRouteNotFound));
                    return;
                }
                string raw;
                using (var reader = new StreamReader(request.InputStream, Encoding.UTF8))
                    raw = reader.ReadToEnd();
                JsonNode? node;
                try
                {
                    node = JsonNode.Parse(string.IsNullOrEmpty(raw) ? "{}" : raw);
                }
                catch (JsonException)
                {
                    SendJson(ctx.Response, 400, ErrorPayload(ErrorInvalidJson));
                    return;
                }
                if (node is not JsonObject payload)
                {
                    SendJson(ctx.Response, 400, ErrorPayload(ErrorBodyNotObject));
                    return;
                }
                Invoke(ctx.Response, handler, payload);
                return;
            }
            SendJson(ctx.Response, 404, ErrorPayload(ErrorRouteNotFound));
        }
        catch
        {
            try { ctx.Response.Abort(); } catch { /* client gone */ }
        }
    }

    private Func<JsonObject, object?>? GetHandler(Dictionary<string, Func<JsonObject, object?>> handlers, string path)
    {
        lock (_lock)
            return handlers.TryGetValue(path, out var h) ? h : null;
    }

    private static void Invoke(HttpListenerResponse response, Func<JsonObject, object?> handler, JsonObject payload)
    {
        object? result;
        try
        {
            result = handler(payload);
        }
        catch (Exception ex)
        {
            SendJson(response, 500, ErrorPayload(ex.Message));
            return;
        }
        JsonNode body = result switch
        {
            JsonObject obj => obj,
            IDictionary dict when result is not null => JsonSerializer.SerializeToNode(dict, JsonOptions) ?? new JsonObject(),
            _ => new JsonObject { ["success"] = true, ["data"] = JsonSerializer.SerializeToNode(result, JsonOptions) },
        };
        SendJson(response, 200, body);
    }

    private static JsonObject ErrorPayload(string error) => new() { ["success"] = false, ["error"] = error };

    private static JsonObject ParseQuery(string? query)
    {
        var result = new JsonObject();
        var parsed = HttpUtility.ParseQueryString(query ?? "", Encoding.UTF8);
        foreach (var key in parsed.AllKeys)
        {
            if (key == null) continue;
            var arr = new JsonArray();
            foreach (var v in parsed.GetValues(key) ?? Array.Empty<string>())
                arr.Add(v);
            result[key] = arr;
        }
        return result;
    }

    private static void AddCommonHeaders(HttpListenerResponse response)
    {
        response.AddHeader("Access-Control-Allow-Origin", CorsAllowOrigin);
        response.AddHeader("Access-Control-Allow-Methods", CorsAllowMethods);
        response.AddHeader("Access-Control-Allow-Headers", CorsAllowHeaders);
    }

    private static void SendJson(HttpListenerResponse response, int status, JsonNode payload)
    {
        var body = Encoding.UTF8.GetBytes(payload.ToJsonString(JsonOptions));
        response.StatusCode = status;
        AddCommonHeaders(response);
        response.ContentType = JsonContentType;
        response.ContentLength64 = body.Length;
        response.OutputStream.Write(body, 0, body.Length);
        response.Close();
    }
}
