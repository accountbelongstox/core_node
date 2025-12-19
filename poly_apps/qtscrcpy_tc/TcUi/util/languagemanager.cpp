#include "languagemanager.h"
#include <QApplication>
#include <QLocale>
#include <QDebug>
#include <QDir>
#include <QLibraryInfo>
#include <QFileInfo>

LanguageManager& LanguageManager::instance()
{
    static LanguageManager instance;
    return instance;
}

LanguageManager::LanguageManager(QObject *parent)
    : QObject(parent)
    , m_currentLanguage(English)
    , m_activeLanguage(English)
    , m_preloadComplete(false)
{
    qInfo() << "========================================";
    qInfo() << "LanguageManager: Initializing...";
    qInfo() << "========================================";

    // STEP 1: Preload ALL translations into memory on startup
    qInfo() << "[PRELOAD] Loading all translation files into memory...";
    preloadAllTranslations();

    // STEP 2: Auto-detect system language
    Language sysLang = detectSystemLanguage();
    qInfo() << "[AUTO-DETECT] System language:" << languageName(sysLang);

    // STEP 3: Activate detected language (in-memory switch)
    qInfo() << "[ACTIVATE] Switching to system language...";
    switchLanguage(sysLang);

    qInfo() << "========================================";
    qInfo() << "LanguageManager: Ready";
    qInfo() << getMemoryInfo();
    qInfo() << "========================================";
}

LanguageManager::~LanguageManager()
{
    qInfo() << "LanguageManager: Cleaning up...";

    // Remove all translators from application
    for (auto it = m_translators.begin(); it != m_translators.end(); ++it) {
        if (it.value()) {
            qApp->removeTranslator(it.value());
            delete it.value();
        }
    }

    for (auto it = m_qtTranslators.begin(); it != m_qtTranslators.end(); ++it) {
        if (it.value()) {
            qApp->removeTranslator(it.value());
            delete it.value();
        }
    }

    qInfo() << "LanguageManager: Cleanup complete";
}

LanguageManager::Language LanguageManager::currentLanguage() const
{
    return m_currentLanguage;
}

bool LanguageManager::switchLanguage(Language lang)
{
    qInfo() << "========================================";
    qInfo() << "[SWITCH] Language switch requested";
    qInfo() << "[SWITCH] From:" << languageName(m_currentLanguage);
    qInfo() << "[SWITCH] To:" << languageName(lang);

    if (lang == m_currentLanguage) {
        qInfo() << "[SWITCH] Already using this language, no action needed";
        qInfo() << "========================================";
        return true;
    }

    if (!m_preloadComplete) {
        qWarning() << "[SWITCH] ERROR: Translations not preloaded!";
        return false;
    }

    // Check if target language translator exists in memory
    if (!m_translators.contains(lang)) {
        qWarning() << "[SWITCH] ERROR: Translator for" << languageName(lang) << "not found in memory!";
        return false;
    }

    qInfo() << "[SWITCH] Performing in-memory translator switch...";

    // REAL-TIME SWITCH: Only install/remove translators (already in memory)
    if (activateTranslator(lang)) {
        Language oldLang = m_currentLanguage;
        m_currentLanguage = lang;

        qInfo() << "[SWITCH] Success! Language changed from" << languageName(oldLang)
                << "to" << languageName(lang);
        qInfo() << "[SWITCH] Emitting languageChanged signal...";

        emit languageChanged(lang);

        qInfo() << "[SWITCH] UI will update automatically via changeEvent";
        qInfo() << "========================================";
        return true;
    }

    qWarning() << "[SWITCH] Failed to activate translator for" << languageName(lang);
    qInfo() << "========================================";
    return false;
}

LanguageManager::Language LanguageManager::detectSystemLanguage()
{
    QLocale systemLocale = QLocale::system();
    QLocale::Language sysLang = systemLocale.language();
    QString langString = QLocale::languageToString(sysLang);

    qInfo() << "[DETECT] System locale:" << systemLocale.name();
    qInfo() << "[DETECT] System language:" << langString;

    // Check if system language is Chinese
    if (sysLang == QLocale::Chinese) {
        qInfo() << "[DETECT] Chinese system detected → Using Chinese (简体中文)";
        return Chinese;
    }

    // Default to English for all other languages
    qInfo() << "[DETECT] Non-Chinese system detected → Using English";
    return English;
}

QString LanguageManager::languageName(Language lang) const
{
    switch (lang) {
    case Chinese:
        return QString::fromUtf8("简体中文");
    case English:
        return "English";
    default:
        return "Unknown";
    }
}

bool LanguageManager::areTranslationsPreloaded() const
{
    return m_preloadComplete;
}

QString LanguageManager::getMemoryInfo() const
{
    int appTransCount = m_translators.size();
    int qtTransCount = m_qtTranslators.size();
    int totalTrans = appTransCount + qtTransCount;

    QString info = QString("[MEMORY] Translators loaded: %1 (App: %2, Qt: %3)")
                       .arg(totalTrans)
                       .arg(appTransCount)
                       .arg(qtTransCount);

    info += QString("\n[MEMORY] Current active language: %1").arg(languageName(m_currentLanguage));
    info += QString("\n[MEMORY] Preload complete: %1").arg(m_preloadComplete ? "YES" : "NO");

    return info;
}

