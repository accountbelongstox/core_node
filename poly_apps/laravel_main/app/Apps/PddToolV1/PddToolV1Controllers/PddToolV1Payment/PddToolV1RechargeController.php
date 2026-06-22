<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Payment;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1RechargeModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1ProfileModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PackageModel;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1Presenter;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1ProfileResolver;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1MembershipService;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1PaymentService;
use App\Apps\PddToolV1\PddToolV1Constants\PddToolV1Defaults;

/**
 * User-facing recharge / payment flow (root-level, authed for create/status;
 * gateway notifies are unauthenticated callbacks).
 */
class PddToolV1RechargeController extends BaseController
{
    /**
     * GET /recharge/packages -> {data:[PACKAGE]}  (public)
     */
    public function packages(Request $request): JsonResponse
    {
        $rows = PddToolV1PackageModel::query()->where('enabled', true)->orderBy('id')->get();

        if ($rows->isEmpty()) {
            // Fallback to the canonical defaults if the table is not seeded yet.
            $data = array_values(array_map(
                fn ($p) => PddToolV1Presenter::package($p),
                PddToolV1Defaults::PACKAGES
            ));
            return response()->json(['data' => $data]);
        }

        return response()->json([
            'data' => $rows->map(fn ($p) => PddToolV1Presenter::package($p))->all(),
        ]);
    }

    /**
     * GET /payment-page?username=  (public HTML)
     *
     * Lightweight hosted recharge page the extension opens in a browser tab. Lists the enabled
     * packages with monthly/yearly prices and the supported payment methods (Alipay / WeChat).
     * The actual order is created via the authed POST /recharge/create from inside the extension.
     */
    public function paymentPage(Request $request): \Illuminate\Http\Response
    {
        $username = htmlspecialchars((string) $request->query('username', ''), ENT_QUOTES, 'UTF-8');

        $rows = PddToolV1PackageModel::query()->where('enabled', true)->orderBy('id')->get();
        $packages = $rows->isEmpty()
            ? array_values(array_map(fn ($p) => PddToolV1Presenter::package($p), PddToolV1Defaults::PACKAGES))
            : $rows->map(fn ($p) => PddToolV1Presenter::package($p))->all();

        $cards = '';
        foreach ($packages as $p) {
            $name = htmlspecialchars((string) ($p['name'] ?? $p['code'] ?? ''), ENT_QUOTES, 'UTF-8');
            $code = htmlspecialchars((string) ($p['code'] ?? ''), ENT_QUOTES, 'UTF-8');
            $pm = htmlspecialchars((string) ($p['price_month'] ?? '0'), ENT_QUOTES, 'UTF-8');
            $py = htmlspecialchars((string) ($p['price_year'] ?? '0'), ENT_QUOTES, 'UTF-8');
            $cards .= '<div class="card"><div class="name">' . $name . '</div>'
                . '<div class="code">' . $code . '</div>'
                . '<div class="price">Monthly &yen;' . $pm . ' &middot; Yearly &yen;' . $py . '</div></div>';
        }

        $html = '<!doctype html><html lang="en"><head><meta charset="utf-8">'
            . '<meta name="viewport" content="width=device-width, initial-scale=1">'
            . '<title>DingDuoDuo Recharge</title><style>'
            . 'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f8fb;color:#222;margin:0;padding:24px}'
            . 'h1{font-size:20px;color:#1a73e8;margin:0 0 4px}.sub{color:#666;font-size:13px;margin-bottom:16px}'
            . '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px}'
            . '.card{background:#fff;border:1px solid #eee;border-radius:12px;padding:16px}'
            . '.name{font-weight:700;font-size:16px}.code{color:#999;font-size:12px;margin:4px 0}'
            . '.price{color:#1a73e8;font-weight:600;margin-top:8px}.pay{margin-top:18px;font-size:13px;color:#444}'
            . '</style></head><body>'
            . '<h1>DingDuoDuo Membership Recharge</h1>'
            . '<div class="sub">Account: ' . ($username !== '' ? $username : '(unspecified)') . '</div>'
            . '<div class="grid">' . $cards . '</div>'
            . '<div class="pay">Payment methods: Alipay / WeChat. Choose a package and pay inside the extension.</div>'
            . '</body></html>';

        return response($html, 200)->header('Content-Type', 'text/html; charset=utf-8');
    }

    /**
     * POST /recharge/create {package_code, period, method}
     *   -> {out_trade_no, pay_url|qr_code, amount}
     */
    public function create(Request $request): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $packageCode = (string) $request->input('package_code', '');
        $period = (string) $request->input('period', 'month');
        $method = (string) $request->input('method', PddToolV1PaymentService::METHOD_ALIPAY);

