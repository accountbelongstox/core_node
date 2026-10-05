// PY-REF: pycore/pyctl/task_history/service.py (append_task_record)
using System.Net.Http;
using System.Text;
using System.Text.Json;
using DotCore.Foundations;

namespace DotCore.Infrastructure.Http;

/// <summary>One task-log row for the local pycore Task Log (fields of pycore task_history records).</summary>
public sealed record PycoreTaskLogRecord(
    string Title,
    string TaskType,
    string Worker,
    bool Success = true,
    string? TaskId = null,
    string? Content = null,
    string? Error = null,
    IReadOnlyDictionary<string, object?>? Detail = null);

/// <summary>
/// Best-effort sender of task-log rows to the local pycore (POST ui/task_history/append_record on loopback).
/// Never throws and never blocks the caller; an unreachable pycore is logged once until it answers again.
/// </summary>
public static class PycoreTaskLogClient
{
    private const string LogTag = "[PycoreTaskLog]";
    // ports.pycore_backend in config/service_contract.json; routes.taskHistoryAppendRecord in config/pycore_rpc_contract.json.
    private const int PycoreBackendPort = 59000;
    private const string AppendRecordPath = "/api/ui/task_history/append_record";
    private const string JsonMediaType = "application/json";
    private static readonly Uri AppendRecordUri = new($"http://127.0.0.1:{PycoreBackendPort}{AppendRecordPath}");
    private static readonly HttpClient Client = new() { Timeout = TimeSpan.FromSeconds(5) };
    private static int _unreachable;

    public static void Append(PycoreTaskLogRecord record) => _ = AppendAsync(record);

    public static async Task<bool> AppendAsync(PycoreTaskLogRecord record)
    {
        var payload = new Dictionary<string, object?>
        {
            ["record"] = new Dictionary<string, object?>
            {
                ["title"] = record.Title,
                ["task_type"] = record.TaskType,
                ["worker"] = record.Worker,
                ["success"] = record.Success,
                ["task_id"] = record.TaskId,
                ["content"] = record.Content,
                ["error"] = record.Error,
                ["detail"] = record.Detail,
            },
        };
        try
        {
            using var body = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, JsonMediaType);
            using var response = await Client.PostAsync(AppendRecordUri, body).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
                return Unreachable($"HTTP {(int)response.StatusCode}");
            if (Interlocked.Exchange(ref _unreachable, 0) == 1)
                ColorPrinter.Gray($"{LogTag} pycore reachable again");
            return true;
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or NotSupportedException)
        {
            return Unreachable(ex.Message);
        }
    }

    private static bool Unreachable(string reason)
    {
        if (Interlocked.Exchange(ref _unreachable, 1) == 0)
            ColorPrinter.Yellow($"{LogTag} pycore task log not reachable ({reason}); records are skipped until it answers");
        return false;
    }
}
