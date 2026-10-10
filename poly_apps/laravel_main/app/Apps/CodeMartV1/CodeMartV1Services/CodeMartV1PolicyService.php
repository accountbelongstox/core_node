<?php

namespace App\Apps\CodeMartV1\CodeMartV1Services;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants as C;
use App\Services\UserConfig\UserConfigService;
use Illuminate\Support\Facades\Validator;

/**
 * Operator-editable CodeMart business rules. The defaults are the constants in
 * CodeMartV1Constants; overrides are persisted in the operator settings store
 * (UserConfigService, key codemartv1_policy; the app download list keeps its
 * own key) and validated here, so every consumer reads one effective value.
 */
class CodeMartV1PolicyService
{
    public const GROUP_FINANCE = 'finance';
    public const GROUP_PROJECTS = 'projects';
    public const GROUP_ROLES = 'roles';
    public const GROUP_REVIEWS = 'reviews';
    public const GROUP_ACCOUNTS = 'accounts';
    public const GROUP_LIMITS = 'limits';
    public const GROUP_ESTIMATE = 'estimate';
    public const GROUP_DOWNLOADS = 'downloads';

    public const TYPE_INT = 'int';
    public const TYPE_FLOAT = 'float';
    public const TYPE_STRING = 'string';
    public const TYPE_LIST = 'list';
    public const TYPE_MAP = 'map';
    public const TYPE_EXAM = 'exam';
    public const TYPE_DOWNLOADS = 'downloads';

    private const KEY_APP_DOWNLOADS = 'app_downloads';
    private const MAX_MONEY = 100000000;
    private const DOWNLOAD_PLATFORMS = [C::APP_PLATFORM_ANDROID, C::APP_PLATFORM_IOS];
    private const KNOWN_PAYMENT_METHODS = [
        C::PAYMENT_METHOD_WALLET,
        C::PAYMENT_METHOD_CREDIT_CARD,
        C::PAYMENT_METHOD_BANK_TRANSFER,
        C::PAYMENT_METHOD_ALIPAY,
        C::PAYMENT_METHOD_WECHAT,
    ];
    private const KNOWN_DEPOSIT_METHODS = [
        C::PAYMENT_METHOD_BANK_TRANSFER,
        C::PAYMENT_METHOD_ALIPAY,
        C::PAYMENT_METHOD_WECHAT,
    ];
    private const KNOWN_IMAGE_TYPES = ['jpg', 'jpeg', 'png'];
    private const CURRENCY_RULE = ['required', 'string', 'regex:/^[A-Z]{3}$/'];

    private static ?array $definitions = null;

