# I18n Configuration Files

This directory contains the internationalization (i18n) configuration files for the D3-Check application, split into multiple files for better maintainability.

## File Structure

### Base Configuration
- `i18n_base.json` - Base configuration with default language and supported languages

### Language-Specific Files
Each language has its own set of files:

#### Chinese (zh)
- `i18n_main_window_zh.json` - Main window and tabs
- `i18n_skill_config_zh.json` - Skill configuration and settings
- `i18n_auxiliary_panel_zh.json` - Auxiliary functions panel
- `i18n_rosbot_panel_zh.json` - ROSBOT extension panel
- `i18n_log_panel_zh.json` - Log panel
- `i18n_common_zh.json` - Common buttons, messages, and skills
- `i18n_errors_zh.json` - Error messages and options

#### English (en)
- `i18n_main_window_en.json` - Main window and tabs
- `i18n_skill_config_en.json` - Skill configuration and settings
- `i18n_auxiliary_panel_en.json` - Auxiliary functions panel
- `i18n_rosbot_panel_en.json` - ROSBOT extension panel
- `i18n_log_panel_en.json` - Log panel
- `i18n_common_en.json` - Common buttons, messages, and skills
- `i18n_errors_en.json` - Error messages and options

## Loading Order

The files are loaded in the following order to ensure proper dependency resolution:

1. `i18n_main_window_{language}.json`
2. `i18n_skill_config_{language}.json`
3. `i18n_auxiliary_panel_{language}.json`
4. `i18n_rosbot_panel_{language}.json`
5. `i18n_log_panel_{language}.json`
6. `i18n_common_{language}.json`
7. `i18n_errors_{language}.json`

## Usage

The `I18nManager` class automatically detects and loads these files. If the `i18n/` directory exists, it will use the multi-file configuration. Otherwise, it will fall back to the single `i18n_config.json` file.

## Adding New Translations

1. Add the new key-value pairs to the appropriate language file
2. Ensure the same keys exist in all supported languages
3. The changes will be automatically loaded on the next application restart

## Migration from Single File

The original `i18n_config.json` file has been split into these multiple files for better organization and maintainability. The `I18nManager` supports both formats for backward compatibility.
