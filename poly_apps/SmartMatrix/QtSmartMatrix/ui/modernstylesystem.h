#ifndef MODERNSTYLESYSTEM_H
#define MODERNSTYLESYSTEM_H

#include <QObject>
#include <QColor>
#include <QFont>
#include <QPalette>
#include <QProperty>
#include <QTimer>
#include <QSettings>

/**
 * @brief Modern style system for SmartMatrix UI
 * 
 * Provides customizable themes, colors, fonts, and animations
 * Based on Qt6.9's modern styling capabilities
 */
class ModernStyleSystem : public QObject
{
    Q_OBJECT

public:
    // Theme types
    enum class Theme {
        Light = 0,
        Dark = 1,
        Auto = 2,
        Custom = 3
    };
    Q_ENUM(Theme)

    // Color roles
    enum class ColorRole {
        Primary = 0,
        Secondary = 1,
        Accent = 2,
        Background = 3,
        Surface = 4,
        Error = 5,
        Warning = 6,
        Success = 7,
        Info = 8,
        Text = 9,
        TextSecondary = 10,
        Border = 11,
        Shadow = 12
    };
    Q_ENUM(ColorRole)

    // Animation types
    enum class AnimationType {
        None = 0,
        Fade = 1,
        Slide = 2,
        Scale = 3,
        Rotate = 4,
        Custom = 5
    };
    Q_ENUM(AnimationType)

    // Using Qt6.9's QProperty system
    Q_PROPERTY(Theme currentTheme READ currentTheme WRITE setCurrentTheme NOTIFY currentThemeChanged)
    Q_PROPERTY(QColor primaryColor READ primaryColor WRITE setPrimaryColor NOTIFY primaryColorChanged)
    Q_PROPERTY(QColor secondaryColor READ secondaryColor WRITE setSecondaryColor NOTIFY secondaryColorChanged)
    Q_PROPERTY(QColor accentColor READ accentColor WRITE setAccentColor NOTIFY accentColorChanged)
    Q_PROPERTY(QColor backgroundColor READ backgroundColor WRITE setBackgroundColor NOTIFY backgroundColorChanged)
    Q_PROPERTY(QColor surfaceColor READ surfaceColor WRITE setSurfaceColor NOTIFY surfaceColorChanged)
    Q_PROPERTY(QColor textColor READ textColor WRITE setTextColor NOTIFY textColorChanged)
    Q_PROPERTY(QColor borderColor READ borderColor WRITE setBorderColor NOTIFY borderColorChanged)
    Q_PROPERTY(QFont primaryFont READ primaryFont WRITE setPrimaryFont NOTIFY primaryFontChanged)
    Q_PROPERTY(QFont secondaryFont READ secondaryFont WRITE setSecondaryFont NOTIFY secondaryFontChanged)
    Q_PROPERTY(int animationDuration READ animationDuration WRITE setAnimationDuration NOTIFY animationDurationChanged)
    Q_PROPERTY(bool animationsEnabled READ animationsEnabled WRITE setAnimationsEnabled NOTIFY animationsEnabledChanged)
    Q_PROPERTY(bool highContrast READ highContrast WRITE setHighContrast NOTIFY highContrastChanged)
    Q_PROPERTY(qreal borderRadius READ borderRadius WRITE setBorderRadius NOTIFY borderRadiusChanged)
    Q_PROPERTY(qreal shadowRadius READ shadowRadius WRITE setShadowRadius NOTIFY shadowRadiusChanged)

    // Singleton access
    static ModernStyleSystem* instance();
    static void destroyInstance();

    // Theme management
    Theme currentTheme() const { return m_currentTheme; }
    void setCurrentTheme(Theme theme);
    void setCurrentTheme(const QString &themeName);
    QStringList availableThemes() const;
    void loadTheme(const QString &themeName);
    void saveTheme(const QString &themeName);
    void deleteTheme(const QString &themeName);

    // Color management
    QColor primaryColor() const { return m_primaryColor; }
    void setPrimaryColor(const QColor &color);
    QColor secondaryColor() const { return m_secondaryColor; }
    void setSecondaryColor(const QColor &color);
    QColor accentColor() const { return m_accentColor; }
    void setAccentColor(const QColor &color);
    QColor backgroundColor() const { return m_backgroundColor; }
    void setBackgroundColor(const QColor &color);
    QColor surfaceColor() const { return m_surfaceColor; }
    void setSurfaceColor(const QColor &color);
    QColor textColor() const { return m_textColor; }
    void setTextColor(const QColor &color);
    QColor borderColor() const { return m_borderColor; }
    void setBorderColor(const QColor &color);

