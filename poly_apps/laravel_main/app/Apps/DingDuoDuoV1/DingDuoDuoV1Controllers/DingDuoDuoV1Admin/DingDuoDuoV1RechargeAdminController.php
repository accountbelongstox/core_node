<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\DingDuoDuoV1\DingDuoDuoV1Controllers\DingDuoDuoV1Admin;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Routing\Controller as BaseController;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Models\DingDuoDuoV1RechargeConfigModel;
use App\Apps\DingDuoDuoV1\DingDuoDuoV1Constants\DingDuoDuoV1Constants;

/**
 * Admin recharge-API settings: read / update the single recharge_config row
 * (provider, credentials, gateway endpoint, notify URL, packages, enabled).
 * Guarded by 'custom.authenticate' at the route layer.
 */
class DingDuoDuoV1RechargeAdminController extends BaseController
{
    /**
     * GET admin/recharge-config -> the config row (created lazily with defaults).
     */
    public function getConfig(): JsonResponse
    {
        $config = self::firstOrCreateConfig();

        return response()->json([
            'success' => true,
            'data' => $config->toArray(),
        ]);
    }

    /**
     * POST admin/recharge-config -> update the config row.
     */
    public function updateConfig(Request $request): JsonResponse
    {
        $data = $request->validate([
            'provider' => ['nullable', 'string', 'max:32'],
            'api_key' => ['nullable', 'string', 'max:255'],
            'api_secret' => ['nullable', 'string', 'max:255'],
            'endpoint' => ['nullable', 'string', 'max:255'],
            'notify_url' => ['nullable', 'string', 'max:255'],
            'packages' => ['nullable', 'array'],
            'enabled' => ['nullable', 'boolean'],
        ]);

        $config = self::firstOrCreateConfig();

        foreach (['provider', 'api_key', 'api_secret', 'endpoint', 'notify_url'] as $field) {
            if (array_key_exists($field, $data)) {
                $config->{$field} = $data[$field];
            }
        }
        if (array_key_exists('packages', $data) && $data['packages'] !== null) {
            $config->packages = array_values($data['packages']);
        }
        if (array_key_exists('enabled', $data) && $data['enabled'] !== null) {
            $config->enabled = (bool) $data['enabled'];
        }
        $config->saveRecord();

        return response()->json([
            'success' => true,
            'data' => $config->freshRecord()->toArray(),
        ]);
    }

    /**
     * Get the config row, seeding a 'custom' enabled default with the default
     * package list when none exists yet.
     */
    private static function firstOrCreateConfig(): DingDuoDuoV1RechargeConfigModel
    {
        $config = DingDuoDuoV1RechargeConfigModel::current();
        if ($config) {
            return $config;
        }

        return DingDuoDuoV1RechargeConfigModel::createRecord([
            'provider' => DingDuoDuoV1Constants::DEFAULT_PROVIDER,
            'enabled' => true,
            'packages' => DingDuoDuoV1Constants::DEFAULT_PACKAGES,
        ]);
    }
}
