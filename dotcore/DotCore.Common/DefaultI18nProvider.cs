using System.Collections.ObjectModel;
using DotCore.Foundations;

namespace DotCore.Common;

/// <summary>
/// Default in-memory i18n provider. Per-language string dictionaries; app loads from JSON and calls SetStringsForLanguage.
/// Logic 1:1 with Python: one current language, get_ui_text(key) with optional "ui." prefix, language change notifies subscribers.
/// </summary>
public sealed class DefaultI18nProvider : II18nProvider
{
    private readonly object _lock = new();
    private string _currentLanguage;
    private Dictionary<string, Dictionary<string, string>> _stringsByLanguage = new(StringComparer.OrdinalIgnoreCase);
    private Dictionary<string, string> _languageDisplayNames = new(StringComparer.OrdinalIgnoreCase);

    public DefaultI18nProvider(string defaultLanguage = "en")
    {
        _currentLanguage = Guard.NotNullOrWhiteSpace(defaultLanguage);
    }

    public string GetCurrentLanguage()
    {
        lock (_lock) { return _currentLanguage; }
    }

    public void LoadLanguageFromConfig()
    {
        // No-op in default impl; app sets language after reading config.
    }

    /// <summary>
    /// Normalizes key: if not starting with "ui.", prepends "ui." (logic 1:1 with Python get_ui_text).
    /// </summary>
    private static string NormalizeKey(string key)
    {
        if (string.IsNullOrWhiteSpace(key)) return key;
        return key.StartsWith("ui.", StringComparison.OrdinalIgnoreCase) ? key : "ui." + key;
    }

    public string GetUiText(string key)
    {
        Guard.NotNullOrWhiteSpace(key);
        var normalized = NormalizeKey(key);
        lock (_lock)
        {
            if (_stringsByLanguage.TryGetValue(_currentLanguage, out var dict) && dict.TryGetValue(normalized, out var value))
                return value;
            return key;
        }
    }

    public void SetLanguage(string languageCode)
    {
        Guard.NotNullOrWhiteSpace(languageCode);
        lock (_lock)
        {
            if (string.Equals(_currentLanguage, languageCode, StringComparison.OrdinalIgnoreCase))
                return;
            _currentLanguage = languageCode;
        }
        LanguageChanged?.Invoke(this, new LanguageChangedEventArgs(languageCode));
    }

    public IReadOnlyList<string> GetSupportedLanguages()
    {
        lock (_lock)
        {
            return new ReadOnlyCollection<string>(_stringsByLanguage.Keys.ToList());
        }
    }

    public IReadOnlyDictionary<string, string> GetLanguageDisplayNames()
    {
        lock (_lock)
        {
            return new ReadOnlyDictionary<string, string>(new Dictionary<string, string>(_languageDisplayNames, StringComparer.OrdinalIgnoreCase));
        }
    }

    /// <summary>
    /// Sets the flat key-value dictionary for a language. Keys should be dot path (e.g. "ui.main_window.title").
    /// Replaces all entries for that language.
    /// </summary>
    public void SetStringsForLanguage(string languageCode, IReadOnlyDictionary<string, string> strings)
    {
        Guard.NotNullOrWhiteSpace(languageCode);
        Guard.NotNull(strings);
        lock (_lock)
        {
            _stringsByLanguage[languageCode] = new Dictionary<string, string>(strings, StringComparer.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// Sets display names for language dropdown (e.g. "zh" -> "中文", "en" -> "English").
    /// </summary>
    public void SetLanguageDisplayNames(IReadOnlyDictionary<string, string> displayNames)
    {
        Guard.NotNull(displayNames);
        lock (_lock)
        {
            _languageDisplayNames = new Dictionary<string, string>(displayNames, StringComparer.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// Legacy: sets a single flat dictionary for the current language only. Prefer SetStringsForLanguage.
    /// </summary>
    public void SetStrings(IReadOnlyDictionary<string, string> strings)
    {
        Guard.NotNull(strings);
        lock (_lock)
        {
            _stringsByLanguage[_currentLanguage] = new Dictionary<string, string>(strings, StringComparer.OrdinalIgnoreCase);
        }
    }

    /// <summary>
    /// Adds or updates a single UI string for the current language.
    /// </summary>
    public void SetString(string key, string value)
    {
        Guard.NotNullOrWhiteSpace(key);
        lock (_lock)
        {
            if (!_stringsByLanguage.TryGetValue(_currentLanguage, out var dict))
            {
                dict = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                _stringsByLanguage[_currentLanguage] = dict;
            }
            dict[NormalizeKey(key)] = value;
        }
    }

    public event EventHandler<LanguageChangedEventArgs>? LanguageChanged;
}
