<?php

namespace App\Apps\McpV1\McpV1TablesMaps;

use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;

class McpV1TablesMaps
{
    /** Suffix of the voice-subtitle user settings table (full name: <mcpv1 prefix>_user_settings). */
    public const VOICE_SUBTITLE_USER_SETTINGS_SUFFIX = 'user_settings';

    /** The one name sys:init creates (VoiceSubtitleV1TableService) and the model reads, on the mcpv1 connection. */
    public static function voiceSubtitleUserSettingsTable(): string
    {
        return AppTablePrefixServiceProvider::buildTableName(AppKeys::MCPV1, self::VOICE_SUBTITLE_USER_SETTINGS_SUFFIX);
    }
}
