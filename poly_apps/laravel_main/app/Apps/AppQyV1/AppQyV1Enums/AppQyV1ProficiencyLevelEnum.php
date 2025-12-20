<?php

namespace App\Apps\AppQyV1\AppQyV1Enums;

enum AppQyV1ProficiencyLevelEnum: string
{
    case MASTERED = 'mastered';
    case LEARNING = 'learning';
    case STRUGGLING = 'struggling';

    public function minProficiency(): float
    {
        return match($this) {
            self::MASTERED => 90.0,
            self::LEARNING => 60.0,
            self::STRUGGLING => 0.0,
        };
    }

    public function maxProficiency(): float
    {
        return match($this) {
            self::MASTERED => 100.0,
            self::LEARNING => 89.99,
            self::STRUGGLING => 59.99,
        };
    }

    public function reviewIntervalDays(): int
    {
        return match($this) {
            self::MASTERED => 30,
            self::LEARNING => 7,
            self::STRUGGLING => 1,
        };
    }

    public static function fromProficiency(float $proficiency): self
    {
        return match(true) {
            $proficiency >= 90 => self::MASTERED,
            $proficiency >= 60 => self::LEARNING,
            default => self::STRUGGLING,
        };
    }

    public function label(): string
    {
        return match($this) {
            self::MASTERED => 'Mastered',
            self::LEARNING => 'Learning',
            self::STRUGGLING => 'Struggling',
        };
    }
}
