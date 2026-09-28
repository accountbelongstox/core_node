<?php

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Public;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Services\DingDuoDuoV1MemberService;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1MemberModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1RechargeConfigModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1RechargeOrderModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Requests\DingDuoDuoV1RechargeCreateRequest;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1ErrorCodes;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Enums\DingDuoDuoV1OrderStatus;

/**
 * Public recharge flow: list packages, create a pending order (returns a pay_url),
 * and a payment callback that marks the order paid (idempotent by out_trade_no)
 * and applies the membership extension.
 *
 * The callback is accepted only from the gateway (HMAC-SHA256 `sign` over the
 * sorted non-empty parameters with the configured api_secret, plus a matching
 * `amount`) or from a signed-in administrator confirming the order by hand.
 */
class DingDuoDuoV1RechargeController extends Controller
{
    private const SIGNATURE_FIELD = 'sign';
    private const AMOUNT_FIELD = 'amount';

    /**
     * GET recharge/packages -> the enabled config's package list (or the default).
     */
    public function packages(): JsonResponse
    {
        $config = self::activeConfig();
        $packages = ($config && is_array($config->packages) && !empty($config->packages))
            ? $config->packages
            : DingDuoDuoV1Constants::DEFAULT_PACKAGES;

        return response()->json([
            'success' => true,
            'data' => array_values($packages),
        ]);
    }

