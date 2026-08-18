<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Public;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Http\Controllers\Controller;
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
 */
class DingDuoDuoV1RechargeController extends Controller
{
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
        if ($outTradeNo === '') {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::MISSING_REQUIRED_FIELD),
                'code' => DingDuoDuoV1ErrorCodes::MISSING_REQUIRED_FIELD,
            ], 400);
        }

        $order = DingDuoDuoV1RechargeOrderModel::findByTradeNo($outTradeNo);
        if (!$order) {
            return response()->json([
                'success' => false,
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::ORDER_NOT_FOUND),
                'code' => DingDuoDuoV1ErrorCodes::ORDER_NOT_FOUND,
            ], 404);
        }

        // Idempotent: a re-delivered callback for an already-paid order is a no-op.
        if ($order->status === DingDuoDuoV1OrderStatus::Paid->value) {
            return response()->json([
                'success' => true,
                'data' => $order->toArray(),
                'message' => DingDuoDuoV1ErrorCodes::getMessage(DingDuoDuoV1ErrorCodes::ORDER_ALREADY_PAID),
            ]);
        }

        $order->status = DingDuoDuoV1OrderStatus::Paid->value;
        $order->paid_at = now();
        $order->raw = $request->all();
        $order->saveRecord();

        $member = DingDuoDuoV1MemberModel::findById((int) $order->member_id);
        $config = self::activeConfig();
        $package = self::findPackage($config, (string) $order->package_id);

        if ($member && $package) {
            DingDuoDuoV1MemberService::applyRecharge($member, $package);
        }

        return response()->json([
            'success' => true,
            'data' => [
                'order' => $order->freshRecord()->toArray(),
                'member' => $member ? $member->freshRecord()->toArray() : null,
            ],
        ]);
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
