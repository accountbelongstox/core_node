<?php

namespace App\Apps\VipClubV1\VipClubV1VipCtl;

use App\Http\Controllers\Controller;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1VipCardModel;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1PointsTransactionModel;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1ResponseUtils;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1MembershipUtils;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1PaymentModel;
use App\Providers\GlobalTablesMap;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Carbon\Carbon;

class VipClubV1VipCtl extends Controller
{
    public function getBenefits(Request $request): JsonResponse
    {
        $memberType = $request->query('member_type', 'regular');

        $benefits = VipClubV1MembershipUtils::getMemberBenefits($memberType);

        return VipClubV1ResponseUtils::success([
            'member_type' => $memberType,
            'benefits' => $benefits,
            'discount_rate' => VipClubV1MembershipUtils::getDiscountRate($memberType)
        ]);
    }

    public function getMembershipTiers(Request $request): JsonResponse
    {
        $tiers = VipClubV1MembershipUtils::getAllTiers();

        return VipClubV1ResponseUtils::success([
            'tiers' => $tiers
        ]);
    }

    public function getMyCard(Request $request): JsonResponse
    {
        $user = $request->user();

        $card = VipClubV1VipCardModel::where(
            VipClubV1TablesMap::getFieldName('VIP_CARDS', 'user_id'),
            $user->id
        )->first();

        if (!$card) {
            return VipClubV1ResponseUtils::notFound('VIP card not found');
        }

        return VipClubV1ResponseUtils::success(
            $this->formatCardResponse($card)
        );
    }

    public function getPointsHistory(Request $request): JsonResponse
    {
        $user = $request->user();

        $page = $request->query('page', 1);
        $limit = min($request->query('limit', 20), 100);

        $query = VipClubV1PointsTransactionModel::byUser($user->id);

        if ($request->has('type') && $request->type) {
            $query->byType($request->type);
        }

        $total = $query->count();

        $transactions = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        $formattedTransactions = $transactions->map(function ($transaction) {
            return $this->formatTransactionResponse($transaction);
        });

        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];
        $currentPoints = $user->{$userFields['vip_points']};
        $pointsToNextTier = VipClubV1MembershipUtils::getPointsToNextTier($currentPoints);

