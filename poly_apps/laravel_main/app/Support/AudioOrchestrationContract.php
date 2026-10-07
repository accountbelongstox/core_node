<?php

namespace App\Support;

use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use RuntimeException;

/**
 * Laravel adapter for the audio orchestration contract (clip transfer limits
 * and the clip bundle frame shared with pycore and the clients).
 *
 * Source: config/audio_orchestration_contract.json (repo root)
 * Aligned adapters:
 * - pycore/pyctl/audio_orchestration/orch_contract.py
 * - poly_apps/pycore_laravel_wordnew_ui/core/contracts/AudioOrchestrationContract.ts
 */
final class AudioOrchestrationContract
{
    private static ?array $document = null;

    public static function document(): array
    {
        if (self::$document !== null) {
            return self::$document;
        }

        $path = PathMapper::getCoreNodeDir().DIRECTORY_SEPARATOR.'config'
            .DIRECTORY_SEPARATOR.'audio_orchestration_contract.json';
        $json = FileSystemManager::readFile($path, false);
        $document = is_string($json) ? json_decode($json, true) : null;
        if (!is_array($document) || !is_array($document['transfer'] ?? null)) {
            throw new RuntimeException("Unable to load audio orchestration contract: {$path}");
        }

        self::$document = $document;

        return self::$document;
    }

    /** One value of the `transfer` section. */
    public static function transfer(string $name): int|string
    {
        $value = self::document()['transfer'][$name] ?? null;
        if (!is_int($value) && !is_string($value)) {
            throw new RuntimeException("Unknown audio orchestration transfer value: {$name}");
        }

        return $value;
    }

    /** One value of the `book_plan` section (dot path into nested arrays, e.g. fast_pass.engine). */
    public static function bookPlan(string $path): mixed
    {
        $value = self::document()['book_plan'] ?? null;

        foreach (explode('.', $path) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                throw new RuntimeException("Unknown audio orchestration book_plan value: {$path}");
            }
            $value = $value[$segment];
        }

        return $value;
    }

    /** One value of the `phrase_pipeline` section (dot path, e.g. extraction.batch_sentences). */
    public static function phrasePipeline(string $path): mixed
    {
        $value = self::document()['phrase_pipeline'] ?? null;

        foreach (explode('.', $path) as $segment) {
            if (!is_array($value) || !array_key_exists($segment, $value)) {
                throw new RuntimeException("Unknown audio orchestration phrase_pipeline value: {$path}");
            }
            $value = $value[$segment];
        }

        return $value;
    }
}
