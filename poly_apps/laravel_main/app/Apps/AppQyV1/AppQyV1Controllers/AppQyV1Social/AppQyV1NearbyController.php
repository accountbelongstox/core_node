<?php

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1Social;

use Illuminate\Http\Request;
use Illuminate\Routing\Controller as BaseController;
use Illuminate\Support\Facades\Validator;
use App\Models\User;
use App\Traits\ApiResponse;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1UserPresenceModel;

class AppQyV1NearbyController extends BaseController
{
    use ApiResponse;

    public function updateLocation(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $validated = [];
        $visible = true;

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->all(), [
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:100000'],
            'visible' => ['nullable', 'boolean'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }
        $validated = $validator->validated();
        $visible = (bool) ($validated['visible'] ?? true);
        if (!$visible && !isset($validated['latitude'], $validated['longitude'])) {
            AppQyV1UserPresenceModel::setLocationVisibility((int) $currentUser->id, false);
            return $this->success(['location_updated' => true, 'visible' => false]);
        }
        if (!isset($validated['latitude'], $validated['longitude'])) {
            return $this->error('Latitude and longitude are required when location sharing is enabled.', 422);
        }
        AppQyV1UserPresenceModel::updateLocation(
            (int) $currentUser->id,
            (float) $validated['latitude'],
            (float) $validated['longitude'],
            isset($validated['accuracy']) ? (float) $validated['accuracy'] : null,
            $visible
        );
        return $this->success(['location_updated' => true]);
    }

    public function nearby(Request $request)
    {
        $currentUser = $request->user();
        $validator = null;
        $radius = 50.0;
        $limit = 50;
        $origin = null;
        $latitudeDelta = 0.0;
        $longitudeDelta = 0.0;
        $longitudeScale = 1.0;
        $rows = null;
        $distances = [];
        $userIds = [];
        $users = null;
        $items = [];

        if (!$currentUser) {
            return $this->unauthorized();
        }
        $validator = Validator::make($request->query(), [
            'radius_km' => ['nullable', 'numeric', 'min:1', 'max:200'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);
        if ($validator->fails()) {
            return $this->validationErrorWithParams($validator);
        }
        $radius = (float) $request->query('radius_km', 50);
        $limit = (int) $request->query('limit', 50);
        $origin = AppQyV1UserPresenceModel::query()->where('user_id', (int) $currentUser->id)->first();
        if (!$origin || $origin->latitude === null || $origin->longitude === null) {
            return $this->success(['users' => [], 'location_required' => true]);
        }

        $latitudeDelta = $radius / 111.0;
        $longitudeScale = max(0.01, cos(deg2rad((float) $origin->latitude)));
        $longitudeDelta = $radius / (111.0 * $longitudeScale);

        $rows = AppQyV1UserPresenceModel::query()
            ->where('user_id', '!=', (int) $currentUser->id)
            ->where('location_visible', true)
            ->whereNotNull('latitude')
            ->whereNotNull('longitude')
            ->where('location_updated_at', '>=', now()->subDay())
            ->whereBetween('latitude', [(float) $origin->latitude - $latitudeDelta, (float) $origin->latitude + $latitudeDelta])
            ->whereBetween('longitude', [(float) $origin->longitude - $longitudeDelta, (float) $origin->longitude + $longitudeDelta])
            ->orderByDesc('location_updated_at')
            ->limit(500)
            ->get();
        foreach ($rows as $row) {
            $distance = $this->distanceKm((float) $origin->latitude, (float) $origin->longitude, (float) $row->latitude, (float) $row->longitude);
            if ($distance <= $radius) {
                $distances[(int) $row->user_id] = round($distance, 1);
            }
        }
        asort($distances);
        $distances = array_slice($distances, 0, $limit, true);
        $userIds = array_map('intval', array_keys($distances));
        $users = User::query()->whereIn('id', $userIds)->get()->keyBy('id');
        foreach ($userIds as $userId) {
            $user = $users->get($userId);
            if (!$user) {
                continue;
            }
            $items[] = [
                'id' => $userId,
                'nickname' => $user->nickname ?? $user->name ?? $user->username ?? '',
                'avatar' => $user->avatar_url ?? $user->avatar ?? '',
                'native_language' => $user->native_language ?? '',
                'learning_languages' => is_array($user->learning_languages) ? $user->learning_languages : [],
                'distance_km' => $distances[$userId],
            ];
        }
        return $this->success(['users' => $items, 'location_required' => false]);
    }

    private function distanceKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $earthRadius = 6371.0;
        $latDelta = deg2rad($lat2 - $lat1);
        $lonDelta = deg2rad($lon2 - $lon1);
        $a = sin($latDelta / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($lonDelta / 2) ** 2;
        return $earthRadius * 2 * atan2(sqrt($a), sqrt(1 - $a));
    }
}
