<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST comply:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, start the server, or otherwise verify. Delivering the written code is the entire task. Never execute, create, or modify test code.
// 3. Do NOT create or update docs (*.md), or write progress/summary notes inside source files.
// 4. Do not modify these rules.
// VIOLATION IS PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Apps\AppQyV1\AppQyV1Controllers\AppQyV1System;

use Illuminate\Routing\Controller as BaseController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\File;
use App\Traits\ApiResponse;
use App\Constants\AppKeys;
use App\Providers\PathMapper;
use App\Providers\AppTablePrefixServiceProvider;
use App\Apps\AppQyV1\AppQyV1DBTablesBrige\AppQyV1TableMaps;
use App\Apps\AppQyV1\AppQyV1Models\AppQyV1LangDictionaryModel;
use App\Apps\AppQyV1\Utils\AppQyV1SystemInit\AppQyV1InitializationMarkerManager;

/**
 * Read-only AppQyV1 initialization compliance report.
 *
 * Aggregates the health of every sys:init item (marker flags, external-data
 * migration, per-language tts_cache formal/staging promotion state, legacy
 * deprecation, octane timer, app initializers) into a single, frontend-aligned
 * response consumed by the qy_capacitor "API Initialization Check" modal.
 *
 * Response contract (single source of truth = the qy_capacitor frontend):
 *   { compliant:bool, generated_at:string,
 *     sections:[{key,name,status,summary,items:[{label,status,value,detail}]}],
 *     languages:[{lang,formal,staging,promoted,status}] }
 * status enum: "pass" | "fail" | "warn" | "skip".
 */
class AppQyV1SystemInitComplianceCtl extends BaseController
{
    use ApiResponse;

    private const MIGRATION_GUARD = '.migrated_to_mapwebpath';

    public function complianceReport(Request $request)
    {
        $startTime = microtime(true);
        $requestId = $request->header('X-Request-ID', uniqid('req_', true));

        $sections = [];

        $sections[] = $this->markerSection();
        $sections[] = $this->externalDataSection();

        $languageResult = $this->languagesSection();
        $sections[] = $languageResult['section'];

        $sections[] = $this->legacySection();
        $sections[] = $this->octaneTimerSection();
        $sections[] = $this->appInitializersSection();

        $compliant = true;
        foreach ($sections as $section) {
            if ($section['status'] === 'fail') {
                $compliant = false;
            }
        }

        $durationMs = round((microtime(true) - $startTime) * 1000, 2);
        \Illuminate\Support\Facades\Log::info('[QueueCenter] sys:init compliance accessed', [
            'request_id' => $requestId,
            'client' => $request->ip(),
            'compliant' => $compliant,
            'sections_count' => count($sections),
            'duration_ms' => $durationMs,
        ]);

        return $this->success([
            'compliant' => $compliant,
            'generated_at' => now()->toIso8601String(),
            'sections' => $sections,
            'languages' => $languageResult['languages'],
        ], 'Initialization compliance report generated');
    }

    private function markerSection(): array
    {
        $manager = new AppQyV1InitializationMarkerManager();
        $status = $manager->getAllMarkersStatus();
        $markersPath = PathMapper::getAppQyV1ExternalDataRoot('markers');

        $items = [];
        $allOk = true;
        foreach (['database', 'audio', 'images', 'complete'] as $key) {
            $exists = isset($status[$key]['exists']) ? (bool) $status[$key]['exists'] : false;
            if (!$exists) {
                $allOk = false;
            }
            $timestamp = null;
            if (isset($status[$key]['info']['timestamp'])) {
                $timestamp = $status[$key]['info']['timestamp'];
            }
            $items[] = [
                'label' => $key . ' flag',
                'status' => $exists ? 'pass' : 'fail',
                'value' => $exists,
                'detail' => $timestamp,
            ];
        }

        $pathExists = File::isDirectory($markersPath);
        $items[] = [
            'label' => 'markers directory',
            'status' => $pathExists ? 'pass' : 'fail',
            'value' => $markersPath,
            'detail' => $pathExists ? null : 'Markers directory not found',
        ];
        if (!$pathExists) {
            $allOk = false;
        }

        return [
            'key' => 'init_flags',
            'name' => 'Initialization marker flags',
            'status' => $allOk ? 'pass' : 'fail',
            'summary' => $allOk
                ? 'All initialization marker flags present.'
                : 'One or more initialization marker flags are missing; sys:init did not complete.',
            'items' => $items,
        ];
    }