        if (!in_array($period, ['month', 'year'], true)) {
            $period = 'month';
        }
        if (!in_array($method, [PddToolV1PaymentService::METHOD_ALIPAY, PddToolV1PaymentService::METHOD_WECHAT], true)) {
            return response()->json(['detail' => 'Unsupported payment method'], 422);
        }

        $package = PddToolV1MembershipService::resolvePackage($packageCode);
        if (!$package) {
            return response()->json(['detail' => 'Unknown package'], 422);
        }

        $amount = PddToolV1MembershipService::priceFor($package, $period);
        $grantDays = PddToolV1MembershipService::periodDays($period);

        $recharge = new PddToolV1RechargeModel();
        $recharge->user_id = $user->id;
        $recharge->username = $user->username;
        $recharge->out_trade_no = PddToolV1PaymentService::newOutTradeNo();
        $recharge->amount = $amount;
        $recharge->method = $method;
        $recharge->status = PddToolV1RechargeModel::STATUS_PENDING;
        $recharge->package_name = $package['code'];
        $recharge->period = $period;
        $recharge->grant_days = $grantDays;
        $recharge->save();

        $payment = new PddToolV1PaymentService();
        $result = $payment->create($recharge);

        $recharge->pay_url = $result['pay_url'];
        $recharge->qr_code = $result['qr_code'];
        $recharge->sandbox = (bool) $result['sandbox'];
        $recharge->save();

        return response()->json([
            'out_trade_no' => $recharge->out_trade_no,
            'pay_url' => $result['pay_url'],
            'qr_code' => $result['qr_code'],
            'amount' => round($amount, 2),
            'sandbox' => (bool) $result['sandbox'],
        ]);
    }

    /**
     * GET /recharge/status/{out_trade_no} -> {status, paid_at?}
     *
     * In sandbox mode (no merchant certs configured), a still-pending sandbox
     * recharge is settled immediately on first poll so the flow is testable.
     */
    public function status(Request $request, string $outTradeNo): JsonResponse
    {
        $user = PddToolV1ProfileResolver::user($request);
        if (!$user) {
            return response()->json(['detail' => 'Could not validate credentials'], 401);
        }

        $recharge = PddToolV1RechargeModel::query()
            ->where('user_id', $user->id)
            ->where('out_trade_no', $outTradeNo)
            ->first();

        if (!$recharge) {
            return response()->json(['detail' => 'Recharge not found'], 404);
        }

        if ($recharge->sandbox && $recharge->status === PddToolV1RechargeModel::STATUS_PENDING) {
            $this->settle($recharge);
        }

        return response()->json([
            'status' => (string) $recharge->status,
            'paid_at' => $recharge->paid_at ? $recharge->paid_at->toIso8601String() : null,
        ]);
    }

    /**
     * POST /pay/alipay/notify -> "success"  (raw text, alipay requirement)
     */
    public function alipayNotify(Request $request): \Illuminate\Http\Response
    {
        $payload = $request->all();
        $payment = new PddToolV1PaymentService();

        if (!$payment->verifyAlipayNotify($payload)) {
            return response('failure', 200)->header('Content-Type', 'text/plain');
        }

        $outTradeNo = (string) ($payload['out_trade_no'] ?? '');
        $recharge = PddToolV1RechargeModel::query()->where('out_trade_no', $outTradeNo)->first();
        if ($recharge && $recharge->status === PddToolV1RechargeModel::STATUS_PENDING) {
            $this->settle($recharge);
        }

        return response('success', 200)->header('Content-Type', 'text/plain');
    }

    /**
     * POST /pay/wechat/notify -> {code:"SUCCESS"} (wechat v3)
     */
    public function wechatNotify(Request $request): JsonResponse
    {
        $payload = $request->all();
        $payment = new PddToolV1PaymentService();

        $decrypted = $payment->verifyWechatNotify($payload, $request->headers->all());
        if ($decrypted === null) {
            return response()->json(['code' => 'FAIL', 'message' => 'verify failed'], 400);
        }

        $outTradeNo = (string) ($decrypted['out_trade_no'] ?? '');
        $recharge = PddToolV1RechargeModel::query()->where('out_trade_no', $outTradeNo)->first();
        if ($recharge && $recharge->status === PddToolV1RechargeModel::STATUS_PENDING) {
            $this->settle($recharge);
        }

        return response()->json(['code' => 'SUCCESS']);
    }

    /**
     * Mark a recharge paid and grant membership (extend valid_until + set tier).
     */
    private function settle(PddToolV1RechargeModel $recharge): void
    {
        $recharge->status = PddToolV1RechargeModel::STATUS_PAID;
        $recharge->paid_at = now();
        $recharge->save();

        $profile = PddToolV1ProfileModel::ensureTrial((int) $recharge->user_id);
        if ($recharge->package_name) {
            PddToolV1MembershipService::grant(
                $profile,
                (string) $recharge->package_name,
                (int) ($recharge->grant_days ?? 30)
            );
        }
    }
}
