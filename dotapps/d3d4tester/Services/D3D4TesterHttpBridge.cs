// PY-REF: pyapps/d3-check/controller/http_bridge_controller.py
using System.IO;
using System.Text.Json.Nodes;
using System.Windows;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Ctl;
using DotCore.Foundations;
using DotCore.Infrastructure.Http;
using DotCore.YoloRecord;

namespace DotApps.d3d4tester.Services;

/// <summary>
/// Local HTTP bridge on 127.0.0.1:8765 for the browser userscript and tools: status/config/macro endpoints,
/// OAuth login-try callbacks (oauth-done / oauth-ping / oauth-step1-received) and native YOLO record endpoints
/// (DotCore.YoloRecord replaces the Python GameAISDK session). Hosted by DotCore LocalJsonHttpHost.
/// 1:1 Python controller/http_bridge_controller.py.
/// </summary>
public sealed class D3D4TesterHttpBridge : IDisposable
{
    private const string KeySuccess = "success";
    private const string KeyError = "error";
    private const string KeyMessage = "message";
    private const string KeyData = "data";
    private const string MacroConfigsSkillConfigsPrefix = "macro_configs.skill_configs.";
    private const string MacroConfigsSkillConfigs = "macro_configs.skill_configs";
    private const string MacroConfigsAuxiliaryConfig = "macro_configs.auxiliary_config";
    private const string ErrorYoloProjectPath = "project_path required and must be an existing directory";
    private const string ErrorYoloSerialInt = "serial (window handle) required as integer";
    private const string ErrorYoloSerialRequired = "serial (window handle) required for Windows recording";
    private const string ErrorSegmentPath = "segment_path required and must be an existing directory";
    private const string ErrorMissingConfigData = "Missing config_name or config_data";
    private const string ErrorMissingConfigName = "Missing config_name";
    private static readonly string[] ValidConfigNames = { "config1", "config2", "config3", "config4" };

    private readonly LocalJsonHttpHost _host;
    private readonly Func<CombatMacroController?> _macroController;
    private readonly YoloRecordService _recorder = new();

    public static D3D4TesterHttpBridge? Current { get; private set; }

    public D3D4TesterHttpBridge(Func<CombatMacroController?> macroController, string host = LocalJsonHttpHost.DefaultHost, int port = LocalJsonHttpHost.DefaultPort)
    {
        _macroController = macroController;
        _host = new LocalJsonHttpHost(host, port);
        RegisterHandlers();
        ColorPrinter.Blue($"[HTTPBridgeController] Initialized on {host}:{port}");
    }

    public string Host => _host.Host;
    public int Port => _host.Port;
    public bool IsRunning => _host.IsRunning;

    /// <summary>Create, start and publish the app-wide bridge (registered for shutdown). Returns null when binding failed.</summary>
    public static D3D4TesterHttpBridge? StartShared(Func<CombatMacroController?> macroController, string host, int port)
    {
        Current?.Stop();
        var bridge = new D3D4TesterHttpBridge(macroController, host, port);
        if (!bridge.Start())
            return null;
        Current = bridge;
        ShutdownManager.RegisterShutdownHook(StopShared);
        return bridge;
    }

    public static void StopShared()
    {
        Current?.Stop();
        Current = null;
    }

    public bool Start() => _host.Start();

    public void Stop()
    {
        if (_recorder.IsRecording)
        {
            try { _recorder.StopRecordAsync().Wait(TimeSpan.FromSeconds(3)); }
            catch (Exception ex) { ColorPrinter.Yellow($"[HTTPBridgeController] Stop recording failed: {ex.Message}"); }
        }
        _host.Stop();
    }

    public void Dispose() => Stop();

    private void RegisterHandlers()
    {
        _host.MapGet("/api/status", HandleGetStatus);
        _host.MapGet("/api/config", HandleGetConfig);
        _host.MapGet("/api/config/skill", HandleGetSkillConfig);
        _host.MapGet("/api/config/auxiliary", HandleGetAuxiliaryConfig);

        _host.MapPost("/api/macro/start", HandleMacroStart);
        _host.MapPost("/api/macro/stop", HandleMacroStop);
        _host.MapPost("/api/config/update", HandleConfigUpdate);
        _host.MapPost("/api/config/switch", HandleConfigSwitch);
        _host.MapPost("/api/config/save", HandleConfigSave);
        _host.MapPost("/api/login-try/oauth-done", HandleOauthDone);
        _host.MapGet("/api/login-try/oauth-done", HandleOauthDone);
        _host.MapGet("/api/login-try/oauth-ping", HandleOauthPing);
        _host.MapGet("/api/login-try/oauth-step1-received", HandleOauthStep1Received);

        _host.MapGet("/api/yolo/record/status", HandleYoloRecordStatus);
        _host.MapPost("/api/yolo/record/start", HandleYoloRecordStart);
        _host.MapPost("/api/yolo/record/stop", HandleYoloRecordStop);
        _host.MapGet("/api/yolo/segments", q => YoloSegments(QueryString(q, "project_path")));
        _host.MapPost("/api/yolo/segments", b => YoloSegments(BodyString(b, "project_path")));
        _host.MapPost("/api/yolo/segment/info", HandleYoloSegmentInfo);
        _host.MapPost("/api/yolo/segment/export", HandleYoloSegmentExport);
        _host.MapPost("/api/yolo/segment/delete", HandleYoloSegmentDelete);
        ColorPrinter.Green("[HTTPBridgeController] All handlers registered");
    }

