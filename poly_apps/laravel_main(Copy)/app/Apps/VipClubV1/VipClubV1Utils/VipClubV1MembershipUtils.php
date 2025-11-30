<?php

namespace App\Apps\VipClubV1\VipClubV1Utils;

class VipClubV1MembershipUtils
{
    public const MEMBER_TYPES = [
        'guest' => 'guest',
        'regular' => 'regular',
        'gold' => 'gold',
        'platinum' => 'platinum',
        'diamond' => 'diamond'
    ];

    public const TIER_THRESHOLDS = [
        'gold' => 10000,
        'platinum' => 50000,
        'diamond' => 100000
    ];

    public const DISCOUNT_RATES = [
        'guest' => 0.0,
        'regular' => 0.0,
        'gold' => 0.10,
        'platinum' => 0.20,
        'diamond' => 0.30
    ];

    public const POINTS_PER_DOLLAR = 10;

    public static function getMemberTypeByPoints(int $points): string
    {
        if ($points >= self::TIER_THRESHOLDS['diamond']) {
            return 'diamond';
        } elseif ($points >= self::TIER_THRESHOLDS['platinum']) {
            return 'platinum';
        } elseif ($points >= self::TIER_THRESHOLDS['gold']) {
            return 'gold';
        } else {
            return 'regular';
        }
    }

    public static function getDiscountRate(string $memberType): float
    {
        return self::DISCOUNT_RATES[$memberType] ?? 0.0;
    }

    public static function calculateDiscount(float $amount, string $memberType): float
    {
        $discountRate = self::getDiscountRate($memberType);
        return round($amount * $discountRate, 2);
    }

    public static function calculateFinalPrice(float $price, string $memberType): float
    {
        $discount = self::calculateDiscount($price, $memberType);
        return round($price - $discount, 2);
    }

    public static function calculateEarnedPoints(float $amount): int
    {
        return (int) floor($amount * self::POINTS_PER_DOLLAR);
    }

    public static function getPointsToNextTier(int $currentPoints): ?int
    {
        $currentTier = self::getMemberTypeByPoints($currentPoints);

        if ($currentTier === 'diamond') {
            return null;
        }

        $tierOrder = ['regular', 'gold', 'platinum', 'diamond'];
        $currentIndex = array_search($currentTier, $tierOrder);

        if ($currentIndex !== false && isset($tierOrder[$currentIndex + 1])) {
            $nextTier = $tierOrder[$currentIndex + 1];
            if (isset(self::TIER_THRESHOLDS[$nextTier])) {
                return self::TIER_THRESHOLDS[$nextTier] - $currentPoints;
            }
        }

        return null;
    }

    public static function getMemberBenefits(string $memberType): array
    {
        $benefits = [
            'guest' => [],
            'regular' => [
                'Basic access to facilities',
                'Standard booking priority'
            ],
            'gold' => [
                'Basic access to facilities',
                'Standard booking priority',
                '10% discount on all bookings',
                'Priority customer support',
                'Access to member-only events'
            ],
            'platinum' => [
                'Basic access to facilities',
                'Standard booking priority',
                '20% discount on all bookings',
                'Priority customer support',
                'Access to member-only events',
                'Early booking access',
                'Complimentary upgrades'
            ],
            'diamond' => [
                'Basic access to facilities',
                'Standard booking priority',
                '30% discount on all bookings',
                'Priority customer support',
                'Access to member-only events',
                'Early booking access',
                'Complimentary upgrades',
                'Personal concierge service',
                'Exclusive VIP lounge access',
                'Free cancellation'
            ]
        ];

        return $benefits[$memberType] ?? [];
    }

    public static function getTierInfo(string $memberType): array
    {
        return [
            'name' => $memberType,
            'discount_rate' => self::getDiscountRate($memberType),
            'benefits' => self::getMemberBenefits($memberType),
            'required_points' => self::TIER_THRESHOLDS[$memberType] ?? 0
        ];
    }

    public static function getAllTiers(): array
    {
        $tiers = [];
        foreach (self::MEMBER_TYPES as $type) {
            if ($type !== 'guest') {
                $tiers[] = self::getTierInfo($type);
            }
        }
        return $tiers;
    }
}
