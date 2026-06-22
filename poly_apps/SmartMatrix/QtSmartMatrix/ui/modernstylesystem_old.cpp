#include "modernstylesystem.h"
#include <QApplication>
#include <QStyle>
#include <QDebug>

ModernStyleSystem::ModernStyleSystem(QObject *parent)
    : QObject(parent)
    , m_currentTheme(Theme::Light)
    , m_primaryColor(QColor(0, 120, 215))
    , m_secondaryColor(QColor(107, 107, 107))
    , m_accentColor(QColor(255, 140, 0))
    , m_backgroundColor(QColor(255, 255, 255))
    , m_surfaceColor(QColor(248, 248, 248))
    , m_textColor(QColor(0, 0, 0))
    , m_borderColor(QColor(200, 200, 200))
    , m_primaryFont(QFont("Segoe UI", 9))
    , m_secondaryFont(QFont("Segoe UI", 8))
    , m_animationDuration(200)
    , m_animationsEnabled(true)
    , m_highContrast(false)
    , m_borderRadius(4.0)
    , m_shadowRadius(8.0)
{
    // Initialize default theme
    applyTheme(m_currentTheme);
}

ModernStyleSystem::~ModernStyleSystem()
{
}

Theme ModernStyleSystem::currentTheme() const
{
    return m_currentTheme;
}

void ModernStyleSystem::setCurrentTheme(Theme theme)
{
    if (m_currentTheme != theme) {
        m_currentTheme = theme;
        applyTheme(theme);
        emit currentThemeChanged();
    }
}

QColor ModernStyleSystem::primaryColor() const
{
    return m_primaryColor;
}

void ModernStyleSystem::setPrimaryColor(const QColor &color)
{
    if (m_primaryColor != color) {
        m_primaryColor = color;
        emit primaryColorChanged();
        updateApplicationStyle();
    }
}

QColor ModernStyleSystem::secondaryColor() const
{
    return m_secondaryColor;
}

void ModernStyleSystem::setSecondaryColor(const QColor &color)
{
    if (m_secondaryColor != color) {
        m_secondaryColor = color;
        emit secondaryColorChanged();
        updateApplicationStyle();
    }
}

QColor ModernStyleSystem::accentColor() const
{
    return m_accentColor;
}

void ModernStyleSystem::setAccentColor(const QColor &color)
{
    if (m_accentColor != color) {
        m_accentColor = color;
        emit accentColorChanged();
        updateApplicationStyle();
    }
}

QColor ModernStyleSystem::backgroundColor() const
{
    return m_backgroundColor;
}

void ModernStyleSystem::setBackgroundColor(const QColor &color)
{
    if (m_backgroundColor != color) {
        m_backgroundColor = color;
        emit backgroundColorChanged();
        updateApplicationStyle();
    }
}

QColor ModernStyleSystem::surfaceColor() const
{
    return m_surfaceColor;
}

void ModernStyleSystem::setSurfaceColor(const QColor &color)
{
    if (m_surfaceColor != color) {
        m_surfaceColor = color;
        emit surfaceColorChanged();
        updateApplicationStyle();
    }
}

QColor ModernStyleSystem::textColor() const
{
    return m_textColor;
}

void ModernStyleSystem::setTextColor(const QColor &color)
{
    if (m_textColor != color) {
        m_textColor = color;
        emit textColorChanged();
        updateApplicationStyle();
    }
}

QColor ModernStyleSystem::borderColor() const
{
    return m_borderColor;
}

void ModernStyleSystem::setBorderColor(const QColor &color)
{
    if (m_borderColor != color) {
        m_borderColor = color;
        emit borderColorChanged();
        updateApplicationStyle();
    }
}

QFont ModernStyleSystem::primaryFont() const
{
    return m_primaryFont;
}

void ModernStyleSystem::setPrimaryFont(const QFont &font)
{
    if (m_primaryFont != font) {
        m_primaryFont = font;
        emit primaryFontChanged();
        updateApplicationStyle();
    }
}

QFont ModernStyleSystem::secondaryFont() const
{
    return m_secondaryFont;
}

