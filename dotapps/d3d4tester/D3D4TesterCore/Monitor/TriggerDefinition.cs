// PY-REF: none (DOT-only)
using System.Text.Json;
using System.Text.Json.Serialization;

namespace DotApps.d3d4tester.Core.Monitor;

/// <summary>One event -> action rule (an element of monitor.triggers). RBAssist trigger row: event|arg|arg2|action|arg|arg2|enabled|log.</summary>
public sealed class TriggerDefinition
{
    [JsonPropertyName("event")] public string Event { get; set; } = MonitorEvents.LogMatch;
    [JsonPropertyName("event_arg")] public string EventArg { get; set; } = "";
    [JsonPropertyName("event_arg2")] public string EventArg2 { get; set; } = "";
    [JsonPropertyName("action")] public string Action { get; set; } = MonitorActions.WriteLog;
    [JsonPropertyName("action_arg")] public string ActionArg { get; set; } = "";
    [JsonPropertyName("action_arg2")] public string ActionArg2 { get; set; } = "";
    [JsonPropertyName("enabled")] public bool Enabled { get; set; } = true;
    [JsonPropertyName("log")] public bool Log { get; set; } = true;

    public TriggerDefinition Clone() => (TriggerDefinition)MemberwiseClone();

    private static readonly JsonSerializerOptions JsonOptions = new() { WriteIndented = false };

    public string ToJson() => JsonSerializer.Serialize(this, JsonOptions);

    public static List<TriggerDefinition> ListFromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return new List<TriggerDefinition>();
        try
        {
            return JsonSerializer.Deserialize<List<TriggerDefinition>>(json, JsonOptions)?.Where(t => t != null).ToList() ?? new List<TriggerDefinition>();
        }
        catch (JsonException)
        {
            return new List<TriggerDefinition>();
        }
    }

    public static TriggerDefinition? FromJson(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try { return JsonSerializer.Deserialize<TriggerDefinition>(json, JsonOptions); }
        catch (JsonException) { return null; }
    }
}

/// <summary>Credentials found in an imported RBAssist notification action (token, chat id / title), merged into monitor.notify.* when empty.</summary>
public sealed record ImportedChannelCredentials(string Channel, string Value, string Value2);

/// <summary>
/// RBAssist trigger string ("事件|参数|参数2|动作|参数|参数2|1|1", enabled/log 1 = on, 4 = off) to <see cref="TriggerDefinition"/>.
/// Names are the RBAssist zh display names (lang_cn.ini + script literals) or our ids. Telegram / Prowl / Discord become the notify
/// action with their credentials returned separately; "call AutoIt function" is unsupported.
/// </summary>
public static class RbAssistTriggerImport
{
    private const char Separator = '|';
    private const int FieldCount = 8;
    private const int LegacyFieldCount = 6;
    private const string CheckedState = "1";
    private const char ListSeparator = ',';