    // Color utilities
    QColor getColor(ColorRole role) const;
    void setColor(ColorRole role, const QColor &color);
    QColor getColorWithAlpha(ColorRole role, int alpha) const;
    QColor getLighterColor(ColorRole role, int factor = 120) const;
    QColor getDarkerColor(ColorRole role, int factor = 120) const;
    QColor getContrastingColor(const QColor &color) const;

    // Font management
    QFont primaryFont() const { return m_primaryFont; }
    void setPrimaryFont(const QFont &font);
    QFont secondaryFont() const { return m_secondaryFont; }
    void setSecondaryFont(const QFont &font);
    QFont getFont(const QString &fontFamily, int pointSize = -1, QFont::Weight weight = QFont::Normal) const;

    // Animation management
    int animationDuration() const { return m_animationDuration; }
    void setAnimationDuration(int duration);
    bool animationsEnabled() const { return m_animationsEnabled; }
    void setAnimationsEnabled(bool enabled);
    AnimationType getAnimationType(const QString &widgetType) const;
    void setAnimationType(const QString &widgetType, AnimationType type);

    // Accessibility
    bool highContrast() const { return m_highContrast; }
    void setHighContrast(bool enabled);

    // Visual properties
    qreal borderRadius() const { return m_borderRadius; }
    void setBorderRadius(qreal radius);
    qreal shadowRadius() const { return m_shadowRadius; }
    void setShadowRadius(qreal radius);

    // Style generation
    QString generateStyleSheet() const;
    void updateApplicationStyle();
    QString generateWidgetStyleSheet(const QString &widgetType) const;
    QString generateAnimationStyleSheet(const QString &widgetType) const;
    QPalette generatePalette() const;

    // Configuration
    void loadConfiguration();
    void saveConfiguration();
    void loadSettings();
    void saveSettings();
    void resetToDefaults();
    void exportConfiguration(const QString &filePath) const;
    void importConfiguration(const QString &filePath);

    // Theme presets
    void applyLightTheme();
    void applyDarkTheme();
    void applyHighContrastTheme();
    void applyCustomTheme(const QColor &primary, const QColor &secondary, const QColor &accent);

signals:
    void currentThemeChanged();
    void primaryColorChanged();
    void secondaryColorChanged();
    void accentColorChanged();
    void backgroundColorChanged();
    void surfaceColorChanged();
    void textColorChanged();
    void borderColorChanged();
    void primaryFontChanged();
    void secondaryFontChanged();
    void animationDurationChanged();
    void animationsEnabledChanged();
    void highContrastChanged();
    void borderRadiusChanged();
    void shadowRadiusChanged();

    void themeLoaded(const QString &themeName);
    void themeSaved(const QString &themeName);
    void themeDeleted(const QString &themeName);
    void configurationLoaded();
    void configurationSaved();
    void configurationReset();

public:
    explicit ModernStyleSystem(QObject *parent = nullptr);
    ~ModernStyleSystem();

private:

    void setupDefaultThemes();
    void setupDefaultColors();
    void setupDefaultFonts();
    void setupDefaultAnimations();
    void updateColorPalette();
    void updateFontMetrics();
    void setupAutoSave();

    // Data members
    static ModernStyleSystem *s_instance;

    // Theme and colors
    Theme m_currentTheme = Theme::Light;
    QColor m_primaryColor;
    QColor m_secondaryColor;
    QColor m_accentColor;
    QColor m_backgroundColor;
    QColor m_surfaceColor;
    QColor m_textColor;
    QColor m_borderColor;
    QColor m_errorColor;
    QColor m_warningColor;
    QColor m_successColor;
    QColor m_infoColor;
    QColor m_textSecondaryColor;
    QColor m_shadowColor;

    // Fonts
    QFont m_primaryFont;
    QFont m_secondaryFont;

    // Animation settings
    int m_animationDuration = 200; // milliseconds
    bool m_animationsEnabled = true;
    QHash<QString, AnimationType> m_animationTypes;

    // Visual properties
    qreal m_borderRadius = 8.0;
    qreal m_shadowRadius = 4.0;
    bool m_highContrast = false;

    // Configuration
    QSettings *m_settings;
    QTimer *m_autoSaveTimer;
    QString m_configPath;

    // Constants
    static const int AUTO_SAVE_INTERVAL_MS = 5000; // 5 seconds
    static const QString DEFAULT_CONFIG_FILE;
    static const QString THEMES_CONFIG_GROUP;
    static const QString COLORS_CONFIG_GROUP;
    static const QString FONTS_CONFIG_GROUP;
    static const QString ANIMATIONS_CONFIG_GROUP;
    static const QString VISUAL_CONFIG_GROUP;
};

#endif // MODERNSTYLESYSTEM_H