void ModernStyleSystem::setSecondaryFont(const QFont &font)
{
    if (m_secondaryFont != font) {
        m_secondaryFont = font;
        emit secondaryFontChanged();
        updateApplicationStyle();
    }
}

int ModernStyleSystem::animationDuration() const
{
    return m_animationDuration;
}

void ModernStyleSystem::setAnimationDuration(int duration)
{
    if (m_animationDuration != duration) {
        m_animationDuration = duration;
        emit animationDurationChanged();
    }
}

bool ModernStyleSystem::animationsEnabled() const
{
    return m_animationsEnabled;
}

void ModernStyleSystem::setAnimationsEnabled(bool enabled)
{
    if (m_animationsEnabled != enabled) {
        m_animationsEnabled = enabled;
        emit animationsEnabledChanged();
    }
}

bool ModernStyleSystem::highContrast() const
{
    return m_highContrast;
}

void ModernStyleSystem::setHighContrast(bool enabled)
{
    if (m_highContrast != enabled) {
        m_highContrast = enabled;
        emit highContrastChanged();
        updateApplicationStyle();
    }
}

double ModernStyleSystem::borderRadius() const
{
    return m_borderRadius;
}

void ModernStyleSystem::setBorderRadius(double radius)
{
    if (m_borderRadius != radius) {
        m_borderRadius = radius;
        emit borderRadiusChanged();
        updateApplicationStyle();
    }
}

double ModernStyleSystem::shadowRadius() const
{
    return m_shadowRadius;
}

void ModernStyleSystem::setShadowRadius(double radius)
{
    if (m_shadowRadius != radius) {
        m_shadowRadius = radius;
        emit shadowRadiusChanged();
        updateApplicationStyle();
    }
}

QColor ModernStyleSystem::getColor(ColorRole role) const
{
    switch (role) {
    case ColorRole::Primary:
        return m_primaryColor;
    case ColorRole::Secondary:
        return m_secondaryColor;
    case ColorRole::Accent:
        return m_accentColor;
    case ColorRole::Background:
        return m_backgroundColor;
    case ColorRole::Surface:
        return m_surfaceColor;
    case ColorRole::Text:
        return m_textColor;
    case ColorRole::Border:
        return m_borderColor;
    case ColorRole::Error:
        return QColor(220, 53, 69);
    case ColorRole::Warning:
        return QColor(255, 193, 7);
    case ColorRole::Success:
        return QColor(40, 167, 69);
    case ColorRole::Info:
        return QColor(23, 162, 184);
    case ColorRole::TextSecondary:
        return m_textColor.darker(150);
    case ColorRole::Shadow:
        return QColor(0, 0, 0, 50);
    default:
        return QColor();
    }
}

QString ModernStyleSystem::generateStyleSheet() const
{
    QString styleSheet = QString(
        "QWidget {"
        "    background-color: %1;"
        "    color: %2;"
        "    font-family: '%3';"
        "    font-size: %4px;"
        "}"
        "QPushButton {"
        "    background-color: %5;"
        "    color: white;"
        "    border: 1px solid %6;"
        "    border-radius: %7px;"
        "    padding: 8px 16px;"
        "    font-weight: bold;"
        "}"
        "QPushButton:hover {"
        "    background-color: %8;"
        "}"
        "QPushButton:pressed {"
        "    background-color: %9;"
        "}"
        "QTreeWidget {"
        "    background-color: %10;"
        "    border: 1px solid %6;"
        "    border-radius: %7px;"
        "    selection-background-color: %5;"
        "}"
        "QTreeWidget::item {"
        "    padding: 4px;"
        "    border-bottom: 1px solid %6;"
        "}"
        "QTreeWidget::item:selected {"
        "    background-color: %5;"
        "    color: white;"
        "}"
        "QTreeWidget::item:hover {"
        "    background-color: %11;"
        "}"
    ).arg(m_backgroundColor.name())
     .arg(m_textColor.name())
     .arg(m_primaryFont.family())
     .arg(m_primaryFont.pointSize())
     .arg(m_primaryColor.name())
     .arg(m_borderColor.name())
     .arg(m_borderRadius)
     .arg(m_primaryColor.lighter(110).name())
     .arg(m_primaryColor.darker(110).name())
     .arg(m_surfaceColor.name())
     .arg(m_surfaceColor.darker(105).name());

    return styleSheet;
}

