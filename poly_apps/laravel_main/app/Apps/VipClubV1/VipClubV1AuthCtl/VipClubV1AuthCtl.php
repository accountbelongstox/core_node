<?php

namespace App\Apps\VipClubV1\VipClubV1AuthCtl;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1ResponseUtils;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1MembershipUtils;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1VipCardModel;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Providers\GlobalTablesMap;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;

class VipClubV1AuthCtl extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:6',
            'full_name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:20'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $usersTable = GlobalTablesMap::getTableName('GLOBAL_USERS');
        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];

        $user = new User();
        $user->{$userFields['username']} = $request->email;
        $user->{$userFields['email']} = $request->email;
        $user->{$userFields['password']} = Hash::make($request->password);
        $user->{$userFields['name']} = $request->full_name;
        $user->{$userFields['phone']} = $request->phone;
        $user->{$userFields['member_type']} = 'regular';
        $user->{$userFields['vip_points']} = 0;
        $user->{$userFields['member_since']} = Carbon::now();
        $user->{$userFields['is_active']} = true;
        $user->save();

        $cardNumber = $this->generateCardNumber();

        $vipCard = new VipClubV1VipCardModel();
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'card_number')} = $cardNumber;
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'user_id')} = $user->id;
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'member_type')} = 'regular';
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'issue_date')} = Carbon::now();
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'expiry_date')} = Carbon::now()->addYears(3);
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'points')} = 0;
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'benefits')} = VipClubV1MembershipUtils::getMemberBenefits('regular');
        $vipCard->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'is_active')} = true;
        $vipCard->save();

        $token = $user->createToken('vipclub_token')->plainTextToken;

        return VipClubV1ResponseUtils::created([
            'token' => $token,
            'user' => $this->formatUserResponse($user)
        ], 'Registration successful');
    }

    public function login(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'password' => 'required|string'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];

        $user = User::where($userFields['email'], $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->{$userFields['password']})) {
            return VipClubV1ResponseUtils::unauthorized('Invalid credentials');
        }

        if (!$user->{$userFields['is_active']}) {
            return VipClubV1ResponseUtils::forbidden('Account is inactive');
        }

        $token = $user->createToken('vipclub_token')->plainTextToken;

        return VipClubV1ResponseUtils::success([
            'token' => $token,
            'user' => $this->formatUserResponse($user)
        ], 'Login successful');
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return VipClubV1ResponseUtils::success(null, 'Logout successful');
    }

    public function profile(Request $request): JsonResponse
    {
        $user = $request->user();

        return VipClubV1ResponseUtils::success(
            $this->formatUserResponse($user),
            'Profile retrieved successfully'
        );
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'full_name' => 'sometimes|string|max:255',
            'phone' => 'sometimes|string|max:20',
            'avatar_url' => 'sometimes|url',
            'preferences' => 'sometimes|array'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $user = $request->user();
        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];

        if ($request->has('full_name')) {
            $user->{$userFields['name']} = $request->full_name;
        }
        if ($request->has('phone')) {
            $user->{$userFields['phone']} = $request->phone;
        }
        if ($request->has('avatar_url')) {
            $user->{$userFields['avatar_url']} = $request->avatar_url;
        }
        if ($request->has('preferences')) {
            $user->{$userFields['preferences']} = $request->preferences;
        }

        $user->save();

        return VipClubV1ResponseUtils::success(
            $this->formatUserResponse($user),
            'Profile updated successfully'
        );
    }

    private function formatUserResponse(User $user): array
    {
        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];

        return [
            'id' => $user->id,
            'email' => $user->{$userFields['email']},
            'fullName' => $user->{$userFields['name']},
            'phone' => $user->{$userFields['phone']},
            'avatarUrl' => $user->{$userFields['avatar_url']},
            'memberType' => $user->{$userFields['member_type']},
            'vipPoints' => $user->{$userFields['vip_points']},
            'memberSince' => $user->{$userFields['member_since']}?->toIso8601String(),
            'memberExpiry' => $user->{$userFields['member_expiry']}?->toIso8601String(),
            'isActive' => $user->{$userFields['is_active']},
            'preferences' => $user->{$userFields['preferences']}
        ];
    }

    private function generateCardNumber(): string
    {
        do {
            $cardNumber = 'VC' . date('Y') . str_pad(rand(0, 999999), 6, '0', STR_PAD_LEFT);
            $exists = VipClubV1VipCardModel::where(
                VipClubV1TablesMap::getFieldName('VIP_CARDS', 'card_number'),
                $cardNumber
            )->exists();
        } while ($exists);

        return $cardNumber;
    }
}
