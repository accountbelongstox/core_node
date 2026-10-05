// PY-REF: none (DOT-only)
using System.Net.Http;
using System.Text;
using System.Text.Json;
using DotCore.Foundations;

namespace DotCore.Infrastructure.Http;

/// <summary>Outbound push notifications: PushPlus (WeChat), Telegram bot, Discord webhook, Prowl. Each call returns true on HTTP success.</summary>
public static class PushNotificationClient
{
    private const string LogTag = "[PushNotification]";
    private const string PushPlusUrl = "https://www.pushplus.plus/send";
    private const string PushPlusTemplate = "html";
    private const string TelegramUrlFormat = "https://api.telegram.org/bot{0}/sendMessage";
    private const string ProwlUrl = "https://api.prowlapp.com/publicapi/add";
    private const string JsonMediaType = "application/json";
    private static readonly TimeSpan Timeout = TimeSpan.FromSeconds(8);
    private static readonly HttpClient Client = new() { Timeout = Timeout };

    public static Task<bool> SendPushPlusAsync(string token, string title, string content) =>
        PostJsonAsync("pushplus", PushPlusUrl, new Dictionary<string, string>
        {
            ["token"] = token, ["title"] = title, ["content"] = content, ["template"] = PushPlusTemplate
        });

    public static Task<bool> SendTelegramAsync(string botToken, string chatId, string text) =>
        PostJsonAsync("telegram", string.Format(TelegramUrlFormat, Uri.EscapeDataString(botToken)), new Dictionary<string, string>
        {
            ["chat_id"] = chatId, ["text"] = text
        });

    public static Task<bool> SendDiscordAsync(string webhookUrl, string content) =>
        PostJsonAsync("discord", webhookUrl, new Dictionary<string, string> { ["content"] = content });

    public static async Task<bool> SendProwlAsync(string apiKey, string application, string eventTitle, string description)
    {
        using var form = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            ["apikey"] = apiKey, ["application"] = application, ["event"] = eventTitle, ["description"] = description, ["priority"] = "0"
        });
        return await SendAsync("prowl", () => Client.PostAsync(ProwlUrl, form)).ConfigureAwait(false);
    }

    private static async Task<bool> PostJsonAsync(string channel, string url, Dictionary<string, string> payload)
    {
        using var body = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, JsonMediaType);
        return await SendAsync(channel, () => Client.PostAsync(url, body)).ConfigureAwait(false);
    }

    private static async Task<bool> SendAsync(string channel, Func<Task<HttpResponseMessage>> send)
    {
        try
        {
            using var response = await send().ConfigureAwait(false);
            if (response.IsSuccessStatusCode)
            {
                ColorPrinter.Gray($"{LogTag} {channel} sent");
                return true;
            }
            ColorPrinter.Yellow($"{LogTag} {channel} failed: HTTP {(int)response.StatusCode}");
            return false;
        }
        catch (Exception ex)
        {
            ColorPrinter.Yellow($"{LogTag} {channel} failed: {ex.Message}");
            return false;
        }
    }
}
