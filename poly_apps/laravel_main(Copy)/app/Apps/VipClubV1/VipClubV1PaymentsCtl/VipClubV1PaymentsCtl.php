<?php

namespace App\Apps\VipClubV1\VipClubV1PaymentsCtl;

use App\Http\Controllers\Controller;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1PaymentModel;
use App\Apps\VipClubV1\VipClubV1Models\VipClubV1BookingModel;
use App\Apps\VipClubV1\VipClubV1Utils\VipClubV1ResponseUtils;
use App\Apps\VipClubV1\VipClubV1TablesMaps\VipClubV1TablesMap;
use App\Apps\VipClubV1\VipClubV1Gvar\VipClubV1Config;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class VipClubV1PaymentsCtl extends Controller
{
    public function create(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'booking_id' => 'sometimes|integer|exists:vipclubv1_bookings,id',
            'membership_tier' => 'sometimes|string|in:regular,gold,platinum,diamond',
            'amount' => 'required|numeric|min:0.01',
            'currency' => 'sometimes|string|size:3',
            'payment_method' => 'required|string|in:stripe,paypal,wechat,alipay,credit_card'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $user = $request->user();

        $paymentType = 'booking';
        if ($request->has('membership_tier')) {
            $paymentType = 'membership';
        }

        $paymentIntentId = 'pi_' . Str::random(24);
        $clientSecret = Str::random(32);

        $payment = new VipClubV1PaymentModel();
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'user_id')} = $user->id;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'booking_id')} = $request->booking_id;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_type')} = $paymentType;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'membership_tier')} = $request->membership_tier;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'amount')} = $request->amount;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'currency')} = $request->currency ?? 'USD';
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_method')} = $request->payment_method;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')} = 'pending';
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_intent_id')} = $paymentIntentId;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'client_secret')} = $clientSecret;
        $payment->save();

        return VipClubV1ResponseUtils::created([
            'payment_id' => $payment->id,
            'payment_intent_id' => $paymentIntentId,
            'client_secret' => $clientSecret,
            'amount' => (float) $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'amount')},
            'currency' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'currency')},
            'status' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')}
        ], 'Payment intent created successfully');
    }

    public function confirm(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'payment_id' => 'required|integer|exists:vipclubv1_payments,id',
            'payment_token' => 'required|string'
        ]);

        if ($validator->fails()) {
            return VipClubV1ResponseUtils::validationError('Validation failed', $validator->errors());
        }

        $user = $request->user();

        $payment = VipClubV1PaymentModel::find($request->payment_id);

        if ($payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'user_id')} !== $user->id) {
            return VipClubV1ResponseUtils::forbidden('You do not have permission to confirm this payment');
        }

        if ($payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')} !== 'pending') {
            return VipClubV1ResponseUtils::error('Payment cannot be confirmed');
        }

        $transactionId = 'txn_' . Str::random(24);
        $receiptUrl = url("/api/vipclubv1/v1/payments/{$payment->id}/receipt");

        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')} = 'completed';
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'transaction_id')} = $transactionId;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'receipt_url')} = $receiptUrl;
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'paid_at')} = now();
        $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_details')} = [
            'payment_token' => $request->payment_token,
            'confirmed_at' => now()->toIso8601String()
        ];
        $payment->save();

        if ($payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'booking_id')}) {
            $booking = VipClubV1BookingModel::find($payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'booking_id')});
            if ($booking) {
                $booking->{VipClubV1TablesMap::getFieldName('BOOKINGS', 'status')} = 'confirmed';
                $booking->save();
            }
        }

        return VipClubV1ResponseUtils::success([
            'success' => true,
            'transaction_id' => $transactionId,
            'receipt_url' => $receiptUrl,
            'payment' => $this->formatPaymentResponse($payment)
        ], 'Payment confirmed successfully');
    }

    public function history(Request $request): JsonResponse
    {
        $user = $request->user();

        $page = $request->query('page', 1);
        $limit = min($request->query('limit', VipClubV1Config::PAGINATION_DEFAULT_LIMIT), VipClubV1Config::PAGINATION_MAX_LIMIT);

        $query = VipClubV1PaymentModel::byUser($user->id);

        $total = $query->count();

        $payments = $query->orderBy('created_at', 'desc')
            ->skip(($page - 1) * $limit)
            ->take($limit)
            ->get();

        $formattedPayments = $payments->map(function ($payment) {
            return $this->formatPaymentResponse($payment);
        });

        return VipClubV1ResponseUtils::paginated(
            $formattedPayments,
            $total,
            $page,
            $limit
        );
    }

    public function getReceipt(Request $request, $id): JsonResponse
    {
        $user = $request->user();

        $payment = VipClubV1PaymentModel::find($id);

        if (!$payment) {
            return VipClubV1ResponseUtils::notFound('Payment not found');
        }

        if ($payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'user_id')} !== $user->id) {
            return VipClubV1ResponseUtils::forbidden('You do not have permission to view this receipt');
        }

        if ($payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')} !== 'completed') {
            return VipClubV1ResponseUtils::error('Receipt not available for incomplete payments');
        }

        return VipClubV1ResponseUtils::success([
            'receipt' => $this->formatReceiptResponse($payment)
        ]);
    }

    private function formatPaymentResponse(VipClubV1PaymentModel $payment): array
    {
        return [
            'id' => $payment->id,
            'userId' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'user_id')},
            'bookingId' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'booking_id')},
            'paymentType' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_type')},
            'membershipTier' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'membership_tier')},
            'amount' => (float) $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'amount')},
            'currency' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'currency')},
            'paymentMethod' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_method')},
            'paymentStatus' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_status')},
            'transactionId' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'transaction_id')},
            'receiptUrl' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'receipt_url')},
            'paidAt' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'paid_at')}?->toIso8601String(),
            'createdAt' => $payment->created_at?->toIso8601String()
        ];
    }

    private function formatReceiptResponse(VipClubV1PaymentModel $payment): array
    {
        return [
            'transaction_id' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'transaction_id')},
            'amount' => (float) $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'amount')},
            'currency' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'currency')},
            'payment_method' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_method')},
            'payment_type' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'payment_type')},
            'paid_at' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'paid_at')}?->toIso8601String(),
            'receipt_url' => $payment->{VipClubV1TablesMap::getFieldName('PAYMENTS', 'receipt_url')}
        ];
    }
}
