<?php

namespace App\Apps\AppQyV1\AppQyV1Enums;

enum AppQyV1ProgressActionEnum: string
{
    case READ = 'read';
    case REVIEW = 'review';

    public function isRead(): bool
    {
        return $this === self::READ;
    }

    public function isReview(): bool
    {
        return $this === self::REVIEW;
    }

    public static function values(): array
    {
        return array_column(self::cases(), 'value');
    }
}
