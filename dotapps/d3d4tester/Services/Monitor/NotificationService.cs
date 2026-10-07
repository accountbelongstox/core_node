// PY-REF: none (DOT-only)
using DotApps.d3d4tester.Constants;
using DotApps.d3d4tester.Core.Monitor;
using DotApps.d3d4tester.I18n;
using DotCore.Infrastructure.Http;

namespace DotApps.d3d4tester.Services.Monitor;

/// <summary>
/// Sends monitor notifications to the configured channels (RBAssist PUSHPLUS / TELEGRAM / DISCORDMESSAGE / _PROWLADD).
/// Channel "all" sends to every channel that has credentials; unconfigured channels are skipped.
/// </summary>
public static class NotificationService
{
    private const string ProwlApplication = "D3D4Tester";

    /// <summary>Fire-and-forget send; results are logged.</summary>
    public static void Send(string channel, string title, string message) => _ = SendAsync(channel, title, message);

    public static async Task<bool> SendAsync(string channel, string title, string message)
    {
        bool all = string.IsNullOrEmpty(channel) || channel == MonitorNotifyChannels.All;
        var tasks = new List<Task<bool>>();
        string pushPlus = MonitorSettings.GetSecret(ConfigKeys.MonitorNotifyPushPlusToken);
        if ((all || channel == MonitorNotifyChannels.PushPlus) && pushPlus.Length > 0)
            tasks.Add(PushNotificationClient.SendPushPlusAsync(pushPlus, title, message));
        string tgToken = MonitorSettings.GetSecret(ConfigKeys.MonitorNotifyTelegramToken);
        string tgChat = MonitorSettings.GetString(ConfigKeys.MonitorNotifyTelegramChatId).Trim();
        if ((all || channel == MonitorNotifyChannels.Telegram) && tgToken.Length > 0 && tgChat.Length > 0)
            tasks.Add(PushNotificationClient.SendTelegramAsync(tgToken, tgChat, $"{title}\n{message}"));
        string discord = MonitorSettings.GetSecret(ConfigKeys.MonitorNotifyDiscordWebhook);
        if ((all || channel == MonitorNotifyChannels.Discord) && discord.Length > 0)
            tasks.Add(PushNotificationClient.SendDiscordAsync(discord, $"{title}: {message}"));
        string prowl = MonitorSettings.GetSecret(ConfigKeys.MonitorNotifyProwlApiKey);
        if ((all || channel == MonitorNotifyChannels.Prowl) && prowl.Length > 0)
            tasks.Add(PushNotificationClient.SendProwlAsync(prowl, ProwlApplication, title, message));
        if (tasks.Count == 0)
        {
            MonitorLog.Warn($"Notification skipped: channel '{channel}' has no credentials");
            return false;
        }
        var results = await Task.WhenAll(tasks).ConfigureAwait(false);
        MonitorLog.Info($"Notification '{title}' sent to {results.Count(r => r)}/{results.Length} channel(s)");
        return results.All(r => r);
    }

    /// <summary>Built-in restart notification (monitor.notify.on_restart) with the localized reason and total restart count.</summary>
    public static void NotifyRestart(string reasonId, string detail, int totalRestarts)
    {
        if (!MonitorSettings.GetBool(ConfigKeys.MonitorNotifyOnRestart)) return;
        var p = D3D4TesterI18n.Provider;
        string reason = string.Format(p.GetUiText(I18nKeys.MonitorReasonPrefix + reasonId), detail);
        string message = string.Format(p.GetUiText(I18nKeys.MonitorNotifyRestartMessage), reason, totalRestarts);
        Send(MonitorSettings.GetString(ConfigKeys.MonitorNotifyRestartChannel, MonitorNotifyChannels.All), p.GetUiText(I18nKeys.MonitorNotifyRestartTitle), message);
    }
}
