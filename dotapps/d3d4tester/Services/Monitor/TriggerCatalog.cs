// PY-REF: none (DOT-only)
using System.Globalization;
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.I18n;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>Editor input kind of a trigger argument.</summary>
public enum TriggerArgKind
{
    Text,
    Integer,
    TimeOfDay,
    Weekday,
    Channel,
    File,
    Folder
}

/// <summary>One argument slot: label id (ui.monitor.arg_&lt;id&gt;) and input kind.</summary>
public sealed record TriggerArgSpec(string LabelId, TriggerArgKind Kind);

/// <summary>Arguments and display names of every trigger event and action (RBAssist CREATEEVENTCONTROLS / CREATEACTIONCONTROLS).</summary>
public static class TriggerCatalog
{
    public const int WeekdayAll = 0;
    public const int WeekdayCount = 7;
    private const string TimeStorageFormat = "HHmm";
    private const string TimeDisplayFormat = "HH:mm";
    private const string ArgSeparator = ", ";

    private static readonly TriggerArgSpec[] None = Array.Empty<TriggerArgSpec>();

    private static readonly Dictionary<string, TriggerArgSpec[]> EventArgs = new()
    {
        [MonitorEvents.ScheduledTime] = new[] { new TriggerArgSpec("time", TriggerArgKind.TimeOfDay), new TriggerArgSpec("day", TriggerArgKind.Weekday) },
        [MonitorEvents.LogMatch] = new[] { new TriggerArgSpec("text", TriggerArgKind.Text) },
        [MonitorEvents.HistoryMatch] = new[] { new TriggerArgSpec("text", TriggerArgKind.Text) },
        [MonitorEvents.ItemPickup] = new[] { new TriggerArgSpec("text", TriggerArgKind.Text) },
        [MonitorEvents.LogTimer] = new[] { new TriggerArgSpec("seconds", TriggerArgKind.Integer) },
        [MonitorEvents.HistoryTimer] = new[] { new TriggerArgSpec("minutes", TriggerArgKind.Integer) },
        [MonitorEvents.SpecialPortalTimer] = new[] { new TriggerArgSpec("seconds", TriggerArgKind.Integer) },
        [MonitorEvents.ShrineInfinite] = new[] { new TriggerArgSpec("buff_seconds", TriggerArgKind.Integer) },
        [MonitorEvents.ShrineSpeed] = new[] { new TriggerArgSpec("buff_seconds", TriggerArgKind.Integer) }
    };

    private static readonly Dictionary<string, TriggerArgSpec[]> ActionArgs = new()
    {
        [MonitorActions.WriteLog] = new[] { new TriggerArgSpec("text", TriggerArgKind.Text) },
        [MonitorActions.TakeScreenshot] = new[] { new TriggerArgSpec("label", TriggerArgKind.Text), new TriggerArgSpec("path", TriggerArgKind.Folder) },
        [MonitorActions.ExecuteCommand] = new[] { new TriggerArgSpec("command", TriggerArgKind.File), new TriggerArgSpec("arguments", TriggerArgKind.Text) },
        [MonitorActions.SendKeys] = new[] { new TriggerArgSpec("keys", TriggerArgKind.Text) },
        [MonitorActions.Notify] = new[] { new TriggerArgSpec("channel", TriggerArgKind.Channel), new TriggerArgSpec("message", TriggerArgKind.Text) },
        [MonitorActions.SetSequence] = new[] { new TriggerArgSpec("sequence", TriggerArgKind.Text) },
        [MonitorActions.GameSpeed] = new[] { new TriggerArgSpec("speed_normal", TriggerArgKind.Text), new TriggerArgSpec("speed_combat", TriggerArgKind.Text) },
        [MonitorActions.TownPortal] = new[] { new TriggerArgSpec("delay_ms", TriggerArgKind.Integer) },
        [MonitorActions.QuickQuit] = new[] { new TriggerArgSpec("delay_ms", TriggerArgKind.Integer) },
        [MonitorActions.UnstuckMove] = new[] { new TriggerArgSpec("skill_key", TriggerArgKind.Text), new TriggerArgSpec("cooldown_ms", TriggerArgKind.Integer) }
    };

    public static IReadOnlyList<TriggerArgSpec> GetEventArgs(string eventId) => EventArgs.TryGetValue(eventId, out var a) ? a : None;

    public static IReadOnlyList<TriggerArgSpec> GetActionArgs(string actionId) => ActionArgs.TryGetValue(actionId, out var a) ? a : None;

    public static string EventName(string id) => Text(I18nKeys.MonitorEventPrefix + id);

    public static string EventDescription(string id) => Text(I18nKeys.MonitorEventDescPrefix + id);

    public static string ActionName(string id) => Text(I18nKeys.MonitorActionPrefix + id);

    public static string ActionDescription(string id) => Text(I18nKeys.MonitorActionDescPrefix + id);

    public static string ArgLabel(TriggerArgSpec spec) => Text(I18nKeys.MonitorArgPrefix + spec.LabelId);

    /// <summary>Weekday label: 0 = every day, 1..7 = Sunday..Saturday (RBAssist @WDAY).</summary>
    public static string WeekdayName(int day) => Text(I18nKeys.MonitorDayPrefix + day.ToString(CultureInfo.InvariantCulture));

    public static string ChannelName(string channel) => Text(I18nKeys.MonitorChannelPrefix + channel);

    /// <summary>"HHmm" stored value as "HH:mm" (unchanged when not 4 digits).</summary>
    public static string TimeToDisplay(string stored) =>
        DateTime.TryParseExact(stored, TimeStorageFormat, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            ? t.ToString(TimeDisplayFormat, CultureInfo.InvariantCulture) : stored;

    /// <summary>"H:mm" / "HH:mm" / "HHmm" input as stored "HHmm"; null when invalid.</summary>
    public static string? TimeFromDisplay(string input)
    {
        string s = input.Trim();
        string[] formats = { TimeDisplayFormat, "H:mm", TimeStorageFormat };
        return DateTime.TryParseExact(s, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var t)
            ? t.ToString(TimeStorageFormat, CultureInfo.InvariantCulture) : null;
    }

    public static string EventArgSummary(TriggerDefinition t) => Summary(GetEventArgs(t.Event), t.EventArg, t.EventArg2);

    public static string ActionArgSummary(TriggerDefinition t) => Summary(GetActionArgs(t.Action), t.ActionArg, t.ActionArg2);

    private static string Summary(IReadOnlyList<TriggerArgSpec> specs, string a, string b)
    {
        var values = new[] { a, b };
        var parts = new List<string>();
        for (int i = 0; i < specs.Count && i < values.Length; i++)
        {
            string v = values[i];
            parts.Add(specs[i].Kind switch
            {
                TriggerArgKind.TimeOfDay => TimeToDisplay(v),
                TriggerArgKind.Weekday => int.TryParse(v, NumberStyles.Integer, CultureInfo.InvariantCulture, out int d) ? WeekdayName(d) : v,
                TriggerArgKind.Channel => ChannelName(string.IsNullOrEmpty(v) ? MonitorNotifyChannels.All : v),
                _ => v
            });
        }
        return string.Join(ArgSeparator, parts.Where(p => p.Length > 0));
    }

    private static string Text(string key) => D3D4TesterI18n.Provider.GetUiText(key);
}
