<?php

namespace App\Apps\VipClubV1\VipClubV1FacilitiesCtl;

use App\Http\Controllers\Controller;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1FacilityModel;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1ResponseUtils;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1BookingUtils;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class VipClubV1FacilitiesCtl extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = VipClubV1FacilityModel::active();

        if ($request->has('type') && $request->type) {
            $query->byType($request->type);
        }

        $facilities = $query->get();

        $formattedFacilities = $facilities->map(function ($facility) {
            return $this->formatFacilityResponse($facility);
        });

        return VipClubV1ResponseUtils::success([
            'facilities' => $formattedFacilities,
            'total' => $formattedFacilities->count()
        ]);
    }

    public function show(Request $request, $id): JsonResponse
    {
        $facility = VipClubV1FacilityModel::find($id);

        if (!$facility) {
            return VipClubV1ResponseUtils::notFound('Facility not found');
        }

        $user = $request->user();
        $userFields = \App\Providers\GlobalTablesMap::GLOBAL_USERS['fields'];

        if ($facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'vip_only')}) {
            if (!$user) {
                return VipClubV1ResponseUtils::unauthorized('Authentication required for VIP facilities');
            }

            $memberType = $user->{$userFields['member_type']};
            if ($memberType === 'guest' || $memberType === 'regular') {
                return VipClubV1ResponseUtils::forbidden('VIP membership required');
            }
        }

        return VipClubV1ResponseUtils::success(
            $this->formatFacilityResponse($facility)
        );
    }

    public function getAvailableSlots(Request $request, $id): JsonResponse
    {
        $facility = VipClubV1FacilityModel::find($id);

        if (!$facility) {
            return VipClubV1ResponseUtils::notFound('Facility not found');
        }

        $date = $request->query('date');
        if (!$date) {
            return VipClubV1ResponseUtils::validationError('Date parameter is required');
        }

        $availableTimes = $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'available_times')};

        $availableSlots = VipClubV1BookingUtils::getAvailableSlots(
            $facility->id,
            $date,
            $availableTimes
        );

        return VipClubV1ResponseUtils::success([
            'date' => $date,
            'facility_id' => $facility->id,
            'available_slots' => $availableSlots
        ]);
    }

    public function checkAvailability(Request $request): JsonResponse
    {
        $facilityId = $request->query('facility_id');
        $date = $request->query('date');
        $timeSlot = $request->query('time_slot');

        if (!$facilityId || !$date || !$timeSlot) {
            return VipClubV1ResponseUtils::validationError('facility_id, date, and time_slot are required');
        }

        $facility = VipClubV1FacilityModel::find($facilityId);

        if (!$facility) {
            return VipClubV1ResponseUtils::notFound('Facility not found');
        }

        $isAvailable = VipClubV1BookingUtils::checkAvailability(
            $facilityId,
            $date,
            $timeSlot
        );

        return VipClubV1ResponseUtils::success([
            'facility_id' => $facilityId,
            'date' => $date,
            'time_slot' => $timeSlot,
            'available' => $isAvailable
        ]);
    }

    private function formatFacilityResponse(VipClubV1FacilityModel $facility): array
    {
        return [
            'id' => $facility->id,
            'name' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'name')},
            'type' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'type')},
            'description' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'description')},
            'imageUrl' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'image_url')},
            'basePrice' => (float) $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'base_price')},
            'availableTimes' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'available_times')},
            'features' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'features')},
            'isActive' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'is_active')},
            'vipOnly' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'vip_only')},
            'specificData' => $facility->{VipClubV1TablesMap::getFieldName('FACILITIES', 'specific_data')}
        ];
    }
}
