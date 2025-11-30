<?php

namespace App\Apps\VipClubV1\VipClubV1Gvar;

class VipClubV1Config
{
    public const APP_NAME = 'VipClubV1';
    public const APP_VERSION = 'v1';
    public const API_BASE_PATH = '/api/vipclubv1/v1';

    public const PAGINATION_DEFAULT_LIMIT = 20;
    public const PAGINATION_MAX_LIMIT = 100;

    public const POINTS_PER_DOLLAR = 10;

    public const MEMBER_TYPES = [
        'GUEST' => 'guest',
        'REGULAR' => 'regular',
        'GOLD' => 'gold',
        'PLATINUM' => 'platinum',
        'DIAMOND' => 'diamond'
    ];

    public const FACILITY_TYPES = [
        'SHOOTING' => 'shooting',
        'GOLF' => 'golf',
        'HOTEL' => 'hotel'
    ];

    public const BOOKING_STATUSES = [
        'PENDING' => 'pending',
        'CONFIRMED' => 'confirmed',
        'CANCELLED' => 'cancelled',
        'COMPLETED' => 'completed'
    ];

    public const TRANSACTION_TYPES = [
        'EARN' => 'earn',
        'REDEEM' => 'redeem'
    ];

    public const TIER_THRESHOLDS = [
        'GOLD' => 10000,
        'PLATINUM' => 50000,
        'DIAMOND' => 100000
    ];

    public const DISCOUNT_RATES = [
        'GUEST' => 0.0,
        'REGULAR' => 0.0,
        'GOLD' => 0.10,
        'PLATINUM' => 0.20,
        'DIAMOND' => 0.30
    ];

    public const CARD_NUMBER_PREFIX = 'VC';

    public const CARD_VALIDITY_YEARS = 3;

    public const BOOKING_CANCELLATION_DEADLINE_HOURS = 24;

    public const BOOKING_MODIFICATION_DEADLINE_HOURS = 24;

    public static function get(string $key, $default = null)
    {
        if (defined("self::$key")) {
            return constant("self::$key");
        }
        return $default;
    }
}