    private object HandleGetStatus(JsonObject _)
    {
        var mc = _macroController();
        return Ok(new JsonObject
        {
            ["macro_running"] = mc?.MacroRunning ?? false,
            ["current_config"] = CurrentSkillConfig(),
            ["server_version"] = ShellConstants.HttpBridgeServerVersion,
        });
    }

    private object HandleGetConfig(JsonObject _)
    {
        var merged = ReadObject(MacroConfigsSkillConfigsPrefix + CurrentSkillConfig());
        foreach (var kv in ReadObject(MacroConfigsAuxiliaryConfig).ToList())
            merged[kv.Key] = kv.Value?.DeepClone();
        return Ok(merged);
    }

    private object HandleGetSkillConfig(JsonObject query)
    {
        var name = QueryString(query, "name");
        if (string.IsNullOrEmpty(name)) name = CurrentSkillConfig();
        return Ok(ReadObject(MacroConfigsSkillConfigsPrefix + name));
    }

    private object HandleGetAuxiliaryConfig(JsonObject _) => Ok(ReadObject(MacroConfigsAuxiliaryConfig));

    private object HandleMacroStart(JsonObject _)
    {
        try
        {
            var mc = _macroController() ?? throw new InvalidOperationException("macro controller not available");
            OnUi(mc.StartMacro);
            return Message("Macro started successfully");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private object HandleMacroStop(JsonObject _)
    {
        try
        {
            var mc = _macroController() ?? throw new InvalidOperationException("macro controller not available");
            OnUi(mc.StopMacro);
            return Message("Macro stopped successfully");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private object HandleConfigUpdate(JsonObject body)
    {
        try
        {
            var name = BodyString(body, "config_name");
            var data = body["config_data"];
            if (string.IsNullOrEmpty(name) || data == null || (data is JsonObject o && o.Count == 0))
                return Error(ErrorMissingConfigData);
            var cfg = D3D4TesterConfigService.Instance;
            cfg.SetValueSafe(MacroConfigsSkillConfigsPrefix + name, data.DeepClone());
            cfg.QueueSave();
            D3D4TesterConfigChangeHub.Notify(MacroConfigsSkillConfigs);
            ColorPrinter.Blue($"[HTTPBridgeController] Updated skill configuration: {name}");
            return Message($"Configuration {name} updated successfully");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    /// <summary>Switch the active skill config. Writes macro_configs.current_skill_config because the C# macro reads it from CONFIG on start.</summary>
    private object HandleConfigSwitch(JsonObject body)
    {
        try
        {
            var name = BodyString(body, "config_name");
            if (string.IsNullOrEmpty(name))
                return Error(ErrorMissingConfigName);
            if (!ValidConfigNames.Contains(name))
                return Error($"Invalid config name: {name}");
            D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.MacroConfigsCurrentSkillConfig, name);
            MacroConfigLoader.Instance.LoadActive();
            D3D4TesterConfigChangeHub.Notify(ConfigKeys.MacroConfigsCurrentSkillConfig);
            ColorPrinter.Blue($"[HTTPBridgeController] Switched to skill configuration: {name}");
            EventCenter.NotifySkillConfigSwitched(name);
            return Message($"Switched to configuration {name}");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private object HandleConfigSave(JsonObject _)
    {
        try
        {
            D3D4TesterConfigService.Instance.QueueSave();
            return Message("Configuration saved successfully");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private object HandleOauthDone(JsonObject _)
    {
        OAuthCallbackState.NotifyOauthDone();
        return Message("oauth_done");
    }

    private object HandleOauthPing(JsonObject _)
    {
        OAuthCallbackState.NotifyPing();
        return Message("pong");
    }

    private object HandleOauthStep1Received(JsonObject _)
    {
        var (received, at) = OAuthCallbackState.GetAndConsumeStep1Received();
        var result = new JsonObject { [KeySuccess] = true, ["received"] = received };
        if (received && at.HasValue) result["at"] = at.Value;
        return result;
    }

    private object HandleYoloRecordStatus(JsonObject _) => Ok(new JsonObject { ["recording"] = _recorder.IsRecording });

    private object HandleYoloRecordStart(JsonObject body)
    {
        var projectPath = BodyString(body, "project_path");
        if (string.IsNullOrEmpty(projectPath) || !Directory.Exists(projectPath))
            return Error(ErrorYoloProjectPath);
        var serialNode = body["serial"];
        long hwnd = 0;
        if (serialNode != null && !long.TryParse(serialNode.ToString(), out hwnd))
            return Error(ErrorYoloSerialInt);
        if (hwnd == 0)
            return Error(ErrorYoloSerialRequired);
        try
        {
            var (ok, err, outProject) = _recorder.StartRecord(projectPath, new IntPtr(hwnd), YoloRecordConfig.DefaultFrameWidth, YoloRecordConfig.DefaultFrameHeight, new YoloRecordConfig());
            if (!ok) return Error(string.IsNullOrEmpty(err) ? "start failed" : err);
            return new JsonObject { [KeySuccess] = true, [KeyMessage] = "recording started", ["project_path"] = outProject };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private object HandleYoloRecordStop(JsonObject _)
    {
        try
        {
            _recorder.StopRecordAsync().Wait();
            return Message("recording stopped");
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private static object YoloSegments(string projectPath)
    {
        if (string.IsNullOrEmpty(projectPath))
            return Ok(new JsonArray());
        try
        {
            var arr = new JsonArray();
            foreach (var (id, path) in YoloSegmentLayout.ListSegments(projectPath))
                arr.Add(new JsonObject { ["segment_id"] = id, ["segment_path"] = path });
            return Ok(arr);
        }
        catch (Exception ex)
        {
            return new JsonObject { [KeySuccess] = false, [KeyError] = ex.Message, [KeyData] = new JsonArray() };
        }
    }

    private static object HandleYoloSegmentInfo(JsonObject body)
    {
        var segmentPath = BodyString(body, "segment_path");
        if (string.IsNullOrEmpty(segmentPath) || !Directory.Exists(segmentPath))
            return Error(ErrorSegmentPath);
        var info = YoloSegmentLayout.GetSegmentInfo(segmentPath);
        return Ok(new JsonObject
        {
            ["frames_count"] = info.FramesCount,
            ["has_video"] = info.HasVideo,
            ["has_frames"] = info.HasFrames,
            ["status"] = info.Status,
            ["size_mb"] = info.SizeMb,
        });
    }

    private static object HandleYoloSegmentExport(JsonObject body)
    {
        var segmentPath = BodyString(body, "segment_path");
        if (string.IsNullOrEmpty(segmentPath) || !Directory.Exists(segmentPath))
            return Error(ErrorSegmentPath);
        var outputSubdir = BodyString(body, "output_subdir");
        if (string.IsNullOrEmpty(outputSubdir)) outputSubdir = YoloSegmentLayout.FramesSubdir;
        int skipFrames = int.TryParse(body["skip_frames"]?.ToString(), out var s) ? Math.Max(1, s) : 1;
        try
        {
            var (ok, msg, framesDir) = YoloSegmentLayout.ComposeSegmentToFrames(segmentPath, outputSubdir, skipFrames);
            if (!ok) return Error(string.IsNullOrEmpty(msg) ? "export failed" : msg);
            return new JsonObject { [KeySuccess] = true, [KeyMessage] = msg, ["frames_dir"] = framesDir };
        }
        catch (Exception ex) { return Error(ex.Message); }
    }

    private static object HandleYoloSegmentDelete(JsonObject body)
    {
        var segmentPath = BodyString(body, "segment_path");
        if (string.IsNullOrEmpty(segmentPath) || !Directory.Exists(segmentPath))
            return Error(ErrorSegmentPath);
        var (ok, msg) = YoloSegmentLayout.DeleteSegment(segmentPath);
        return ok ? Message(string.IsNullOrEmpty(msg) ? "deleted" : msg) : Error(string.IsNullOrEmpty(msg) ? "delete failed" : msg);
    }

    private static string CurrentSkillConfig() =>
        D3D4TesterConfigService.Instance.GetValueSafe(ConfigKeys.MacroConfigsCurrentSkillConfig, ValidConfigNames[0]) ?? ValidConfigNames[0];

    private static JsonObject ReadObject(string keyPath)
    {
        var raw = D3D4TesterConfigService.Instance.GetRawText(keyPath);
        if (string.IsNullOrWhiteSpace(raw)) return new JsonObject();
        try { return JsonNode.Parse(raw) as JsonObject ?? new JsonObject(); }
        catch { return new JsonObject(); }
    }

    private static void OnUi(Action action)
    {
        var dispatcher = Application.Current?.Dispatcher;
        if (dispatcher == null || dispatcher.CheckAccess()) action();
        else dispatcher.Invoke(action);
    }

    private static string QueryString(JsonObject query, string name) =>
        (query[name] is JsonArray arr && arr.Count > 0 ? arr[0]?.ToString() : null)?.Trim() ?? "";

    private static string BodyString(JsonObject body, string name) => body[name]?.ToString().Trim() ?? "";

    private static JsonObject Ok(JsonNode data) => new() { [KeySuccess] = true, [KeyData] = data };

    private static JsonObject Message(string message) => new() { [KeySuccess] = true, [KeyMessage] = message };

    private static JsonObject Error(string error) => new() { [KeySuccess] = false, [KeyError] = error };
}
