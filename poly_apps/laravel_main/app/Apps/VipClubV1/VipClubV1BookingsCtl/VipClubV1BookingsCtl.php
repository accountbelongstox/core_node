<?php

namespace App\Apps\VipClubV1\VipClubV1BookingsCtl;

use App\Http\Controllers\Controller;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1BookingModel;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1FacilityModel;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1PointsTransactionModel;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1ResponseUtils;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1BookingUtils;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1MembershipUtils;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Apps\VipClubV1\VipClubV1Gvar\VipClubV1Config;
use App\Providers\GlobalTablesMap;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;

class VipClubV1BookingsCtl extends Controller
{
    public function create(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'facility_type' => 'required|string|in:shooting,golf,hotel',
            'facility_id' => 'required|integer|exists:vipclubv1_facilities,id',
            'booking_date' => 'required|date|after_or_equal:today',
            'time_slot' => 'required|string',
            'duration' => 'sometimes|integer|min:1',
            'extras' => 'sometimes|array'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $facility = VipClubV1FacilityModel::find($request->facility_id);

        if (!$facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'is_active')}) {
            return VipClubV1ResponseUtils::error('Facility is not active');
        }

        $isAvailable = VipClubV1BookingUtils::checkAvailability(
            $request->facility_id,
            $request->booking_date,
            $request->time_slot
        );

        if (!$isAvailable) {
            return VipClubV1ResponseUtils::error('Time slot is not available', 409);
        }

        $user = $request->user();
        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];
        $memberType = $user->{$userFields['member_type']};

        $duration = $request->duration ?? 1;
        $price = VipClubV1BookingUtils::calculateBookingPrice(
            $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'base_price')},
            $duration
        );

        $discount = VipClubV1MembershipUtils::calculateDiscount($price, $memberType);
        $finalPrice = $price - $discount;

        try {
            DB::beginTransaction();

            $booking = new VipClubV1BookingModel();
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'user_id')} = $user->id;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_id')} = $request->facility_id;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_type')} = $request->facility_type;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_name')} = $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'name')};
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date')} = $request->booking_date;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'time_slot')} = $request->time_slot;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'duration')} = $duration;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'price')} = $price;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'discount')} = $discount;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'final_price')} = $finalPrice;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'status')} = 'confirmed';
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'extras')} = $request->extras;
            $booking->save();

            $earnedPoints = VipClubV1MembershipUtils::calculateEarnedPoints($finalPrice);

            if ($earnedPoints > 0) {
                $transaction = new VipClubV1PointsTransactionModel();
                $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'user_id')} = $user->id;
                $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'points')} = $earnedPoints;
                $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'type')} = 'earn';
                $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'description')} = "Points earned from booking #{$booking->id}";
                $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'related_booking_id')} = $booking->id;
                $transaction->save();

                $user->{$userFields['vip_points']} = $user->{$userFields['vip_points']} + $earnedPoints;
                $newMemberType = VipClubV1MembershipUtils::getMemberTypeByPoints($user->{$userFields['vip_points']});
                $user->{$userFields['member_type']} = $newMemberType;
                $user->save();
            }

            DB::commit();

            return VipClubV1ResponseUtils::created(
                $this->formatBookingResponse($booking),
                'Booking created successfully'
            );

        } catch (\Exception $e) {
            DB::rollBack();
            return VipClubV1ResponseUtils::serverError('Failed to create booking: ' . $e->getMessage());
        }
    }

    public function myBookings(Request $request): JsonResponse
    {
        $user = $request->user();

        $page = $request->query('page', 1);
        $limit = min($request->query('limit', VipClubV1Config::PAGINATION_DEFAULT_LIMIT), VipClubV1Config::PAGINATION_MAX_LIMIT);

        $query = VipClubV1BookingModel::byUser($user->id);

        if ($request->has('status') && $request->status) {
            $query->byStatus($request->status);
        }

        $total = $query->count();

        $bookings = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        $formattedBookings = $bookings->map(function ($booking) {
            return $this->formatBookingResponse($booking);
        });

        return VipClubV1ResponseUtils::paginated(
            $formattedBookings,
            $total,
            $page,
            $limit
        );
    }

    public function show(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $booking = VipClubV1BookingModel::find($id);

        if (!$booking) {
            return VipClubV1ResponseUtils::notFound('Booking not found');
        }

        if ($booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'user_id')} !== $user->id) {
            return VipClubV1ResponseUtils::forbidden('You do not have permission to view this booking');
        }

        return VipClubV1ResponseUtils::success(
            $this->formatBookingResponse($booking)
        );
    }

    public function cancel(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $booking = VipClubV1BookingModel::find($id);

        if (!$booking) {
            return VipClubV1ResponseUtils::notFound('Booking not found');
        }

        if ($booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'user_id')} !== $user->id) {
            return VipClubV1ResponseUtils::forbidden('You do not have permission to cancel this booking');
        }

        if (!VipClubV1BookingUtils::canCancelBooking($booking)) {
            return VipClubV1ResponseUtils::error('Booking cannot be cancelled');
        }

        $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'status')} = 'cancelled';
        $booking->save();

        return VipClubV1ResponseUtils::success(
            $this->formatBookingResponse($booking),
            'Booking cancelled successfully'
        );
    }

    public function update(Request $request, $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'booking_date' => 'sometimes|date|after_or_equal:today',
            'time_slot' => 'sometimes|string',
            'duration' => 'sometimes|integer|min:1'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $user = $request->user();

        $booking = VipClubV1BookingModel::find($id);

        if (!$booking) {
            return VipClubV1ResponseUtils::notFound('Booking not found');
        }

        if ($booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'user_id')} !== $user->id) {
            return VipClubV1ResponseUtils::forbidden('You do not have permission to update this booking');
        }

        if (!VipClubV1BookingUtils::canModifyBooking($booking)) {
            return VipClubV1ResponseUtils::error('Booking cannot be modified');
        }

        if ($request->has('booking_date') || $request->has('time_slot')) {
            $newDate = $request->booking_date ?? $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date')};
            $newTimeSlot = $request->time_slot ?? $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'time_slot')};

            $isAvailable = VipClubV1BookingUtils::checkAvailability(
                $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_id')},
                $newDate,
                $newTimeSlot
            );

            if (!$isAvailable) {
                return VipClubV1ResponseUtils::error('New time slot is not available', 409);
            }

            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date')} = $newDate;
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'time_slot')} = $newTimeSlot;
        }

        if ($request->has('duration')) {
            $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'duration')} = $request->duration;
        }

        $booking->save();

        return VipClubV1ResponseUtils::success(
            $this->formatBookingResponse($booking),
            'Booking updated successfully'
        );
    }

    private function formatBookingResponse(VipClubV1BookingModel $booking): array
    {
        return [
            'id' => $booking->id,
            'userId' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'user_id')},
            'facilityId' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_id')},
            'facilityType' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_type')},
            'facilityName' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'facility_name')},
            'bookingDate' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'booking_date')},
            'timeSlot' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'time_slot')},
            'duration' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'duration')},
            'price' => (float) $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'price')},
            'discount' => (float) $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'discount')},
            'finalPrice' => (float) $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'final_price')},
            'status' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'status')},
            'extras' => $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'extras')},
            'createdAt' => $booking->created_at?->toIso8601String(),
            'updatedAt' => $booking->updated_at?->toIso8601String()
        ];
    }
}