    /**
     * POST recharge/create {token, package_id} -> pending order + pay_url.
     */
    public function create(DingDuoDuoV1RechargeCreateRequest $request): JsonResponse
    {
        $data = $request->validated();

        $member = $this->resolveMember($request, $data['token'] ?? null);
        if (!$member) {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::INVALID_TOKEN),
                'code' => DingDuoDuoV1ErrorCodes::INVALID_TOKEN,
            ], 401);
        }

        $config = self::activeConfig();
        $package = self::findPackage($config, (string) $data['package_id']);
        if (!$package) {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::PACKAGE_NOT_FOUND),
                'code' => DingDuoDuoV1ErrorCodes::PACKAGE_NOT_FOUND,
            ], 404);
        }

        $outTradeNo = 'DD' . date('YmdHis') . strtoupper(Str::random(8));

        $order = DingDuoDuoV1RechargeOrderModel::createRecord([
            'member_id' => (int) $member->id,
            'package_id' => (string) $package['id'],
            'amount' => (float) ($package['price'] ?? 0),
            'status' => DingDuoDuoV1OrderStatus::Pending->value,
            'out_trade_no' => $outTradeNo,
        ]);

        $payUrl = self::buildPayUrl($config, $outTradeNo, $package);

        return response()->json([
            'success' => true,
            'data' => [
                'order' => $order->toArray(),
                'pay_url' => $payUrl,
                'out_trade_no' => $outTradeNo,
            ],
        ]);
    }

    /**
     * POST recharge/callback {out_trade_no, ...} -> mark order paid (idempotent)
     * and apply the membership extension to the member.
     */
    public function callback(Request $request): JsonResponse
    {
        $outTradeNo = (string) $request->input('out_trade_no', '');
        $order = null;
        $config = null;
        $adminConfirm = false;
        $applied = false;
        $member = null;

        if ($outTradeNo === '') {
            return self::errorResponse(DingDuoDuoV1ErrorCodes::MISSING_REQUIRED_FIELD);
        }

        $order = DingDuoDuoV1RechargeOrderModel::findByTradeNo($outTradeNo);
        if (!$order) {
            return self::errorResponse(DingDuoDuoV1ErrorCodes::ORDER_NOT_FOUND);
        }

        $config = self::activeConfig();
        $adminConfirm = self::isAdminConfirm();
        if (!$adminConfirm && !self::hasValidGatewaySignature($request, $config)) {
            return self::errorResponse(DingDuoDuoV1ErrorCodes::SIGNATURE_INVALID);
        }
        if (!$adminConfirm && !self::amountMatches($request, $order)) {
            return self::errorResponse(DingDuoDuoV1ErrorCodes::AMOUNT_MISMATCH);
        }

        // Compare-and-set pending -> paid inside one transaction, so concurrent
        // or re-delivered callbacks apply the recharge exactly once.
        $applied = DB::connection($order->getConnectionName())->transaction(
            static function () use ($order, $request, $config): bool {
                $claimed = 0;
                $member = null;
                $package = null;

                $claimed = DingDuoDuoV1RechargeOrderModel::query()
                    ->whereKey($order->getKey())
                    ->where('status', DingDuoDuoV1OrderStatus::Pending->value)
                    ->update([
                        'status' => DingDuoDuoV1OrderStatus::Paid->value,
                        'paid_at' => now(),
                        'raw' => json_encode($request->all()),
                    ]);
                if ($claimed !== 1) {
                    return false;
                }
                $member = DingDuoDuoV1MemberModel::query()
                    ->whereKey((int) $order->member_id)
                    ->lockForUpdate()
                    ->first();
                $package = self::findPackage($config, (string) $order->package_id);
                if ($member && $package) {
                    DingDuoDuoV1MemberService::applyRecharge($member, $package);
                }

                return true;
            }
        );

        $order = $order->freshRecord();
        if (!$applied) {
            if ($order->status === DingDuoDuoV1OrderStatus::Paid->value) {
                return response()->json([
                    'success' => true,
                    'data' => $order->toArray(),
                    'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::ORDER_ALREADY_PAID),
                ]);
            }

            return self::errorResponse(DingDuoDuoV1ErrorCodes::INVALID_OPERATION);
        }
        $member = DingDuoDuoV1MemberModel::findById((int) $order->member_id);

        return response()->json([
            'success' => true,
            'data' => [
                'order' => $order->toArray(),
                'member' => $member ? $member->toArray() : null,
            ],
        ]);
    }

    private static function errorResponse(string $code): JsonResponse
    {
        return response()->json([
            'success' => false,
            'message' => DingDuoDuoV1ErrorCodes::getMessage($code),
            'code' => $code,
        ], DingDuoDuoV1ErrorCodes::getHttpCode($code));
    }

    private static function isAdminConfirm(): bool
    {
        $user = auth('sanctum')->user();

        return $user instanceof User && $user->isAdmin();
    }

    /**
     * Gateway notification signature: lowercase hex HMAC-SHA256 of the
     * non-empty scalar parameters (except `sign`) sorted by key and joined as
     * `k=v&k=v`, keyed by the configured api_secret.
     */
    private static function hasValidGatewaySignature(Request $request, ?DingDuoDuoV1RechargeConfigModel $config): bool
    {
        $secret = (string) ($config?->api_secret ?? '');
        $signature = strtolower(trim((string) $request->input(self::SIGNATURE_FIELD, '')));
        $params = $request->except(self::SIGNATURE_FIELD);
        $pairs = [];

        if ($secret === '' || $signature === '') {
            return false;
        }
        ksort($params, SORT_STRING);
        foreach ($params as $key => $value) {
            if (is_scalar($value) && (string) $value !== '') {
                $pairs[] = $key . '=' . $value;
            }
        }

        return hash_equals(hash_hmac('sha256', implode('&', $pairs), $secret), $signature);
    }

    private static function amountMatches(Request $request, DingDuoDuoV1RechargeOrderModel $order): bool
    {
        $paid = (string) $request->input(self::AMOUNT_FIELD, '');

        return is_numeric($paid)
            && bccomp(number_format((float) $paid, 2, '.', ''), number_format((float) $order->amount, 2, '.', ''), 2) === 0;
    }

    /**
     * Resolve the member from an explicit Sanctum token, then the X-DD-Token
     * header. Validation goes through Sanctum (legacy member tokens are no
     * longer honored).
     */
    private function resolveMember(Request $request, ?string $token): ?DingDuoDuoV1MemberModel
    {
        $token = (string) ($token ?? '');
        if ($token === '') {
            $token = (string) $request->header(DingDuoDuoV1Constants::MEMBER_TOKEN_HEADER, '');
        }
        $token = trim($token);
        if ($token === '') {
            return null;
        }

        return DingDuoDuoV1MemberService::activeMemberForToken($token);
    }

    /**
     * The single enabled recharge config row (if any).
     */
    private static function activeConfig(): ?DingDuoDuoV1RechargeConfigModel
    {
        return DingDuoDuoV1RechargeConfigModel::enabled();
    }

    /**
     * Find a package definition by id, from the config row or the default list.
     */
    private static function findPackage(?DingDuoDuoV1RechargeConfigModel $config, string $packageId): ?array
    {
        $packages = ($config && is_array($config->packages) && !empty($config->packages))
            ? $config->packages
            : DingDuoDuoV1Constants::DEFAULT_PACKAGES;

        foreach ($packages as $package) {
            if ((string) ($package['id'] ?? '') === $packageId) {
                return $package;
            }
        }

        return null;
    }

    /**
     * Build the pay URL. For the 'custom' provider (or no configured endpoint) a
     * placeholder URL embedding out_trade_no is returned; otherwise the configured
     * gateway endpoint is used with the trade number appended.
     */
    private static function buildPayUrl(?DingDuoDuoV1RechargeConfigModel $config, string $outTradeNo, array $package): string
    {
        $endpoint = $config?->endpoint ?: '';
        $provider = $config?->provider ?: DingDuoDuoV1Constants::DEFAULT_PROVIDER;

        if ($provider === DingDuoDuoV1Constants::DEFAULT_PROVIDER || $endpoint === '') {
            return 'https://pay.dingduoduo.local/checkout?out_trade_no=' . urlencode($outTradeNo);
        }

        $separator = str_contains($endpoint, '?') ? '&' : '?';
        return $endpoint . $separator . 'out_trade_no=' . urlencode($outTradeNo);
    }
}
