namespace DotCore.Common;

/// <summary>
/// i18n provider: load language, get UI text by key, notify on language change. Logic 1:1 with Python i18n_manager.
/// Apps implement or use default; UI subscribes to LanguageChanged to rebuild/refresh.
/// </summary>
public interface II18nProvider
{
    /// <summary>
    /// Gets the current language code (e.g. "en", "zh").
    /// </summary>
    string GetCurrentLanguage();

    /// <summary>
    /// Loads current language from config or default. Call at startup.
    /// </summary>
    void LoadLanguageFromConfig();

    /// <summary>
    /// Gets localized UI text by key (e.g. "ui.main_window.title" or "main_window.title"). Returns key if not found.
    /// </summary>
    string GetUiText(string key);

    /// <summary>
    /// Sets current language and raises LanguageChanged. Call when user changes language.
    /// </summary>
    void SetLanguage(string languageCode);

    /// <summary>
    /// Supported language codes (e.g. "zh", "en") for dropdown.
    /// </summary>
    IReadOnlyList<string> GetSupportedLanguages();

    /// <summary>
    /// Display names per language code (e.g. "zh" -> "中文"). For dropdown display.
    /// </summary>
    IReadOnlyDictionary<string, string> GetLanguageDisplayNames();

    /// <summary>
    /// Raised when language changes so UI can rebuild or refresh labels.
    /// </summary>
    event EventHandler<LanguageChangedEventArgs>? LanguageChanged;
}

/// <summary>
/// Event data for language change. Logic 1:1 with Python language change notification.
/// </summary>
public sealed class LanguageChangedEventArgs : EventArgs
{
    public string NewLanguage { get; }

    public LanguageChangedEventArgs(string newLanguage)
    {
        NewLanguage = newLanguage;
    }
}
