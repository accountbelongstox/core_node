#ifndef LANGUAGEMANAGER_H
#define LANGUAGEMANAGER_H

#include <QObject>
#include <QTranslator>
#include <QLocale>
#include <QMap>

class LanguageManager : public QObject
{
    Q_OBJECT

public:
    enum Language {
        Chinese,    // Simplified Chinese
        English     // English
    };
    Q_ENUM(Language)

    static LanguageManager& instance();

    // Get current language
    Language currentLanguage() const;

    // Switch to specified language (real-time, no reload)
    bool switchLanguage(Language lang);

    // Auto-detect system language
    Language detectSystemLanguage();

    // Get language name for display
    QString languageName(Language lang) const;

    // Check if all translations are loaded in memory
    bool areTranslationsPreloaded() const;

    // Get memory usage info
    QString getMemoryInfo() const;

signals:
    void languageChanged(Language newLang);

private:
    explicit LanguageManager(QObject *parent = nullptr);
    ~LanguageManager();

    LanguageManager(const LanguageManager&) = delete;
    LanguageManager& operator=(const LanguageManager&) = delete;

    // Preload ALL translations into memory on startup
    void preloadAllTranslations();

    // Load a single language into memory
    bool loadTranslationToMemory(Language lang);

    // Get translation file path
    QString getTranslationFile(Language lang) const;

    // Get Qt translator file name
    QString getQtTranslationFile(Language lang) const;

    // Switch active translator (in-memory operation only)
    bool activateTranslator(Language lang);

    Language m_currentLanguage;

    // Map to store all preloaded translators in memory
    QMap<Language, QTranslator*> m_translators;      // App translators
    QMap<Language, QTranslator*> m_qtTranslators;    // Qt built-in translators

    // Track which translators are currently active
    Language m_activeLanguage;

    bool m_preloadComplete;
};

#endif // LANGUAGEMANAGER_H