    private static readonly Dictionary<string, string> EventNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["预定时间"] = MonitorEvents.ScheduledTime,
        ["匹配日志条目"] = MonitorEvents.LogMatch,
        ["匹配历史记录"] = MonitorEvents.HistoryMatch,
        ["检测到错误"] = MonitorEvents.ErrorDetected,
        ["检测到死亡"] = MonitorEvents.DeathDetected,
        ["检测到失败"] = MonitorEvents.FailDetected,
        ["D3启动"] = MonitorEvents.D3Launch,
        ["D3退出"] = MonitorEvents.D3Exit,
        ["rosbot启动"] = MonitorEvents.RosbotLaunch,
        ["rosbot退出"] = MonitorEvents.RosbotExit,
        ["监控启动"] = MonitorEvents.MonitoringStart,
        ["监控停止"] = MonitorEvents.MonitoringStop,
        ["启动RBAssist"] = MonitorEvents.AppLaunch,
        ["RBAssist退出"] = MonitorEvents.AppExit,
        ["日志文件滚动"] = MonitorEvents.LogRollover,
        ["日志文件计时"] = MonitorEvents.LogTimer,
        ["历史文件计时"] = MonitorEvents.HistoryTimer,
        ["开新副本时"] = MonitorEvents.NewRun,
        ["战斗切换时"] = MonitorEvents.CombatSwitch,
        ["升级宝石时"] = MonitorEvents.UrshiOpen,
        ["角色回城时"] = MonitorEvents.TownPortal,
        ["角色回城时2.0"] = MonitorEvents.TownPortalAfterIllusion,
        ["发现减耗塔"] = MonitorEvents.ShrineInfinite,
        ["发现加速塔"] = MonitorEvents.ShrineSpeed,
        ["Buff结束时"] = MonitorEvents.BuffEnd,
        ["特殊传送门计时"] = MonitorEvents.SpecialPortalTimer
    };

    private const string RbTelegram = "telegram消息";
    private const string RbProwl = "Prowl提醒";
    private const string RbDiscord = "Discord提醒";

    private static readonly Dictionary<string, string> ActionNames = new(StringComparer.OrdinalIgnoreCase)
    {
        ["写入日志"] = MonitorActions.WriteLog,
        ["启动rosbot"] = MonitorActions.StartMonitoring,
        ["停止rosbot（F7）"] = MonitorActions.StopBotF7,
        ["停止rosbot（F9）"] = MonitorActions.StopBotF9,
        ["关闭rosbot"] = MonitorActions.CloseBot,
        ["重启rosbot"] = MonitorActions.RestartBot,
        ["重启rosbot2.0"] = MonitorActions.RestartBotWithBattlenet,
        ["启动监控"] = MonitorActions.StartMonitoring,
        ["停止监控"] = MonitorActions.StopMonitoring,
        ["暂停监控"] = MonitorActions.PauseMonitoring,
        ["继续监控"] = MonitorActions.ResumeMonitoring,
        ["屏幕截图"] = MonitorActions.TakeScreenshot,
        ["游戏调速"] = MonitorActions.GameSpeed,
        ["回城"] = MonitorActions.TownPortal,
        ["快速退出"] = MonitorActions.QuickQuit,
        ["执行命令"] = MonitorActions.ExecuteCommand,
        ["发送按键"] = MonitorActions.SendKeys,
        ["更改模式"] = MonitorActions.SetSequence,
        ["位移解卡"] = MonitorActions.UnstuckMove
    };

    /// <summary>Parse one RBAssist trigger string; null when the format, event or action is not supported.</summary>
    public static TriggerDefinition? Parse(string? line, out ImportedChannelCredentials? credentials)
    {
        credentials = null;
        if (string.IsNullOrWhiteSpace(line)) return null;
        var p = line.Trim().TrimEnd(Separator).Split(Separator);
        if (p.Length != FieldCount && p.Length != LegacyFieldCount) return null;
        string ev = MapName(EventNames, MonitorEvents.All, p[0]);
        if (ev.Length == 0) return null;
        var def = new TriggerDefinition
        {
            Event = ev,
            EventArg = p[1],
            EventArg2 = p[2],
            Enabled = p.Length < FieldCount || p[6] == CheckedState,
            Log = p.Length < FieldCount || p[7] == CheckedState
        };
        string action = p[3];
        if (string.Equals(action, RbTelegram, StringComparison.OrdinalIgnoreCase))
        {
            var tg = p[4].Split(ListSeparator, 2);
            credentials = new ImportedChannelCredentials(MonitorNotifyChannels.Telegram, tg[0], tg.Length > 1 ? tg[1] : "");
            return WithNotify(def, MonitorNotifyChannels.Telegram, p[5]);
        }
        if (string.Equals(action, RbProwl, StringComparison.OrdinalIgnoreCase))
        {
            credentials = new ImportedChannelCredentials(MonitorNotifyChannels.Prowl, p[4], "");
            return WithNotify(def, MonitorNotifyChannels.Prowl, p[5].Replace(ListSeparator, ' '));
        }
        if (string.Equals(action, RbDiscord, StringComparison.OrdinalIgnoreCase))
        {
            credentials = new ImportedChannelCredentials(MonitorNotifyChannels.Discord, p[4], "");
            return WithNotify(def, MonitorNotifyChannels.Discord, p[5]);
        }
        string mapped = MapName(ActionNames, MonitorActions.All, action);
        if (mapped.Length == 0) return null;
        def.Action = mapped;
        def.ActionArg = p[4];
        def.ActionArg2 = p[5];
        return def;
    }

    private static TriggerDefinition WithNotify(TriggerDefinition def, string channel, string message)
    {
        def.Action = MonitorActions.Notify;
        def.ActionArg = channel;
        def.ActionArg2 = message;
        return def;
    }

    private static string MapName(Dictionary<string, string> names, IReadOnlyList<string> ids, string raw)
    {
        string name = raw.Trim();
        if (names.TryGetValue(name, out var id)) return id;
        return ids.FirstOrDefault(i => string.Equals(i, name, StringComparison.OrdinalIgnoreCase)) ?? "";
    }
}
