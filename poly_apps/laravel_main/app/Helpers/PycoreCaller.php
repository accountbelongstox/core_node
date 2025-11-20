<?php

namespace App\Helpers;

use App\Providers\PycoreUrlFinder;
use Illuminate\Support\Facades\Http;
use Illuminate\Http\Client\Response;

/**
 * PycoreCaller - Base HTTP caller for Pycore Module Caller Service
 *
 * Provides HTTP interface to Pycore FastAPI service.
 * Automatically discovers service URL on WSL/Desktop environments.
 *
 * All Pycore utilities (OCR, TTS, browser, etc.) should use this as base caller.
 */
class PycoreCaller
{
    /**
     * Base URL of Pycore Module Caller service
     * Auto-discovered on first use via PycoreUrlFinder
     */
    protected static ?string $baseUrl = null;

    /**
     * Request timeout in seconds
     */
    protected static int $timeout = 30;

    /**
     * Enable/disable dynamic URL switching
     */
    protected static bool $dynamicSwitching = true;

    /**
     * Get base URL with auto-discovery and dynamic switching
     *
     * @return string Base URL of Pycore service
     */
    protected static function getBaseUrl(): string
    {
        if (self::$dynamicSwitching) {
            // Dynamic mode: always get fresh URL (with caching inside PycoreUrlFinder)
            self::$baseUrl = PycoreUrlFinder::getServiceUrl();
        } elseif (self::$baseUrl === null) {
            // Static mode: discover once and keep
            self::$baseUrl = PycoreUrlFinder::getServiceUrl();
        }

        return self::$baseUrl;
    }

    /**
     * Enable dynamic URL switching (default)
     *
     * @return void
     */
    public static function enableDynamicSwitching(): void
    {
        self::$dynamicSwitching = true;
    }

    /**
     * Disable dynamic URL switching (use static URL)
     *
     * @return void
     */
    public static function disableDynamicSwitching(): void
    {
        self::$dynamicSwitching = false;
    }

    /**
     * Set base URL for Pycore service (manual override)
     * Note: Disables dynamic switching when manually set
     *
     * @param string $url Base URL
     * @return void
     */
    public static function setBaseUrl(string $url): void
    {
        self::$baseUrl = rtrim($url, '/');
        self::$dynamicSwitching = false; // Disable dynamic switching
    }

    /**
     * Refresh service URL (re-discover)
     *
     * @return void
     */
    public static function refreshServiceUrl(): void
    {
        PycoreUrlFinder::clearCache();
        self::$baseUrl = null;
        self::$dynamicSwitching = true; // Re-enable dynamic switching
    }

    /**
     * Get diagnostics including URL finder info
     *
     * @return array Diagnostic information
     */
    public static function getDiagnostics(): array
    {
        return [
            'pycore_caller' => [
                'current_url' => self::$baseUrl,
                'dynamic_switching_enabled' => self::$dynamicSwitching,
                'timeout' => self::$timeout,
            ],
            'url_finder' => PycoreUrlFinder::getDiagnostics(),
        ];
    }

    /**
     * Set request timeout
     */
    public static function setTimeout(int $seconds): void
    {
        self::$timeout = $seconds;
    }

    /**
     * Check if Pycore service is healthy
     * 
     * @return array{success: bool, service: string, status: string, pycore_root: string, api_enabled: bool}|null
     */
    public static function health(): ?array
    {
        try {
            $response = Http::timeout(5)->get(self::getBaseUrl() . '/health');
            return $response->successful() ? $response->json() : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Get service status
     *
     * @return array|null
     */
    public static function status(): ?array
    {
        try {
            $response = Http::timeout(5)->get(self::getBaseUrl() . '/api/status');
            return $response->successful() ? $response->json() : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Call a generic Pycore module function
     * 
     * @param string $module Module path (e.g., 'pycore.pyutils.ocr.ocr_manager')
     * @param string $function Function path (e.g., 'ocr_manager.get_available_models')
     * @param array $args Positional arguments
     * @param array $kwargs Keyword arguments
     * @param bool $useFileImport Use file import instead of standard import
     * @return array{success: bool, result?: mixed, error?: string, traceback?: string}
     */
    public static function callModule(
        string $module,
        string $function,
        array $args = [],
        array $kwargs = [],
        bool $useFileImport = false
    ): array {
        try {
            $response = Http::timeout(self::$timeout)
                ->post(self::getBaseUrl() . '/api/call', [
                    'module' => $module,
                    'function' => $function,
                    'args' => $args,
                    'kwargs' => $kwargs,
                    'use_file_import' => $useFileImport,
                ]);

            if ($response->successful()) {
                return $response->json();
            }

            return [
                'success' => false,
                'error' => 'HTTP ' . $response->status() . ': ' . $response->body(),
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => 'Exception: ' . $e->getMessage(),
            ];
        }
    }

    /**
     * Get call history
     *
     * @return array|null
     */
    public static function history(): ?array
    {
        try {
            $response = Http::timeout(5)->get(self::getBaseUrl() . '/api/history');
            return $response->successful() ? $response->json() : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Get available utilities
     * 
     * @return array|null
     */
    public static function getAvailableUtilities(): ?array
    {
        $result = self::callModule(
            'pycore.pyutils',
            'get_available_utilities'
        );

        return $result['success'] ?? false ? $result['result'] : null;
    }

    // ========================================================================
    // Direct API Endpoints (Simplified)
    // ========================================================================

    /**
     * OCR: Get available models
     * 
     * @return array|null
     */
    public static function ocrGetModels(): ?array
    {
        try {
            $response = Http::timeout(5)->get(self::getBaseUrl() . '/ocr/models');
            return $response->successful() ? $response->json() : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * OCR: Get model info
     *
     * @param string $modelType Model type (e.g., 'scene', 'doc', 'number')
     * @return array|null
     */
    public static function ocrGetModelInfo(string $modelType): ?array
    {
        try {
            $response = Http::timeout(5)->get(self::getBaseUrl() . '/ocr/models/' . $modelType);
            return $response->successful() ? $response->json() : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * OCR: Check if model is loaded
     *
     * @param string $modelType Model type to check
     * @return bool|null
     */
    public static function ocrIsModelLoaded(string $modelType): ?bool
    {
        try {
            $response = Http::timeout(5)->get(self::getBaseUrl() . '/ocr/models/' . $modelType . '/loaded');
            if ($response->successful()) {
                $data = $response->json();
                return $data['result']['loaded'] ?? null;
            }
            return null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * OCR: Get service status
     *
     * @return array|null
     */
    public static function ocrStatus(): ?array
    {
        try {
            $response = Http::timeout(5)->get(self::getBaseUrl() . '/ocr/status');
            return $response->successful() ? $response->json() : null;
        } catch (\Exception $e) {
            return null;
        }
    }

    /**
     * Check if Pycore service is available
     * 
     * @return bool
     */
    public static function isAvailable(): bool
    {
        $health = self::health();
        return $health !== null && ($health['success'] ?? false);
    }
}
