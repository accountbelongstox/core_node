package com.escodro.router.i18n

import kotlinx.serialization.Serializable

/**
 * Supported application locales.
 * 
 * Based on Kotlin Multiplatform Compose Resources localization.
 * See: https://kotlinlang.org/docs/multiplatform/compose-localize-strings.html
 */
@Serializable
enum class AppLocale(
    val languageCode: String,
    val countryCode: String? = null,
    val displayName: String,
) {
    /**
     * English (default)
     */
    ENGLISH("en", null, "English"),

    /**
     * Simplified Chinese
     */
    CHINESE_SIMPLIFIED("zh", "CN", "简体中文"),

    /**
     * Traditional Chinese
     */
    CHINESE_TRADITIONAL("zh", "TW", "繁體中文"),

    /**
     * Portuguese (Brazil)
     */
    PORTUGUESE_BRAZIL("pt", "BR", "Português (Brasil)"),

    /**
     * System default locale
     */
    SYSTEM_DEFAULT("", null, "System Default");

    /**
     * Get locale tag for Compose Resources.
     * Format: languageCode-countryCode (e.g., "zh-CN", "pt-BR")
     */
    val localeTag: String
        get() = when {
            countryCode != null -> "$languageCode-$countryCode"
            languageCode.isNotEmpty() -> languageCode
            else -> ""
        }

    companion object {
        /**
         * Get locale from language and country codes.
         */
        fun fromCodes(languageCode: String, countryCode: String? = null): AppLocale {
            return entries.firstOrNull {
                it.languageCode == languageCode && it.countryCode == countryCode
            } ?: ENGLISH
        }

        /**
         * Get locale from locale tag (e.g., "zh-CN", "pt-BR").
         */
        fun fromLocaleTag(tag: String): AppLocale {
            val parts = tag.split("-")
            return when (parts.size) {
                1 -> fromCodes(parts[0])
                2 -> fromCodes(parts[0], parts[1])
                else -> ENGLISH
            }
        }

        /**
         * Get all supported locales except system default.
         */
        fun getSupportedLocales(): List<AppLocale> {
            return entries.filter { it != SYSTEM_DEFAULT }
        }
    }
}

