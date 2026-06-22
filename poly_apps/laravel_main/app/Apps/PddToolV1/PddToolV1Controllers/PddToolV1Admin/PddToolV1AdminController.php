<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\PddToolV1\PddToolV1Controllers\PddToolV1Admin;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;
use App\Models\User;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1ProfileModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PddAccountModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1RechargeModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PackageModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1PaymentSettingModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1UsageLogModel;
use App\Apps\PddToolV1\PddToolV1Models\PddToolV1BatchOrderModel;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1Presenter;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1MembershipService;
use App\Apps\PddToolV1\PddToolV1Services\PddToolV1PaymentService;
use App\Apps\PddToolV1\PddToolV1Constants\PddToolV1Defaults;
use App\Support\CoreNodeSecrets;

/**
 * pdd-manager admin console backend (/api/pdd/admin/*). Behind 'dashboard.auth'.
 * Implements the PDD_ADMIN_PAYMENT_SPEC admin API.
 */
class PddToolV1AdminController extends BaseController
{
    /**
     * Wrap a success payload in the standard dashboard envelope {success,data}
     * expected by the UI's BaseAPI (which sets res.data = body.data).
     */
    private function ok($data, int $status = 200): JsonResponse
    {
        return response()->json(['success' => true, 'data' => $data], $status);
    }

    /**
     * Bulk-load usernames from the global users table (a different connection than
     * the profiles), keyed by user id. Used to hydrate admin rows without a
     * cross-database SQL join.
     *
     * @param  array<int> $userIds
     * @return array<int,string>  user_id => username
     */
    private function usernamesFor(array $userIds): array
    {
        $userIds = array_values(array_unique(array_filter(array_map('intval', $userIds))));
        if (empty($userIds)) {
            return [];
        }
        return User::query()
            ->whereIn('id', $userIds)
            ->pluck('username', 'id')
            ->map(fn ($u) => (string) $u)
            ->all();
    }

    /**
     * Resolve a single username by user id (empty string if the user is gone).
     */
    private function usernameFor(int $userId): string
    {
        $username = User::query()->where('id', $userId)->value('username');
        return $username !== null ? (string) $username : '';
    }

    /**
     * GET /stats -> overview cards.
     */
    public function stats(Request $request): JsonResponse
    {
        $now = now();
        $usersTotal = PddToolV1ProfileModel::query()->count();
        $usersActive = PddToolV1ProfileModel::query()
            ->where('disabled', false)
            ->where('valid_until', '>', $now)
            ->count();
        $expiring7d = PddToolV1ProfileModel::query()
            ->whereBetween('valid_until', [$now, (clone $now)->addDays(7)])
            ->count();
        $revenueTotal = (float) PddToolV1RechargeModel::query()
            ->where('status', PddToolV1RechargeModel::STATUS_PAID)
            ->sum('amount');
        $revenue30d = (float) PddToolV1RechargeModel::query()
            ->where('status', PddToolV1RechargeModel::STATUS_PAID)
            ->where('paid_at', '>=', (clone $now)->subDays(30))
            ->sum('amount');
        $pddAccountsTotal = PddToolV1PddAccountModel::query()->count();

        return $this->ok([
            'users_total' => $usersTotal,
            'users_active' => $usersActive,
            'expiring_7d' => $expiring7d,
            'revenue_total' => round($revenueTotal, 2),
            'revenue_30d' => round($revenue30d, 2),
            'pdd_accounts_total' => $pddAccountsTotal,
        ]);
    }

    /**
     * GET /users?search=&page=&per_page=&package=&expired= -> {data,total,page,per_page}
     */
    public function users(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->input('page', 1));
        $perPage = min(200, max(1, (int) $request->input('per_page', 20)));
        $search = trim((string) $request->input('search', ''));
        $package = trim((string) $request->input('package', ''));
        $expired = $request->input('expired', null);

        $query = PddToolV1ProfileModel::query();