void ModernStyleSystem::applyTheme(Theme theme)
{
    switch (theme) {
    case Theme::Light:
        m_primaryColor = QColor(0, 120, 215);
        m_secondaryColor = QColor(107, 107, 107);
        m_accentColor = QColor(255, 140, 0);
        m_backgroundColor = QColor(255, 255, 255);
        m_surfaceColor = QColor(248, 248, 248);
        m_textColor = QColor(0, 0, 0);
        m_borderColor = QColor(200, 200, 200);
        break;
    case Theme::Dark:
        m_primaryColor = QColor(0, 120, 215);
        m_secondaryColor = QColor(107, 107, 107);
        m_accentColor = QColor(255, 140, 0);
        m_backgroundColor = QColor(32, 32, 32);
        m_surfaceColor = QColor(48, 48, 48);
        m_textColor = QColor(255, 255, 255);
        m_borderColor = QColor(80, 80, 80);
        break;
    case Theme::Auto:
        // Auto theme would detect system theme
        applyTheme(Theme::Light); // Default to light for now
        break;
    case Theme::Custom:
        // Custom theme uses user-defined colors
        break;
    }
    
    updateApplicationStyle();
}

void ModernStyleSystem::updateApplicationStyle()
{
    if (QApplication::instance()) {
        QString styleSheet = generateStyleSheet();
        QApplication::instance()->setStyleSheet(styleSheet);
    }
}

void ModernStyleSystem::saveSettings()
{
    QSettings settings;
    settings.beginGroup("ModernStyleSystem");
    settings.setValue("currentTheme", static_cast<int>(m_currentTheme));
    settings.setValue("primaryColor", m_primaryColor);
    settings.setValue("secondaryColor", m_secondaryColor);
    settings.setValue("accentColor", m_accentColor);
    settings.setValue("backgroundColor", m_backgroundColor);
    settings.setValue("surfaceColor", m_surfaceColor);
    settings.setValue("textColor", m_textColor);
    settings.setValue("borderColor", m_borderColor);
    settings.setValue("primaryFont", m_primaryFont);
    settings.setValue("secondaryFont", m_secondaryFont);
    settings.setValue("animationDuration", m_animationDuration);
    settings.setValue("animationsEnabled", m_animationsEnabled);
    settings.setValue("highContrast", m_highContrast);
    settings.setValue("borderRadius", m_borderRadius);
    settings.setValue("shadowRadius", m_shadowRadius);
    settings.endGroup();
}

void ModernStyleSystem::loadSettings()
{
    QSettings settings;
    settings.beginGroup("ModernStyleSystem");
    setCurrentTheme(static_cast<Theme>(settings.value("currentTheme", static_cast<int>(Theme::Light)).toInt()));
    setPrimaryColor(settings.value("primaryColor", m_primaryColor).value<QColor>());
    setSecondaryColor(settings.value("secondaryColor", m_secondaryColor).value<QColor>());
    setAccentColor(settings.value("accentColor", m_accentColor).value<QColor>());
    setBackgroundColor(settings.value("backgroundColor", m_backgroundColor).value<QColor>());
    setSurfaceColor(settings.value("surfaceColor", m_surfaceColor).value<QColor>());
    setTextColor(settings.value("textColor", m_textColor).value<QColor>());
    setBorderColor(settings.value("borderColor", m_borderColor).value<QColor>());
    setPrimaryFont(settings.value("primaryFont", m_primaryFont).value<QFont>());
    setSecondaryFont(settings.value("secondaryFont", m_secondaryFont).value<QFont>());
    setAnimationDuration(settings.value("animationDuration", m_animationDuration).toInt());
    setAnimationsEnabled(settings.value("animationsEnabled", m_animationsEnabled).toBool());
    setHighContrast(settings.value("highContrast", m_highContrast).toBool());
    setBorderRadius(settings.value("borderRadius", m_borderRadius).toDouble());
    setShadowRadius(settings.value("shadowRadius", m_shadowRadius).toDouble());
    settings.endGroup();
}
