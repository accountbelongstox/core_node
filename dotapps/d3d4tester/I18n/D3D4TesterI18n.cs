// PY-REF: pyapps/d3-check/providor/i18n_manager.py
using System.Collections.Generic;
using System.IO;
using Newtonsoft.Json.Linq;
using DotCore.Common;
using DotApps.d3d4tester.Config;
using DotApps.d3d4tester.Config.Options;
using DotApps.d3d4tester.Constants;

namespace DotApps.d3d4tester.I18n;

/// <summary>
/// D3D4Tester i18n bootstrap: load I18n/i18n_base.json + per-area language files (same layout as Python providor/i18n), flatten per language, feed DotCore.Common II18nProvider.
/// Logic 1:1 with Python i18n_manager (load from file, get_ui_text by key, save current_language to config).
/// Sub-app uses public library (DotCore.Common.DefaultI18nProvider) to form app i18n.
/// </summary>
public static class D3D4TesterI18n
{
    private static DefaultI18nProvider? _provider;
    private const string I18nDirName = "I18n";
    private const string I18nBaseFileName = "i18n_base.json";
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
    /// Layout 1:1 with Python providor/i18n: I18n/i18n_base.json lists area files; each language merges I18n/i18n_{area}_{lang}.json in order.
    /// </summary>
    public static void EnsureInitialized()
    {
        lock (_initLock)
        {
            if (_provider != null) return;
            _provider = new DefaultI18nProvider("en");
            var i18nDir = Path.Combine(AppContext.BaseDirectory, I18nDirName);
            var basePath = Path.Combine(i18nDir, I18nBaseFileName);
            var defaultLang = "en";
            var languages = new List<string> { "zh", "en" };
            var areas = new List<string>();
            if (File.Exists(basePath))
            {
                var baseJson = JObject.Parse(File.ReadAllText(basePath));
                defaultLang = baseJson["default_language"]?.Value<string>() ?? defaultLang;
                if (baseJson["supported_languages"] is JArray langs)
                    languages = langs.Values<string>().Where(l => !string.IsNullOrEmpty(l)).Select(l => l!).ToList();
                if (baseJson["files"] is JArray files)
                    areas = files.Values<string>().Where(a => !string.IsNullOrEmpty(a)).Select(a => a!).ToList();
            }
            foreach (var lang in languages)
            {
                var merged = new JObject();
                foreach (var area in areas)
                {
                    var file = Path.Combine(i18nDir, $"i18n_{area}_{lang}.json");
                    if (!File.Exists(file)) continue;
                    merged.Merge(JObject.Parse(File.ReadAllText(file)), new JsonMergeSettings { MergeArrayHandling = MergeArrayHandling.Replace });
                }
                var flat = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                Flatten(merged, "", flat);
                foreach (var kv in I18nFallbacks.ForLanguage(lang))
                {
                    if (!flat.ContainsKey(kv.Key))
                        flat[kv.Key] = kv.Value;
                }
                _provider.SetStringsForLanguage(lang, flat);
            }
            _provider.SetLanguageDisplayNames(new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
            {
                ["zh"] = "中文",
                ["en"] = "English"
            });
            _provider.SetLanguage(defaultLang);
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
        D3D4TesterConfigService.Instance.SetValueAsync(ConfigKeys.UiSettingsCurrentLanguage, languageCode ?? "en");
        D3D4TesterConfigService.Instance.QueueSave();
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