        return VipClubV1ResponseUtils::success([
            'current_points' => $currentPoints,
            'current_tier' => $user->{$userFields['member_type']},
            'points_to_next_tier' => $pointsToNextTier,
            'transactions' => [
                'items' => $formattedTransactions,
                'pagination' => [
                    'total' => $total,
                    'page' => $page,
                    'limit' => $limit,
                    'total_pages' => ceil($total / $limit)
                ]
            ]
        ]);
    }

    public function getMyMembershipInfo(Request $request): JsonResponse
    {
        $user = $request->user();
        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];

        $memberType = $user->{$userFields['member_type']};
        $vipPoints = $user->{$userFields['vip_points']};

        $tierInfo = VipClubV1MembershipUtils::getTierInfo($memberType);
        $pointsToNextTier = VipClubV1MembershipUtils::getPointsToNextTier($vipPoints);

        $card = VipClubV1VipCardModel::where(
            VipClubV1TablesMap::getFieldName('VIP_CARDS', 'user_id'),
            $user->id
        )->first();

        return VipClubV1ResponseUtils::success([
            'member_type' => $memberType,
            'vip_points' => $vipPoints,
            'points_to_next_tier' => $pointsToNextTier,
            'discount_rate' => $tierInfo['discount_rate'],
            'benefits' => $tierInfo['benefits'],
            'member_since' => $user->{$userFields['member_since']}?->toIso8601String(),
            'member_expiry' => $user->{$userFields['member_expiry']}?->toIso8601String(),
            'card' => $card ? $this->formatCardResponse($card) : null
        ]);
    }

    public function subscribe(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'tier' => 'required|string|in:regular,gold,platinum,diamond',
            'payment_method' => 'required|string',
            'payment_token' => 'required|string'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $user = $request->user();
        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];

        $tierPrices = [
            'regular' => 0,
            'gold' => 99,
            'platinum' => 299,
            'diamond' => 599
        ];

        $amount = $tierPrices[$request->tier];

        try {
            DB::beginTransaction();

            $payment = new VipClubV1PaymentModel();
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'user_id')} = $user->id;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_type')} = 'membership';
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'membership_tier')} = $request->tier;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'amount')} = $amount;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'currency')} = 'USD';
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_method')} = $request->payment_method;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')} = 'completed';
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'transaction_id')} = 'txn_' . \Illuminate\Support\Str::random(24);
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'paid_at')} = now();
            $payment->save();

            $user->{$userFields['member_type']} = $request->tier;
            $user->{$userFields['member_since']} = Carbon::now();
            $user->{$userFields['member_expiry']} = Carbon::now()->addYear();
            $user->save();

            $card = VipClubV1VipCardModel::where(
                VipClubV1TablesMap::getFieldName('VIP_CARDS', 'user_id'),
                $user->id
            )->first();

            if ($card) {
                $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'member_type')} = $request->tier;
                $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'expiry_date')} = Carbon::now()->addYear();
                $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'benefits')} = VipClubV1MembershipUtils::getMemberBenefits($request->tier);
                $card->save();
            }

            DB::commit();

            return VipClubV1ResponseUtils::success([
                'success' => true,
                'vip_card' => $card ? $this->formatCardResponse($card) : null,
                'transaction_id' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'transaction_id')}
            ], 'Membership subscription successful');

        } catch (\Exception $e) {
            DB::rollBack();
            return VipClubV1ResponseUtils::serverError('Failed to process subscription: ' . $e->getMessage());
        }
    }

    public function upgrade(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'new_tier' => 'required|string|in:gold,platinum,diamond',
            'payment_method' => 'required|string',
            'payment_token' => 'required|string'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $user = $request->user();
        $userFields = GlobalTablesMap::GLOBAL_USERS['fields'];

        $currentTier = $user->{$userFields['member_type']};

        $tierOrder = ['guest', 'regular', 'gold', 'platinum', 'diamond'];
        $currentIndex = array_search($currentTier, $tierOrder);
        $newIndex = array_search($request->new_tier, $tierOrder);

        if ($newIndex <= $currentIndex) {
            return VipClubV1ResponseUtils::error('Can only upgrade to a higher tier');
        }

        $tierPrices = [
            'gold' => 99,
            'platinum' => 299,
            'diamond' => 599
        ];

        $amount = $tierPrices[$request->new_tier];

        try {
            DB::beginTransaction();

            $payment = new VipClubV1PaymentModel();
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'user_id')} = $user->id;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_type')} = 'upgrade';
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'membership_tier')} = $request->new_tier;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'amount')} = $amount;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'currency')} = 'USD';
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_method')} = $request->payment_method;
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')} = 'completed';
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'transaction_id')} = 'txn_' . \Illuminate\Support\Str::random(24);
            $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'paid_at')} = now();
            $payment->save();

            $user->{$userFields['member_type']} = $request->new_tier;
            $user->save();

            $card = VipClubV1VipCardModel::where(
                VipClubV1TablesMap::getFieldName('VIP_CARDS', 'user_id'),
                $user->id
            )->first();

            if ($card) {
                $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'member_type')} = $request->new_tier;
                $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'benefits')} = VipClubV1MembershipUtils::getMemberBenefits($request->new_tier);
                $card->save();
            }

            DB::commit();

            return VipClubV1ResponseUtils::success([
                'success' => true,
                'vip_card' => $card ? $this->formatCardResponse($card) : null,
                'transaction_id' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'transaction_id')}
            ], 'Membership upgrade successful');

        } catch (\Exception $e) {
            DB::rollBack();
            return VipClubV1ResponseUtils::serverError('Failed to process upgrade: ' . $e->getMessage());
        }
    }

    private function formatCardResponse(VipClubV1VipCardModel $card): array
    {
        return [
            'cardNumber' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'card_number')},
            'userId' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'user_id')},
            'memberType' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'member_type')},
            'issueDate' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'issue_date')}?->toIso8601String(),
            'expiryDate' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'expiry_date')}?->toIso8601String(),
            'points' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'points')},
            'benefits' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'benefits')},
            'qrCode' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'qr_code')},
            'isActive' => $card->{VipClubV1TablesMap::getFieldName('VIP_CARDS', 'is_active')}
        ];
    }

    private function formatTransactionResponse(VipClubV1PointsTransactionModel $transaction): array
    {
        return [
            'id' => $transaction->id,
            'userId' => $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'user_id')},
            'points' => $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'points')},
            'type' => $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'type')},
            'description' => $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'description')},
            'relatedBookingId' => $transaction->{VipClubV1TablesMap::getFieldName('POINTS_TRANSACTIONS', 'related_booking_id')},
            'createdAt' => $transaction->created_at?->toIso8601String()
        ];
    }
}
