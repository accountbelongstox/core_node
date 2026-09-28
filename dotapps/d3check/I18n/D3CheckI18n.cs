using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;
using DotCore.Common;
using DotApps.d3check.Config;
using DotApps.d3check.Config.Options;
using DotApps.d3check.Constants;

namespace DotApps.d3check.I18n;

/// <summary>
/// D3Check i18n bootstrap: load I18n/i18n_config.json (dot-local, same structure as Python), flatten per language, feed DotCore.Common II18nProvider.
/// Logic 1:1 with Python i18n_manager (load from file, get_ui_text by key, save current_language to config).
/// Sub-app uses public library (DotCore.Common.DefaultI18nProvider) to form app i18n.
/// </summary>
public static class D3CheckI18n
{
    private static DefaultI18nProvider? _provider;
    private static readonly object _initLock = new();

    /// <summary>
    /// Gets the app i18n provider. Call EnsureInitialized() first (e.g. from MainWindow OnLoaded).
    /// </summary>
    public static II18nProvider Provider
    {
        get
        {
            EnsureInitialized();
            return _provider!;
        }
    }

    /// <summary>
    /// Ensures i18n is loaded and current language is restored from config. Idempotent.
    /// </summary>
    public static void EnsureInitialized()
    {
        lock (_initLock)
        {
            if (_provider != null) return;
            _provider = new DefaultI18nProvider("en");
            var path = Path.Combine(AppContext.BaseDirectory, "i18n_config.json");
            if (File.Exists(path))
            {
                var json = File.ReadAllText(path);
                var root = JObject.Parse(json);
                var translations = root["translations"] as JObject;
                var defaultLang = root["default_language"]?.Value<string>() ?? "en";
                if (translations != null)
                {
                    foreach (var langEntry in translations.Properties())
                    {
                        if (langEntry.Value is JObject langObj)
                        {
                            var flat = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                            Flatten(langObj, "", flat);
                            var fallbacks = I18nFallbacks.ForLanguage(langEntry.Name);
                            foreach (var kv in fallbacks)
                            {
                                if (!flat.ContainsKey(kv.Key))
                                    flat[kv.Key] = kv.Value;
                            }
                            _provider.SetStringsForLanguage(langEntry.Name, flat);
                        }
                    }
                }
                // Ensure at least en/zh exist so the language dropdown always has items (even if translations was empty or malformed).
                var supportedAfterFile = _provider.GetSupportedLanguages();
                foreach (var lang in new[] { "en", "zh" })
                {
                    if (!supportedAfterFile.Any(l => string.Equals(l, lang, StringComparison.OrdinalIgnoreCase)))
                    {
                        var flat = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                        foreach (var kv in I18nFallbacks.ForLanguage(lang))
                            flat[kv.Key] = kv.Value;
                        _provider.SetStringsForLanguage(lang, flat);
                    }
                }
                _provider.SetLanguageDisplayNames(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["zh"] = "中文",
                    ["en"] = "English"
                });
                _provider.SetLanguage(defaultLang);
            }
            else
            {
                foreach (var lang in new[] { "en", "zh" })
                {
                    var flat = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                    foreach (var kv in I18nFallbacks.ForLanguage(lang))
                        flat[kv.Key] = kv.Value;
                    _provider.SetStringsForLanguage(lang, flat);
                }
                _provider.SetLanguageDisplayNames(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
                {
                    ["zh"] = "中文",
                    ["en"] = "English"
                });
                _provider.SetLanguage("en");
            }
            LoadLanguageFromConfig();
        }
    }

    /// <summary>
    /// Loads current language from config (ui_settings.current_language). Call after EnsureInitialized.
    /// </summary>
    public static void LoadLanguageFromConfig()
    {
        if (_provider == null) return;
        var saved = ConfigOptionsProvider.GetOptions<UiSettingsOptions>().CurrentLanguage;
        if (!string.IsNullOrEmpty(saved))
        {
            var supported = _provider.GetSupportedLanguages();
            if (supported.Count > 0 && supported.Any(l => string.Equals(l, saved, StringComparison.OrdinalIgnoreCase)))
                _provider.SetLanguage(saved);
        }
    }

    /// <summary>
    /// Saves current language to config and notifies provider. Call when user changes language in UI.
    /// </summary>
    public static void SaveLanguageToConfig(string languageCode)
    {
        D3CheckConfigService.Instance.SetValueAsync(ConfigKeys.UiSettingsCurrentLanguage, languageCode ?? "en");
        D3CheckConfigService.Instance.QueueSave();
    }

    private static void Flatten(JObject node, string prefix, Dictionary<string, string> result)
    {
        foreach (var prop in node.Properties())
        {
            var key = string.IsNullOrEmpty(prefix) ? prop.Name : prefix + "." + prop.Name;
            var value = prop.Value;
            if (value == null) continue;
            if (value is JObject obj)
                Flatten(obj, key, result);
            else if (value is JValue jv && jv.Type == JTokenType.String)
            {
                var s = jv.Value<string>();
                if (s != null) result[key] = s;
            }
        }
    }
}