        // Username lives on the global users table (different connection), so a
        // username search resolves matching user ids there first, then filters
        // profiles by user_id.
        if ($search !== '') {
            $matchingIds = User::query()
                ->where('username', 'like', '%' . $search . '%')
                ->pluck('id')
                ->map(fn ($id) => (int) $id)
                ->all();
            if (empty($matchingIds)) {
                return $this->ok(['data' => [], 'total' => 0, 'page' => $page, 'per_page' => $perPage]);
            }
            $query->whereIn('user_id', $matchingIds);
        }
        if ($package !== '') {
            $query->where('package_name', $package);
        }
        if ($expired !== null && $expired !== '') {
            $isExpired = filter_var($expired, FILTER_VALIDATE_BOOLEAN);
            if ($isExpired) {
                $query->where('valid_until', '<=', now());
            } else {
                $query->where('valid_until', '>', now());
            }
        }

        $total = (clone $query)->count();
        $rows = $query->orderByDesc('user_id')
            ->forPage($page, $perPage)
            ->get();

        $usernames = $this->usernamesFor($rows->pluck('user_id')->all());

        return $this->ok([
            'data' => $rows->map(fn ($p) => PddToolV1Presenter::userAdmin($p, $usernames[(int) $p->user_id] ?? ''))->all(),
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
        ]);
    }

    /**
     * GET /users/{id} -> {user, usage, recharges}
     */
    public function userDetail(Request $request, int $id): JsonResponse
    {
        $profile = $this->findProfile($id);
        if (!$profile) {
            return response()->json(['detail' => 'User not found'], 404);
        }

        $batchOrders = PddToolV1BatchOrderModel::query()->where('user_id', $id)->count();
        $bindCount = PddToolV1PddAccountModel::query()->where('user_id', $id)->count();
        $recharges = PddToolV1RechargeModel::query()
            ->where('user_id', $id)
            ->orderByDesc('id')
            ->limit(50)
            ->get();

        return $this->ok([
            'user' => PddToolV1Presenter::userAdmin($profile, $this->usernameFor($id)),
            'usage' => [
                'batch_orders' => $batchOrders,
                'bind_count' => $bindCount,
                'last_login' => $profile->last_login ? $profile->last_login->toIso8601String() : null,
            ],
            'recharges' => $recharges->map(fn ($r) => PddToolV1Presenter::recharge($r))->all(),
        ]);
    }

    /**
     * POST /users/{id}/membership {package_name?,valid_until?,extend_days?,max_orders?,max_pdd_accounts?}
     *   -> updated USER_ADMIN
     */
    public function setMembership(Request $request, int $id): JsonResponse
    {
        $profile = $this->findProfile($id);
        if (!$profile) {
            return response()->json(['detail' => 'User not found'], 404);
        }

        if ($request->filled('package_name')) {
            $code = (string) $request->input('package_name');
            $package = PddToolV1MembershipService::resolvePackage($code);
            if ($package) {
                $profile->package_name = $package['code'];
                $profile->max_orders = (int) $package['max_orders'];
                $profile->max_pdd_accounts = (int) $package['max_pdd_accounts'];
            } else {
                $profile->package_name = $code;
            }
        }

        if ($request->filled('valid_until')) {
            $profile->valid_until = Carbon::parse((string) $request->input('valid_until'));
        }

        if ($request->filled('extend_days')) {
            $base = ($profile->valid_until && $profile->valid_until->isFuture()) ? $profile->valid_until : now();
            $profile->valid_until = Carbon::parse($base)->addDays((int) $request->input('extend_days'));
        }

        // Explicit limit overrides win over the package-derived values above.
        if ($request->has('max_orders')) {
            $profile->max_orders = (int) $request->input('max_orders');
        }
        if ($request->has('max_pdd_accounts')) {
            $profile->max_pdd_accounts = (int) $request->input('max_pdd_accounts');
        }

        $profile->save();

        return $this->ok(PddToolV1Presenter::userAdmin($profile->refresh(), $this->usernameFor($id)));
    }

    /**
     * POST /users/{id}/points {delta, reason} -> {points}
     */
    public function adjustPoints(Request $request, int $id): JsonResponse
    {
        $profile = $this->findProfile($id);
        if (!$profile) {
            return response()->json(['detail' => 'User not found'], 404);
        }

        $delta = (float) $request->input('delta', 0);
        $reason = (string) $request->input('reason', '');

        $points = PddToolV1MembershipService::adjustPoints($profile, $delta);
        PddToolV1UsageLogModel::record($id, 'points_adjust', ['delta' => $delta, 'reason' => $reason]);

        return $this->ok(['points' => round($points, 2)]);
    }

    /**
     * POST /users/{id}/disable -> {ok:true}
     */
    public function disable(Request $request, int $id): JsonResponse
    {
        return $this->toggleDisabled($id, true);
    }

    /**
     * POST /users/{id}/enable -> {ok:true}
     */
    public function enable(Request $request, int $id): JsonResponse
    {
        return $this->toggleDisabled($id, false);
    }

    private function toggleDisabled(int $id, bool $disabled): JsonResponse
    {
        $profile = $this->findProfile($id);
        if (!$profile) {
            return response()->json(['detail' => 'User not found'], 404);
        }
        $profile->disabled = $disabled;
        $profile->save();
        return $this->ok(['ok' => true]);
    }

    /**
     * Resolve a membership profile by user id for an admin action. Creates a TRIAL
     * profile on demand if the global user exists but has no PddToolV1 profile yet
     * (so the admin can manage any registered user); returns null if there is no
     * such user at all.
     */
    private function findProfile(int $id): ?PddToolV1ProfileModel
    {
        $profile = PddToolV1ProfileModel::query()->where('user_id', $id)->first();
        if ($profile) {
            return $profile;
        }
        if (!User::query()->where('id', $id)->exists()) {
            return null;
        }
        return PddToolV1ProfileModel::ensureTrial($id);
    }

    /**
     * GET /recharges?status=&page= -> {data,total}
     */
    public function recharges(Request $request): JsonResponse
    {
        $page = max(1, (int) $request->input('page', 1));
        $perPage = min(200, max(1, (int) $request->input('per_page', 20)));
        $status = trim((string) $request->input('status', ''));

        $query = PddToolV1RechargeModel::query();
        if ($status !== '') {
            $query->where('status', $status);
        }

        $total = (clone $query)->count();
        $rows = $query->orderByDesc('id')->forPage($page, $perPage)->get();

        return $this->ok([
            'data' => $rows->map(fn ($r) => PddToolV1Presenter::recharge($r))->all(),
            'total' => $total,
        ]);
    }

    /**
     * GET /memberships/expiring?days=7 -> {data:[USER_ADMIN]}
     */
    public function expiring(Request $request): JsonResponse
    {
        $days = max(1, (int) $request->input('days', 7));
        $rows = PddToolV1ProfileModel::query()
            ->whereBetween('valid_until', [now(), now()->addDays($days)])
            ->orderBy('valid_until')
            ->get();

        $usernames = $this->usernamesFor($rows->pluck('user_id')->all());

        return $this->ok([
            'data' => $rows->map(fn ($p) => PddToolV1Presenter::userAdmin($p, $usernames[(int) $p->user_id] ?? ''))->all(),
        ]);
    }

    /**
     * GET /payment-settings -> PAYMENT_SETTINGS_PUBLIC (no secrets in clear).
     */
    public function getPaymentSettings(Request $request): JsonResponse
    {
        $settings = PddToolV1PaymentSettingModel::query()->first();

        return $this->ok([
            'alipay' => [
                'enabled' => (bool) ($settings->alipay_enabled ?? false),
                'app_id' => (string) ($settings->alipay_app_id ?? ''),
                'configured' => PddToolV1PaymentService::alipayConfigured(),
            ],
            'wechat' => [
                'enabled' => (bool) ($settings->wechat_enabled ?? false),
                'mch_id' => (string) ($settings->wechat_mch_id ?? ''),
                'configured' => PddToolV1PaymentService::wechatConfigured(),
            ],
        ]);
    }

    /**
     * POST /payment-settings -> PAYMENT_SETTINGS_PUBLIC
     *
     * Persists enable toggles + non-secret identifiers. Secret values (private
     * keys / api_v3_key) are NOT accepted here; they live in CoreNodeSecrets.
     */
    public function savePaymentSettings(Request $request): JsonResponse
    {
        $settings = PddToolV1PaymentSettingModel::query()->first() ?: new PddToolV1PaymentSettingModel();

        $alipay = (array) $request->input('alipay', []);
        $wechat = (array) $request->input('wechat', []);

        if (array_key_exists('enabled', $alipay)) {
            $settings->alipay_enabled = filter_var($alipay['enabled'], FILTER_VALIDATE_BOOLEAN);
        }
        if (array_key_exists('app_id', $alipay)) {
            $settings->alipay_app_id = (string) $alipay['app_id'];
        }
        if (array_key_exists('enabled', $wechat)) {
            $settings->wechat_enabled = filter_var($wechat['enabled'], FILTER_VALIDATE_BOOLEAN);
        }
        if (array_key_exists('mch_id', $wechat)) {
            $settings->wechat_mch_id = (string) $wechat['mch_id'];
        }
        if (array_key_exists('app_id', $wechat)) {
            $settings->wechat_app_id = (string) $wechat['app_id'];
        }

        $settings->save();

        // Persist secret credentials to CoreNodeSecrets (never the DB / .env). A blank
        // value means "keep existing" — only write when a non-empty value was supplied.
        $putSecret = function (array $src, string $field, string $secretKey): void {
            if (array_key_exists($field, $src)) {
                $val = trim((string) $src[$field]);
                if ($val !== '') {
                    CoreNodeSecrets::put($secretKey, $val);
                }
            }
        };
        $putSecret($alipay, 'app_id', 'PDD_TOOL_V1_ALIPAY_APP_ID');
        $putSecret($alipay, 'private_key', 'PDD_TOOL_V1_ALIPAY_PRIVATE_KEY');
        $putSecret($alipay, 'public_key', 'PDD_TOOL_V1_ALIPAY_PUBLIC_KEY');
        $putSecret($wechat, 'mch_id', 'PDD_TOOL_V1_WECHAT_MCH_ID');
        $putSecret($wechat, 'app_id', 'PDD_TOOL_V1_WECHAT_APP_ID');
        $putSecret($wechat, 'api_v3_key', 'PDD_TOOL_V1_WECHAT_API_V3_KEY');
        $putSecret($wechat, 'cert_serial', 'PDD_TOOL_V1_WECHAT_CERT_SERIAL');
        $putSecret($wechat, 'private_key', 'PDD_TOOL_V1_WECHAT_PRIVATE_KEY');

        return $this->getPaymentSettings($request);
    }

    /**
     * GET /packages -> {data:[PACKAGE]}
     */
    public function packages(Request $request): JsonResponse
    {
        $rows = PddToolV1PackageModel::query()->orderBy('id')->get();
        if ($rows->isEmpty()) {
            $data = array_values(array_map(
                fn ($p) => PddToolV1Presenter::package($p),
                PddToolV1Defaults::PACKAGES
            ));
            return $this->ok(['data' => $data]);
        }
        return $this->ok([
            'data' => $rows->map(fn ($p) => PddToolV1Presenter::package($p))->all(),
        ]);
    }

    /**
     * POST /packages -> {data:[PACKAGE]}  (upsert tier prices by code).
     */
    public function upsertPackages(Request $request): JsonResponse
    {
        $incoming = $request->input('data', $request->input('packages', []));
        if (!is_array($incoming)) {
            $incoming = [];
        }

        foreach ($incoming as $item) {
            $item = (array) $item;
            $code = (string) ($item['code'] ?? '');
            if ($code === '') {
                continue;
            }
            $package = PddToolV1PackageModel::query()->where('code', $code)->first() ?: new PddToolV1PackageModel();
            $package->code = $code;
            $package->name = (string) ($item['name'] ?? $package->name ?? $code);
            if (array_key_exists('price_month', $item)) {
                $package->price_month = (float) $item['price_month'];
            }
            if (array_key_exists('price_year', $item)) {
                $package->price_year = (float) $item['price_year'];
            }
            if (array_key_exists('max_orders', $item)) {
                $package->max_orders = (int) $item['max_orders'];
            }
            if (array_key_exists('max_pdd_accounts', $item)) {
                $package->max_pdd_accounts = (int) $item['max_pdd_accounts'];
            }
            if (array_key_exists('enabled', $item)) {
                $package->enabled = filter_var($item['enabled'], FILTER_VALIDATE_BOOLEAN);
            }
            $package->save();
        }

        return $this->packages($request);
    }
}