void LanguageManager::preloadAllTranslations()
{
    qInfo() << "[PRELOAD] ==================== START ====================";

    // Preload all supported languages
    QList<Language> languages = {Chinese, English};

    int successCount = 0;
    for (Language lang : languages) {
        qInfo() << "[PRELOAD] Loading:" << languageName(lang) << "...";

        if (loadTranslationToMemory(lang)) {
            successCount++;
            qInfo() << "[PRELOAD] ✓ Success:" << languageName(lang);
        } else {
            qWarning() << "[PRELOAD] ✗ Failed:" << languageName(lang);
        }
    }

    m_preloadComplete = (successCount > 0);

    qInfo() << "[PRELOAD] ==================== COMPLETE ====================";
    qInfo() << "[PRELOAD] Loaded" << successCount << "of" << languages.size() << "languages";
    qInfo() << "[PRELOAD] Status:" << (m_preloadComplete ? "SUCCESS" : "PARTIAL/FAILED");
    qInfo() << "[PRELOAD] ======================================================";
}

bool LanguageManager::loadTranslationToMemory(Language lang)
{
    QString appTransFile = getTranslationFile(lang);
    QString qtTransFile = getQtTranslationFile(lang);

    // Check if file exists
    QFileInfo fileInfo(appTransFile);
    if (!fileInfo.exists()) {
        qWarning() << "[LOAD] File not found:" << appTransFile;
        qWarning() << "[LOAD] Please run: lrelease 17_TcUi.pro";
        // Continue anyway, Qt translator might work
    }

    // Create app translator
    QTranslator *appTrans = new QTranslator(this);
    bool appLoaded = appTrans->load(appTransFile);

    if (appLoaded) {
        qInfo() << "[LOAD] ✓ App translator loaded:" << appTransFile;
        qInfo() << "[LOAD]   Size:" << fileInfo.size() << "bytes";
    } else {
        qWarning() << "[LOAD] ✗ Failed to load app translator:" << appTransFile;
        // Don't delete, keep empty translator
    }

    // Store in memory map
    m_translators[lang] = appTrans;

    // Create Qt built-in translator
    QTranslator *qtTrans = new QTranslator(this);

#if QT_VERSION >= QT_VERSION_CHECK(6, 0, 0)
    QString qtTransPath = QLibraryInfo::path(QLibraryInfo::TranslationsPath);
#else
    QString qtTransPath = QLibraryInfo::location(QLibraryInfo::TranslationsPath);
#endif

    bool qtLoaded = qtTrans->load(qtTransFile, qtTransPath);

    if (qtLoaded) {
        qInfo() << "[LOAD] ✓ Qt translator loaded:" << qtTransFile;
    } else {
        qInfo() << "[LOAD] - Qt translator not found (optional):" << qtTransFile;
        // This is optional, Qt might not have translations for all languages
    }

    // Store in memory map
    m_qtTranslators[lang] = qtTrans;

    qInfo() << "[LOAD] → Stored in memory for" << languageName(lang);

    return appLoaded || qtLoaded; // Success if at least one loaded
}

QString LanguageManager::getTranslationFile(Language lang) const
{
    QString basePath = QApplication::applicationDirPath();
    QString fileName;

    switch (lang) {
    case Chinese:
        fileName = "translations/XingCanMatrix_zh_CN.qm";
        break;
    case English:
        fileName = "translations/XingCanMatrix_en.qm";
        break;
    default:
        fileName = "translations/XingCanMatrix_en.qm";
    }

    return basePath + "/" + fileName;
}

QString LanguageManager::getQtTranslationFile(Language lang) const
{
    switch (lang) {
    case Chinese:
        return "qt_zh_CN";
    case English:
        return "qt_en";
    default:
        return "qt_en";
    }
}

bool LanguageManager::activateTranslator(Language lang)
{
    qInfo() << "[ACTIVATE] Removing old translators from app...";

    // Remove currently active translators
    if (m_translators.contains(m_activeLanguage)) {
        QTranslator *oldAppTrans = m_translators[m_activeLanguage];
        if (oldAppTrans) {
            qApp->removeTranslator(oldAppTrans);
            qInfo() << "[ACTIVATE] - Removed app translator for" << languageName(m_activeLanguage);
        }
    }

    if (m_qtTranslators.contains(m_activeLanguage)) {
        QTranslator *oldQtTrans = m_qtTranslators[m_activeLanguage];
        if (oldQtTrans) {
            qApp->removeTranslator(oldQtTrans);
            qInfo() << "[ACTIVATE] - Removed Qt translator for" << languageName(m_activeLanguage);
        }
    }

    qInfo() << "[ACTIVATE] Installing new translators to app...";

    // Install new translators (already in memory!)
    bool success = false;

    if (m_translators.contains(lang)) {
        QTranslator *newAppTrans = m_translators[lang];
        if (newAppTrans && !newAppTrans->isEmpty()) {
            qApp->installTranslator(newAppTrans);
            qInfo() << "[ACTIVATE] + Installed app translator for" << languageName(lang);
            success = true;
        }
    }

    if (m_qtTranslators.contains(lang)) {
        QTranslator *newQtTrans = m_qtTranslators[lang];
        if (newQtTrans && !newQtTrans->isEmpty()) {
            qApp->installTranslator(newQtTrans);
            qInfo() << "[ACTIVATE] + Installed Qt translator for" << languageName(lang);
            success = true;
        }
    }

    if (success) {
        m_activeLanguage = lang;
        qInfo() << "[ACTIVATE] ✓ Translators activated successfully";
        qInfo() << "[ACTIVATE] ⚡ In-memory switch complete (no disk I/O)";
    } else {
        qWarning() << "[ACTIVATE] ✗ No valid translators found for" << languageName(lang);
    }

    return success;
}