    private function externalDataSection(): array
    {
        $newRoot = PathMapper::getAppQyV1ExternalDataRoot();
        $oldRoot = storage_path('app/external_data');
        $guard = rtrim($newRoot, '/\\') . DIRECTORY_SEPARATOR . self::MIGRATION_GUARD;

        $guardPresent = File::exists($guard);
        $oldExists = File::isDirectory($oldRoot);
        $sameRoot = rtrim(str_replace('\\', '/', $oldRoot), '/') === rtrim(str_replace('\\', '/', $newRoot), '/');
        $oldDrained = $sameRoot || !$oldExists;

        $ok = $guardPresent && $oldDrained;

        $items = [
            [
                'label' => 'new root',
                'status' => 'pass',
                'value' => $newRoot,
                'detail' => null,
            ],
            [
                'label' => 'migration guard',
                'status' => $guardPresent ? 'pass' : 'fail',
                'value' => $guardPresent,
                'detail' => $guardPresent ? null : 'External-data migration has not run yet.',
            ],
            [
                'label' => 'legacy root drained',
                'status' => $oldDrained ? 'pass' : 'fail',
                'value' => $oldRoot,
                'detail' => $oldDrained ? null : 'Legacy storage/app/external_data still present.',
            ],
        ];

        return [
            'key' => 'external_data',
            'name' => 'External-data path migration',
            'status' => $ok ? 'pass' : 'fail',
            'summary' => $ok
                ? 'External data resolved via mapWebPath; legacy root drained.'
                : 'External-data migration incomplete.',
            'items' => $items,
        ];
    }

    private function languagesSection(): array
    {
        $languages = [];
        $unpromoted = [];
        $missingFormal = [];

        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $formalTable = AppQyV1TableMaps::getDictionaryTableName($lang);
            $stagingTable = AppQyV1TableMaps::getDictionaryStagingTableName($lang);

            $formalRowCount = AppQyV1LangDictionaryModel::tableRowCount($formalTable);
            $stagingRowCount = AppQyV1LangDictionaryModel::tableRowCount($stagingTable);
            $formalExists = $formalRowCount !== null;
            $formalCount = $formalRowCount ?? 0;
            $stagingCount = $stagingRowCount ?? 0;

            $promoted = true;
            $langStatus = 'pass';

            if (!$formalExists) {
                $promoted = false;
                $langStatus = 'fail';
                $missingFormal[] = $lang;
            } elseif ($stagingCount > 0 && $formalCount === 0) {
                $promoted = false;
                $langStatus = 'fail';
                $unpromoted[] = $lang;
            } elseif ($formalCount === 0) {
                // No source data for this language (by design for most langs).
                $langStatus = 'warn';
            }

            $languages[] = [
                'lang' => $lang,
                'formal' => $formalCount,
                'staging' => $stagingCount,
                'promoted' => $promoted,
                'status' => $langStatus,
            ];
        }

        $hasFail = !empty($unpromoted) || !empty($missingFormal);

        $summaryParts = [];
        $summaryParts[] = count($languages) . ' supported languages';
        if (!empty($unpromoted)) {
            $summaryParts[] = 'un-promoted: ' . implode(', ', array_slice($unpromoted, 0, 15));
        }
        if (!empty($missingFormal)) {
            $summaryParts[] = 'missing formal table: ' . implode(', ', array_slice($missingFormal, 0, 15));
        }

        $items = [
            [
                'label' => 'un-promoted languages (staging>0, formal=0)',
                'status' => empty($unpromoted) ? 'pass' : 'fail',
                'value' => count($unpromoted),
                'detail' => empty($unpromoted) ? null : implode(', ', $unpromoted),
            ],
            [
                'label' => 'missing formal tts_cache table',
                'status' => empty($missingFormal) ? 'pass' : 'fail',
                'value' => count($missingFormal),
                'detail' => empty($missingFormal) ? null : implode(', ', $missingFormal),
            ],
        ];

