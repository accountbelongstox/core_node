<?php

namespace App\Apps\VipClubV1\VipClubV1Utils;

use App\Apps\VipClubV1\VipClubV1Models\VipClubV1BookingModel;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use Carbon\Carbon;

class VipClubV1BookingUtils
{
    public const FACILITY_TYPES = ['shooting', 'golf', 'hotel'];
    public const BOOKING_STATUSES = ['pending', 'confirmed', 'cancelled', 'completed'];

    public const DEFAULT_TIME_SLOTS = [
        '09:00-10:00',
        '10:00-11:00',
        '11:00-12:00',
        '12:00-13:00',
        '13:00-14:00',
        '14:00-15:00',
        '15:00-16:00',
        '16:00-17:00',
        '17:00-18:00',
        '18:00-19:00',
        '19:00-20:00',
        '20:00-21:00'
    ];

    public static function isValidFacilityType(string $type): bool
    {
        return in_array($type, self::FACILITY_TYPES);
    }

    public static function isValidBookingStatus(string $status): bool
    {
        return in_array($status, self::BOOKING_STATUSES);
    }

    public static function calculateBookingPrice(float $basePrice, int $duration = 1): float
    {
        return round($basePrice * $duration, 2);
    }

    public static function checkAvailability(int $facilityId, string $date, string $timeSlot): bool
    {
        $existingBooking = VipClubV1BookingModel::where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_id'), $facilityId)
            ->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date'), $date)
            ->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'time_slot'), $timeSlot)
            ->whereIn(VipClubV1TablesMap::getFieldName('BOOKINGS', 'status'), ['pending', 'confirmed'])
            ->exists();

        return !$existingBooking;
    }

    public static function getAvailableSlots(int $facilityId, string $date, ?array $facilityAvailableTimes = null): array
    {
        $timeSlots = $facilityAvailableTimes ?? self::DEFAULT_TIME_SLOTS;

        $bookedSlots = VipClubV1BookingModel::where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_id'), $facilityId)
            ->where(VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date'), $date)
            ->whereIn(VipClubV1TablesMap::getFieldName('BOOKINGS', 'status'), ['pending', 'confirmed'])
            ->pluck(VipClubV1TablesMap::getFieldName('BOOKINGS', 'time_slot'))
            ->toArray();

        return array_values(array_diff($timeSlots, $bookedSlots));
    }

    public static function canCancelBooking(VipClubV1BookingModel $booking): bool
    {
        if (!in_array($booking->status, ['pending', 'confirmed'])) {
            return false;
        }

        $bookingDateTime = Carbon::parse($booking->booking_date);
        $now = Carbon::now();

        return $bookingDateTime->greaterThan($now);
    }

    public static function canModifyBooking(VipClubV1BookingModel $booking): bool
    {
        if (!in_array($booking->status, ['pending', 'confirmed'])) {
            return false;
        }

        $bookingDateTime = Carbon::parse($booking->booking_date);
        $now = Carbon::now();

        return $bookingDateTime->greaterThan($now->addHours(24));
    }

    public static function generateBookingNumber(): string
    {
        return 'BK' . date('Ymd') . strtoupper(substr(uniqid(), -6));
    }

    public static function isBookingExpired(VipClubV1BookingModel $booking): bool
    {
        $bookingDateTime = Carbon::parse($booking->booking_date);
        $now = Carbon::now();

        return $bookingDateTime->lessThan($now) &&
               in_array($booking->status, ['pending', 'confirmed']);
    }

    public static function getBookingStatusLabel(string $status): string
    {
        $labels = [
            'pending' => 'Pending Confirmation',
            'confirmed' => 'Confirmed',
            'cancelled' => 'Cancelled',
            'completed' => 'Completed'
        ];

        return $labels[$status] ?? $status;
    }
}