    /** @return array<string, array<string, mixed>> */
    public static function definitions(): array
    {
        if (self::$definitions !== null) {
            return self::$definitions;
        }

        $complexities = C::COMPLEXITIES;
        $ratingRule = 'required|integer|min:' . C::MIN_RATING . '|max:' . C::MAX_RATING;
        $defs = [
            // Finance
            'platform_commission_rate' => self::num(self::GROUP_FINANCE, self::TYPE_FLOAT, C::PLATFORM_COMMISSION_RATE, 0, 0.5, 0.001),
            'deposit_client' => self::num(self::GROUP_FINANCE, self::TYPE_INT, C::DEPOSIT_CLIENT, 0, self::MAX_MONEY),
            'deposit_developer' => self::num(self::GROUP_FINANCE, self::TYPE_INT, C::DEPOSIT_DEVELOPER, 0, self::MAX_MONEY),
            'deposit_architect_additional' => self::num(self::GROUP_FINANCE, self::TYPE_INT, C::DEPOSIT_ARCHITECT_ADDITIONAL, 0, self::MAX_MONEY),
            'deposit_min_amount' => self::num(self::GROUP_FINANCE, self::TYPE_INT, C::DEPOSIT_MIN_AMOUNT, 1, self::MAX_MONEY),
            'wallet_top_up_max_amount' => self::num(self::GROUP_FINANCE, self::TYPE_INT, C::WALLET_TOP_UP_MAX_AMOUNT, 1, self::MAX_MONEY),
            'withdrawal_min_amount' => self::num(self::GROUP_FINANCE, self::TYPE_FLOAT, C::WITHDRAWAL_MIN_AMOUNT, 0.01, self::MAX_MONEY, 0.01),
            'default_currency' => [
                'group' => self::GROUP_FINANCE, 'type' => self::TYPE_STRING, 'default' => C::DEFAULT_CURRENCY,
                'rules' => ['' => self::CURRENCY_RULE],
            ],
            'supported_currencies' => [
                'group' => self::GROUP_FINANCE, 'type' => self::TYPE_LIST, 'default' => C::SUPPORTED_CURRENCIES,
                'rules' => ['' => 'required|array|min:1|max:20', '*' => self::CURRENCY_RULE],
            ],
            'payment_methods' => self::options(self::GROUP_FINANCE, C::getAllPaymentMethods(), self::KNOWN_PAYMENT_METHODS),
            'deposit_payment_methods' => self::options(self::GROUP_FINANCE, C::DEPOSIT_PAYMENT_METHODS, self::KNOWN_DEPOSIT_METHODS),
            'withdrawal_methods' => self::options(self::GROUP_FINANCE, C::WITHDRAWAL_METHODS, C::WITHDRAWAL_METHODS),

            // Projects
            'project_min_budget' => self::num(self::GROUP_PROJECTS, self::TYPE_INT, C::PROJECT_MIN_BUDGET, 1, self::MAX_MONEY),

            // Roles
            'architect_min_projects' => self::num(self::GROUP_ROLES, self::TYPE_INT, C::ARCHITECT_MIN_PROJECTS, 0, 1000),
            'architect_min_code_score' => self::num(self::GROUP_ROLES, self::TYPE_INT, C::ARCHITECT_MIN_CODE_SCORE, 0, C::CODE_SCORE_SCALE),
            'architect_min_satisfaction' => self::num(self::GROUP_ROLES, self::TYPE_FLOAT, C::ARCHITECT_MIN_SATISFACTION, 0, C::MAX_RATING, 0.1),

            // Reviews and the reviewer qualification exam
            'review_comment_min_length' => self::num(self::GROUP_REVIEWS, self::TYPE_INT, C::REVIEWER_COMMENT_MIN_LENGTH, 0, 1000),
            'reviewer_retry_days' => self::num(self::GROUP_REVIEWS, self::TYPE_INT, C::REVIEWER_RETRY_DAYS, 1, 365),
            'reviewer_min_similarity' => self::num(self::GROUP_REVIEWS, self::TYPE_INT, C::REVIEWER_MIN_SIMILARITY, 1, 100),
            'review_recommend_approve_min' => self::num(self::GROUP_REVIEWS, self::TYPE_FLOAT, C::REVIEW_RECOMMEND_APPROVE_MIN, C::MIN_RATING, C::MAX_RATING, 0.1),
            'review_recommend_revision_min' => self::num(self::GROUP_REVIEWS, self::TYPE_FLOAT, C::REVIEW_RECOMMEND_REVISION_MIN, C::MIN_RATING, C::MAX_RATING, 0.1),
            'reviewer_exam' => [
                'group' => self::GROUP_REVIEWS, 'type' => self::TYPE_EXAM, 'default' => C::REVIEWER_EXAM,
                'rules' => [
                    '' => 'required|array|min:1|max:20',
                    '*.code_snippet_id' => 'required|integer|min:1|distinct',
                    '*.code' => 'required|string|min:1|max:4000',
                    '*.expected_ratings.quality' => $ratingRule,
                    '*.expected_ratings.readability' => $ratingRule,
                    '*.expected_ratings.efficiency' => $ratingRule,
                ],
            ],

            // Accounts
            'password_min_length' => self::num(self::GROUP_ACCOUNTS, self::TYPE_INT, C::PASSWORD_MIN_LENGTH, 6, 64),

            // Limits and formats
            'max_attachment_size_kb' => self::num(self::GROUP_LIMITS, self::TYPE_INT, C::MAX_ATTACHMENT_SIZE, 64, 1048576),
            'max_kyc_image_size_kb' => self::num(self::GROUP_LIMITS, self::TYPE_INT, C::MAX_KYC_IMAGE_SIZE, 64, 51200),
            'allowed_image_types' => self::options(self::GROUP_LIMITS, C::ALLOWED_IMAGE_TYPES, self::KNOWN_IMAGE_TYPES),
            'default_page_size' => self::num(self::GROUP_LIMITS, self::TYPE_INT, C::DEFAULT_PAGE_SIZE, 1, 200),
            'max_page_size' => self::num(self::GROUP_LIMITS, self::TYPE_INT, C::MAX_PAGE_SIZE, 1, 500),
            'testimonial_max_quote_length' => self::num(self::GROUP_LIMITS, self::TYPE_INT, C::TESTIMONIAL_MAX_QUOTE_LENGTH, 50, 5000),

            // Estimate formula (public estimate and AI analysis)
            'ai_estimate_currency' => [
                'group' => self::GROUP_ESTIMATE, 'type' => self::TYPE_STRING, 'default' => C::AI_ESTIMATE_CURRENCY,
                'rules' => ['' => self::CURRENCY_RULE],
            ],
            'ai_estimate_hourly_rate' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::AI_ESTIMATE_HOURLY_RATE, 1, 100000, 1),
            'ai_estimate_hours_per_complexity' => self::num(self::GROUP_ESTIMATE, self::TYPE_INT, C::AI_ESTIMATE_HOURS_PER_COMPLEXITY, 1, 10000),
            'ai_estimate_senior_team_threshold' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::AI_ESTIMATE_SENIOR_TEAM_THRESHOLD, 0, 1000, 0.5),
            'estimate_hourly_rates' => self::tierMap(C::ESTIMATE_HOURLY_RATES, 1, 100000, $complexities),
            'estimate_base_hours' => self::tierMap(C::ESTIMATE_BASE_HOURS, 1, 100000, $complexities),
            'estimate_platform_factor' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::ESTIMATE_PLATFORM_FACTOR, 0, 5, 0.01),
            'estimate_feature_factor' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::ESTIMATE_FEATURE_FACTOR, 0, 5, 0.01),
            'estimate_range_low' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::ESTIMATE_RANGE_LOW, 0.1, 5, 0.01),
            'estimate_range_high' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::ESTIMATE_RANGE_HIGH, 0.1, 5, 0.01),
            'estimate_hourly_rate_low' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::ESTIMATE_HOURLY_RATE_LOW, 0.1, 5, 0.01),
            'estimate_hourly_rate_high' => self::num(self::GROUP_ESTIMATE, self::TYPE_FLOAT, C::ESTIMATE_HOURLY_RATE_HIGH, 0.1, 5, 0.01),
            'estimate_week_hours_fast' => self::num(self::GROUP_ESTIMATE, self::TYPE_INT, C::ESTIMATE_WEEK_HOURS_FAST, 1, 10000),
            'estimate_week_hours_slow' => self::num(self::GROUP_ESTIMATE, self::TYPE_INT, C::ESTIMATE_WEEK_HOURS_SLOW, 1, 10000),
            'estimate_platforms_range' => self::triple(C::ESTIMATE_PLATFORMS_RANGE, 1, 50),
            'estimate_features_range' => self::triple(C::ESTIMATE_FEATURES_RANGE, 1, 500),
            'estimate_team' => [
                'group' => self::GROUP_ESTIMATE, 'type' => self::TYPE_MAP, 'default' => C::ESTIMATE_TEAM,
                'keys' => $complexities, 'options' => C::getAllRoles(),
                'rules' => array_merge(
                    ['' => 'required|array'],
                    ...array_map(static fn (string $tier): array => [
                        $tier => 'required|array|min:1|max:20',
                        $tier . '.*' => 'required|in:' . implode(',', C::getAllRoles()),
                    ], $complexities)
                ),
            ],

            // Downloads
            self::KEY_APP_DOWNLOADS => [
                'group' => self::GROUP_DOWNLOADS, 'type' => self::TYPE_DOWNLOADS, 'default' => [],
                'platforms' => self::DOWNLOAD_PLATFORMS,
                'rules' => [
                    '' => 'present|array|max:20',
                    '*.platform' => 'required|in:' . implode(',', self::DOWNLOAD_PLATFORMS),
                    '*.version' => 'nullable|string|max:40',
                    '*.url' => ['required', 'string', 'max:2048', 'regex:#^(https?://|/)\S+$#'],
                    '*.min_os' => ['nullable', 'string', 'max:20', 'regex:/^\d+(\.\d+){0,2}$/'],
                ],
            ],
            'app_default_min_os' => [
                'group' => self::GROUP_DOWNLOADS, 'type' => self::TYPE_MAP, 'default' => C::APP_DEFAULT_MIN_OS,
                'keys' => self::DOWNLOAD_PLATFORMS,
                'rules' => [
                    '' => 'required|array',
                    C::APP_PLATFORM_ANDROID => ['required', 'string', 'max:20', 'regex:/^\d+(\.\d+){0,2}$/'],
                    C::APP_PLATFORM_IOS => ['required', 'string', 'max:20', 'regex:/^\d+(\.\d+){0,2}$/'],
                ],
            ],
        ];

        self::$definitions = $defs;

        return $defs;
    }

    private static function num(string $group, string $type, int|float $default, int|float $min, int|float $max, int|float|null $step = null): array
    {
        $rule = ($type === self::TYPE_INT ? 'required|integer' : 'required|numeric') . '|min:' . $min . '|max:' . $max;

        return [
            'group' => $group, 'type' => $type, 'default' => $default, 'min' => $min, 'max' => $max,
            'step' => $step ?? ($type === self::TYPE_INT ? 1 : 0.01),
            'rules' => ['' => $rule],
        ];
    }

    private static function options(string $group, array $default, array $options): array
    {
        return [
            'group' => $group, 'type' => self::TYPE_LIST, 'default' => array_values($default), 'options' => array_values($options),
            'rules' => ['' => 'required|array|min:1', '*' => 'required|in:' . implode(',', $options) . '|distinct'],
        ];
    }

    private static function tierMap(array $default, int|float $min, int|float $max, array $tiers): array
    {
        $rules = ['' => 'required|array'];
        foreach ($tiers as $tier) {
            $rules[$tier] = 'required|numeric|min:' . $min . '|max:' . $max;
        }

        return [
            'group' => self::GROUP_ESTIMATE, 'type' => self::TYPE_MAP, 'default' => $default, 'keys' => $tiers,
            'min' => $min, 'max' => $max, 'rules' => $rules,
        ];
    }

    private static function triple(array $default, int $min, int $max): array
    {
        return [
            'group' => self::GROUP_ESTIMATE, 'type' => self::TYPE_LIST, 'default' => $default, 'min' => $min, 'max' => $max,
            'rules' => ['' => 'required|array|size:3', '*' => 'required|integer|min:' . $min . '|max:' . $max],
        ];
    }

    /** @return array<string, mixed> */
    public static function defaults(): array
    {
        $out = [];
        foreach (self::definitions() as $key => $def) {
            $out[$key] = $def['default'];
        }

        return $out;
    }

    /** Stored overrides only (key => value), the app download list included. */
    public static function overrides(): array
    {
        $config = app(UserConfigService::class);
        $stored = $config->get(UserConfigService::CODEMARTV1_POLICY, []);
        $overrides = [];
        if (is_array($stored)) {
            $definitions = self::definitions();
            foreach ($stored as $key => $value) {
                if (isset($definitions[$key]) && $key !== self::KEY_APP_DOWNLOADS) {
                    $overrides[$key] = $value;
                }
            }
        }
        $downloads = $config->get(UserConfigService::CODEMARTV1_APP_DOWNLOADS, []);
        if (is_array($downloads) && $downloads !== []) {
            $overrides[self::KEY_APP_DOWNLOADS] = array_values($downloads);
        }

        return $overrides;
    }

    /** Effective values: override when stored, otherwise the constant default. */
    public static function all(): array
    {
        return array_merge(self::defaults(), self::overrides());
    }

    public static function value(string $key): mixed
    {
        $overrides = self::overrides();

        return array_key_exists($key, $overrides) ? $overrides[$key] : (self::definitions()[$key]['default'] ?? null);
    }

    public static function depositAmount(string $role): int
    {
        return match ($role) {
            C::ROLE_DEVELOPER => self::int('deposit_developer'),
            C::ROLE_ARCHITECT => self::int('deposit_developer') + self::int('deposit_architect_additional'),
            C::ROLE_CLIENT => self::int('deposit_client'),
            default => 0,
        };
    }

    public static function int(string $key): int
    {
        return (int) self::value($key);
    }

    public static function float(string $key): float
    {
        return (float) self::value($key);
    }

    public static function string(string $key): string
    {
        return (string) self::value($key);
    }

    public static function list(string $key): array
    {
        $value = self::value($key);

        return is_array($value) ? array_values($value) : [];
    }

    public static function currency(): string
    {
        return self::string('default_currency');
    }

    public static function aiEstimateCurrency(): string
    {
        return self::string('ai_estimate_currency');
    }

    public static function commissionRate(): float
    {
        return self::float('platform_commission_rate');
    }

    /** Decimal string for bcmath, never in exponent notation. */
    public static function commissionRateString(): string
    {
        return number_format(self::commissionRate(), 6, '.', '');
    }

    public static function minOsFor(string $platform): string
    {
        $map = self::value('app_default_min_os');

        return is_array($map) && isset($map[$platform]) ? (string) $map[$platform] : (string) (C::APP_DEFAULT_MIN_OS[$platform] ?? '');
    }

    /** Reviewer exam entries (with the grading key). */
    public static function reviewerExam(): array
    {
        $exam = self::value('reviewer_exam');

        return is_array($exam) && $exam !== [] ? array_values($exam) : C::REVIEWER_EXAM;
    }

    /** Validation attribute names are translated by the controller; this only normalizes. */
    private static function normalize(string $key, mixed $value): mixed
    {
        $def = self::definitions()[$key];

        return match ($def['type']) {
            self::TYPE_INT => (int) $value,
            self::TYPE_FLOAT => round((float) $value, 6),
            self::TYPE_STRING => (string) $value,
            self::TYPE_LIST => self::normalizeList($def, (array) $value),
            self::TYPE_MAP => self::normalizeMap($def, (array) $value),
            self::TYPE_EXAM => self::normalizeExam((array) $value),
            self::TYPE_DOWNLOADS => self::normalizeDownloads((array) $value),
            default => $value,
        };
    }

    private static function normalizeList(array $def, array $value): array
    {
        $list = array_values($value);
        if (isset($def['min'], $def['max'])) {
            return array_map('intval', $list);
        }

        return array_values(array_unique(array_map('strval', $list)));
    }

    private static function normalizeMap(array $def, array $value): array
    {
        $out = [];
        foreach ($def['keys'] as $mapKey) {
            $entry = $value[$mapKey] ?? null;
            if (is_array($entry)) {
                $out[$mapKey] = array_values(array_map('strval', $entry));
            } elseif (is_numeric($entry) && isset($def['min'])) {
                $out[$mapKey] = $entry + 0;
            } else {
                $out[$mapKey] = (string) $entry;
            }
        }

        return $out;
    }

    private static function normalizeExam(array $value): array
    {
        $out = [];
        foreach (array_values($value) as $entry) {
            $ratings = (array) ($entry['expected_ratings'] ?? []);
            $out[] = [
                'code_snippet_id' => (int) $entry['code_snippet_id'],
                'code' => (string) $entry['code'],
                'expected_ratings' => [
                    C::REVIEW_DIMENSION_QUALITY => (int) $ratings[C::REVIEW_DIMENSION_QUALITY],
                    C::REVIEW_DIMENSION_READABILITY => (int) $ratings[C::REVIEW_DIMENSION_READABILITY],
                    C::REVIEW_DIMENSION_EFFICIENCY => (int) $ratings[C::REVIEW_DIMENSION_EFFICIENCY],
                ],
            ];
        }

        return $out;
    }

    private static function normalizeDownloads(array $value): array
    {
        $out = [];
        foreach (array_values($value) as $entry) {
            $out[] = [
                'platform' => (string) $entry['platform'],
                'version' => trim((string) ($entry['version'] ?? '')),
                'url' => trim((string) $entry['url']),
                'min_os' => trim((string) ($entry['min_os'] ?? '')),
            ];
        }

        return $out;
    }

    /**
     * Validate and persist changes. $settings maps a key to its new value, or
     * to null to restore the constant default.
     *
     * @return array{ok: bool, errors?: array<string, array<int, string>>, values?: array}
     */
    public static function update(array $settings): array
    {
        $definitions = self::definitions();
        $errors = [];
        $reset = [];
        $incoming = [];

        foreach ($settings as $key => $value) {
            if (!is_string($key) || !isset($definitions[$key])) {
                $errors['settings.' . (is_string($key) ? $key : (string) $key)] = [__('codemart.policy.unknown_key')];
                continue;
            }
            if ($value === null) {
                $reset[] = $key;
            } else {
                $incoming[$key] = $value;
            }
        }
        if ($errors !== []) {
            return ['ok' => false, 'errors' => $errors];
        }

        $rules = [];
        foreach ($incoming as $key => $_value) {
            foreach ($definitions[$key]['rules'] as $suffix => $rule) {
                $path = $suffix === '' ? $key : $key . '.' . $suffix;
                $rules[$path] = $rule;
            }
        }
        if ($rules !== []) {
            $validator = Validator::make($incoming, $rules, [], self::attributeNames($incoming));
            if ($validator->fails()) {
                return ['ok' => false, 'errors' => $validator->errors()->toArray()];
            }
        }

        $normalized = [];
        foreach ($incoming as $key => $value) {
            $normalized[$key] = self::normalize($key, $value);
        }

        $effective = array_merge(self::all(), $normalized);
        foreach ($reset as $key) {
            $effective[$key] = $definitions[$key]['default'];
        }
        $crossErrors = self::crossCheck($effective);
        if ($crossErrors !== []) {
            return ['ok' => false, 'errors' => $crossErrors];
        }

        if (!self::persist($normalized, $reset)) {
            return ['ok' => false, 'errors' => ['settings' => [__('codemart.policy.persist_failed')]]];
        }

        return ['ok' => true, 'values' => self::all()];
    }

    private static function attributeNames(array $incoming): array
    {
        $names = [];
        foreach (array_keys($incoming) as $key) {
            $names[$key] = __('codemart.policy.fields.' . $key);
        }

        return $names;
    }

    /** @return array<string, array<int, string>> */
    private static function crossCheck(array $effective): array
    {
        $errors = [];
        $fail = static function (string $key, string $reason) use (&$errors): void {
            $errors[$key][] = __('codemart.policy.' . $reason);
        };

        if (!in_array($effective['default_currency'], $effective['supported_currencies'], true)) {
            $fail('default_currency', 'currency_not_supported');
        }
        if (!in_array($effective['ai_estimate_currency'], $effective['supported_currencies'], true)) {
            $fail('ai_estimate_currency', 'currency_not_supported');
        }
        if ((float) $effective['wallet_top_up_max_amount'] < (float) $effective['deposit_min_amount']) {
            $fail('wallet_top_up_max_amount', 'max_below_min');
        }
        if ((int) $effective['default_page_size'] > (int) $effective['max_page_size']) {
            $fail('default_page_size', 'page_size_above_max');
        }
        if ((float) $effective['review_recommend_revision_min'] >= (float) $effective['review_recommend_approve_min']) {
            $fail('review_recommend_revision_min', 'revision_not_below_approve');
        }
        if ((float) $effective['estimate_range_low'] > (float) $effective['estimate_range_high']) {
            $fail('estimate_range_low', 'low_above_high');
        }
        if ((float) $effective['estimate_hourly_rate_low'] > (float) $effective['estimate_hourly_rate_high']) {
            $fail('estimate_hourly_rate_low', 'low_above_high');
        }
        foreach (['estimate_platforms_range', 'estimate_features_range'] as $key) {
            [$min, $max, $default] = array_pad(array_values((array) $effective[$key]), 3, 0);
            if ($min > $max || $default < $min || $default > $max) {
                $fail($key, 'range_invalid');
            }
        }
        foreach (array_keys(C::ESTIMATE_BASE_HOURS) as $tier) {
            if (!isset($effective['estimate_team'][$tier]) || $effective['estimate_team'][$tier] === []) {
                $fail('estimate_team', 'team_tier_missing');
                break;
            }
        }

        return $errors;
    }

    private static function persist(array $normalized, array $reset): bool
    {
        $config = app(UserConfigService::class);
        $stored = $config->get(UserConfigService::CODEMARTV1_POLICY, []);
        $stored = is_array($stored) ? $stored : [];

        foreach ($normalized as $key => $value) {
            if ($key === self::KEY_APP_DOWNLOADS) {
                continue;
            }
            $stored[$key] = $value;
        }
        foreach ($reset as $key) {
            unset($stored[$key]);
        }

        $ok = $config->set(UserConfigService::CODEMARTV1_POLICY, $stored === [] ? null : $stored);
        if ($ok && array_key_exists(self::KEY_APP_DOWNLOADS, $normalized)) {
            $ok = $config->set(UserConfigService::CODEMARTV1_APP_DOWNLOADS, $normalized[self::KEY_APP_DOWNLOADS] === [] ? null : $normalized[self::KEY_APP_DOWNLOADS]);
        }
        if ($ok && in_array(self::KEY_APP_DOWNLOADS, $reset, true)) {
            $ok = $config->set(UserConfigService::CODEMARTV1_APP_DOWNLOADS, null);
        }

        return $ok;
    }

    /** Admin projection: effective values, defaults, overridden keys and the editor schema. */
    public static function adminView(): array
    {
        $overrides = self::overrides();
        $schema = [];
        foreach (self::definitions() as $key => $def) {
            $schema[$key] = array_intersect_key($def, array_flip(['group', 'type', 'min', 'max', 'step', 'options', 'keys', 'platforms']));
        }

        return [
            'settings' => self::all(),
            'defaults' => self::defaults(),
            'overridden' => array_keys($overrides),
            'schema' => $schema,
            'groups' => [
                self::GROUP_FINANCE, self::GROUP_PROJECTS, self::GROUP_ROLES, self::GROUP_REVIEWS,
                self::GROUP_ACCOUNTS, self::GROUP_LIMITS, self::GROUP_ESTIMATE, self::GROUP_DOWNLOADS,
            ],
        ];
    }

    /** Policy block of GET /bootstrap vocabulary (the UI reads it through useCmPolicy). */
    public static function bootstrapPolicy(): array
    {
        $v = self::all();
        $exam = self::reviewerExam();

        return [
            'currency' => $v['default_currency'],
            'supported_currencies' => array_values($v['supported_currencies']),
            'ai_estimate_currency' => $v['ai_estimate_currency'],
            'deposit_amounts' => [
                C::ROLE_CLIENT => self::depositAmount(C::ROLE_CLIENT),
                C::ROLE_DEVELOPER => self::depositAmount(C::ROLE_DEVELOPER),
                C::ROLE_ARCHITECT => self::depositAmount(C::ROLE_ARCHITECT),
            ],
            'platform_commission_rate' => (float) $v['platform_commission_rate'],
            'default_page_size' => (int) $v['default_page_size'],
            'max_page_size' => (int) $v['max_page_size'],
            'max_attachment_size_kb' => (int) $v['max_attachment_size_kb'],
            'max_kyc_image_size_kb' => (int) $v['max_kyc_image_size_kb'],
            'allowed_document_types' => C::ALLOWED_DOCUMENT_TYPES,
            'allowed_image_types' => array_values($v['allowed_image_types']),
            'review_dimensions' => [
                C::REVIEW_DIMENSION_QUALITY,
                C::REVIEW_DIMENSION_READABILITY,
                C::REVIEW_DIMENSION_EFFICIENCY,
                C::REVIEW_DIMENSION_SECURITY,
            ],
            'rating_range' => [C::MIN_RATING, C::MAX_RATING],
            'project_min_budget' => (int) $v['project_min_budget'],
            'review_comment_min_length' => (int) $v['review_comment_min_length'],
            'reviewer_retry_days' => (int) $v['reviewer_retry_days'],
            'reviewer_pass_score' => (int) $v['reviewer_min_similarity'],
            'reviewer_exam_count' => count($exam),
            'password_min_length' => (int) $v['password_min_length'],
            'testimonial_max_quote_length' => (int) $v['testimonial_max_quote_length'],
            'payment_methods' => array_values($v['payment_methods']),
            'deposit_payment_methods' => array_values($v['deposit_payment_methods']),
            'withdrawal_methods' => array_values($v['withdrawal_methods']),
            'withdrawal_min_amount' => (float) $v['withdrawal_min_amount'],
            'wallet_top_up_min_amount' => (int) $v['deposit_min_amount'],
            'wallet_top_up_max_amount' => (int) $v['wallet_top_up_max_amount'],
            'app_default_min_os' => $v['app_default_min_os'],
            'payment_types' => C::PAYMENT_TYPES,
            'payment_creatable_types' => C::PAYMENT_CREATABLE_TYPES,
            'identity_types' => C::IDENTITY_TYPES,
            'kyc_document_slots' => array_keys(C::KYC_FILE_COLUMNS),
            'dispute_resolutions' => C::DISPUTE_RESOLUTIONS,
            'supported_locales' => C::SUPPORTED_LOCALES,
            'task_priorities' => C::TASK_PRIORITIES,
            'complexities' => C::COMPLEXITIES,
            'budget_types' => C::BUDGET_TYPES,
        ];
    }

    /** Unauthenticated subset (registration and estimate pages). */
    public static function publicPolicy(): array
    {
        return [
            'currency' => self::currency(),
            'ai_estimate_currency' => self::aiEstimateCurrency(),
            'password_min_length' => self::int('password_min_length'),
            'platform_commission_rate' => self::commissionRate(),
            'project_min_budget' => self::int('project_min_budget'),
        ];
    }
}