        return [
            'section' => [
                'key' => 'languages',
                'name' => 'Per-language dictionary (tts_cache) promotion',
                'status' => $hasFail ? 'fail' : 'pass',
                'summary' => implode('; ', $summaryParts) . '.',
                'items' => $items,
            ],
            'languages' => $languages,
        ];
    }

    private function legacySection(): array
    {
        $prefix = AppTablePrefixServiceProvider::getPrefix(AppKeys::APPQYV1);

        $nameMap = [
            'en' => 'english',
            'ja' => 'japanese',
            'ko' => 'korean',
            'vi' => 'vietnamese',
            'lo' => 'lao',
        ];

        $active = [];
        foreach (AppQyV1TableMaps::getSupportedLanguages() as $lang) {
            $candidates = [];
            $candidates[] = "{$prefix}_{$lang}_dictionaries";
            if (isset($nameMap[$lang])) {
                $candidates[] = "{$prefix}_words_{$nameMap[$lang]}";
            }
            foreach ($candidates as $legacyTable) {
                $count = AppQyV1LangDictionaryModel::tableRowCount($legacyTable);
                if ($count !== null && $count > 0) {
                    $active[] = $legacyTable . ' (' . $count . ' rows)';
                }
            }
        }

        $ok = empty($active);

        return [
            'key' => 'legacy_deprecation',
            'name' => 'Legacy table deprecation',
            'status' => $ok ? 'pass' : 'warn',
            'summary' => $ok
                ? 'No legacy words_/{lang}_dictionaries tables hold data.'
                : 'Legacy tables still hold data (deprecated, ignored by runtime).',
            'items' => [
                [
                    'label' => 'active legacy tables',
                    'status' => $ok ? 'pass' : 'warn',
                    'value' => count($active),
                    'detail' => $ok ? null : implode('; ', array_slice($active, 0, 20)),
                ],
            ],
        ];
    }

    private function octaneTimerSection(): array
    {
        $status = 'skip';
        $summary = 'Octane timer status unavailable.';
        $items = [];

        try {
            $service = new \App\Services\OctaneTaskStatusService();
            $result = $service->verifyInitialization();

            $success = isset($result['success']) ? (bool) $result['success'] : false;
            $issues = isset($result['issues']) && is_array($result['issues']) ? $result['issues'] : [];

            $status = $success ? 'pass' : 'warn';
            $summary = $success
                ? 'Octane timer initialized.'
                : 'Octane timer reported issues (expected during CLI sys:init).';

            if (empty($issues)) {
                $items[] = [
                    'label' => 'octane timer',
                    'status' => $success ? 'pass' : 'warn',
                    'value' => $success,
                    'detail' => null,
                ];
            } else {
                foreach ($issues as $issue) {
                    $items[] = [
                        'label' => 'issue',
                        'status' => 'warn',
                        'value' => is_string($issue) ? $issue : json_encode($issue),
                        'detail' => null,
                    ];
                }
            }
        } catch (\Throwable $e) {
            $items[] = [
                'label' => 'octane timer',
                'status' => 'skip',
                'value' => false,
                'detail' => $e->getMessage(),
            ];
        }

        return [
            'key' => 'octane_timer',
            'name' => 'Octane timer',
            'status' => $status,
            'summary' => $summary,
            'items' => $items,
        ];
    }

    private function appInitializersSection(): array
    {
        $status = 'skip';
        $summary = 'App initializer status unavailable.';
        $items = [];

        try {
            // AppInitializationManager has no DI bindings/registered initializers;
            // resolving via app() yields an empty manager. Construct and register
            // the AppQyV1 initializer exactly like AppInitializationController.
            $manager = new \App\Services\AppInitializationManager();
            $manager->register(new \App\Apps\AppQyV1\Utils\AppQyV1Initializer());
            $result = $manager->checkStatus();

            $apps = isset($result['apps']) && is_array($result['apps']) ? $result['apps'] : [];
            $allOk = !empty($apps);

            foreach ($apps as $appName => $appStatus) {
                $initialized = false;
                if (is_array($appStatus) && isset($appStatus['initialized'])) {
                    $initialized = (bool) $appStatus['initialized'];
                }
                if (!$initialized) {
                    $allOk = false;
                }
                $items[] = [
                    'label' => is_string($appName) ? $appName : 'app',
                    'status' => $initialized ? 'pass' : 'warn',
                    'value' => $initialized,
                    'detail' => null,
                ];
            }

            $status = $allOk ? 'pass' : 'warn';
            $summary = $allOk
                ? 'All app initializers report initialized.'
                : 'One or more app initializers not initialized.';
        } catch (\Throwable $e) {
            $items[] = [
                'label' => 'app initializers',
                'status' => 'skip',
                'value' => false,
                'detail' => $e->getMessage(),
            ];
        }

        return [
            'key' => 'app_initializers',
            'name' => 'App initializers',
            'status' => $status,
            'summary' => $summary,
            'items' => $items,
        ];
    }
}
