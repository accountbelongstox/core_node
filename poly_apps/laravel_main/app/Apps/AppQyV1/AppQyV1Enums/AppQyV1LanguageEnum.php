<?php

namespace App\Apps\AppQyV1\AppQyV1Enums;

enum AppQyV1LanguageEnum: string
{
    case ENGLISH = 'en';
    case JAPANESE = 'ja';
    case LAO = 'lo';
    case VIETNAMESE = 'vi';
    case CHINESE = 'zh';

    public function label(): string
    {
        return match($this) {
            self::ENGLISH => 'English',
            self::JAPANESE => 'Japanese',
            self::LAO => 'Lao',
            self::VIETNAMESE => 'Vietnamese',
            self::CHINESE => 'Chinese',
        };
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }

    public static function fromValue(string $value): ?self
    {
        return self::tryFrom($value);
    }
}
