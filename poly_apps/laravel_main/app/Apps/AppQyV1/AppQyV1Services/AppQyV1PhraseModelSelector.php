<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Services\AiGateway\OpenRouterFreeOnly;
use App\Support\AudioOrchestrationContract;
use Illuminate\Support\Facades\Cache;

/**
 * Picks the OpenRouter free models of a phrase-extraction request
 * (docs_fix/DESIGN_PHRASE_PIPELINE.md section 4, phrase_pipeline.extraction.model_selection).
 *
 * Candidates: the contract's pinned free ids that the live free catalog still
 * lists, topped up from that catalog (free, text output, enough context, the
 * required request parameters, no guard/embedding ids, preferred id patterns
 * first). Models that answered badly collect strikes and sit out a cooldown.
 * The catalog is read from the cache only (OpenRouterCatalogWarmTask keeps it
 * fresh), so choosing never waits on the network.
 */
final class AppQyV1PhraseModelSelector
{
    private const CACHE_STORE = 'file';
    private const HEALTH_KEY = 'appqyv1:phrase_extraction:model_health';
    private const HEALTH_KEEP_SECONDS = 86400;
    private const CATALOG_PARAMETERS_FIELD = 'supported_parameters';
    private const CATALOG_MODALITIES_FIELD = 'output_modalities';
    private const TEXT_MODALITY = 'text';

    public const FAILURE_UNPARSEABLE = 'unparseable';
    public const FAILURE_EMPTY = 'empty';
    public const FAILURE_TRUNCATED = 'truncated';
    public const FAILURE_TIMEOUT = 'timeout';
    public const FAILURE_REASONING_ONLY = 'reasoning_only';
    public const FAILURE_MODEL_ERROR = 'model_error';

    /**
     * The request models: `model` is the primary, `models` the in-request
     * fallback list (primary first, at most max_models). `model` is null when
     * every candidate is cooling down.
     *
     * @return array{model:?string, models:array<int,string>, cooled:int}
     */
    public function choose(): array
    {
        $health = $this->health();
        $now = time();
        $max = max(1, (int) $this->setting('max_models'));
        $catalog = $this->liveCatalog();
        $chosen = [];
        $cooled = 0;

        foreach ($this->pinned() as $id) {
            if ($catalog !== [] && !isset($catalog[$id])) {
                continue;
            }
            if ($this->isCooled($health, $id, $now)) {
                $cooled++;
                continue;
            }
            $chosen[] = $id;
        }
        if ((bool) $this->setting('enabled') && count($chosen) < $max) {
            foreach ($this->catalogCandidates($catalog) as $id) {
                if (in_array($id, $chosen, true) || in_array($id, $this->pinned(), true)) {
                    continue;
                }
                if ($this->isCooled($health, $id, $now)) {
                    $cooled++;
                    continue;
                }
                $chosen[] = $id;
                if (count($chosen) >= $max) {
                    break;
                }
            }
        }
        $chosen = array_slice($chosen, 0, $max);

        return ['model' => $chosen[0] ?? null, 'models' => $chosen, 'cooled' => $cooled];
    }

    public function recordSuccess(?string $model): void
    {
        $health = $this->health();
        $id = $this->id($model);

        if ($id === '' || !isset($health[$id])) {
            return;
        }
        unset($health[$id]['strikes'], $health[$id]['until'], $health[$id]['reason']);
        $health[$id]['last_ok'] = time();
        $this->saveHealth($health);
    }

    /**
     * One bad answer of $model. True when this strike put the model into cooldown.
     */
    public function recordFailure(?string $model, string $reason): bool
    {
        $health = $this->health();
        $id = $this->id($model);
        $weights = (array) $this->setting('strike_weights');
        $limit = max(1, (int) $this->setting('strike_limit'));
        $strikes = 0;

        if ($id === '') {
            return false;
        }
        $strikes = (int) ($health[$id]['strikes'] ?? 0) + max(1, (int) ($weights[$reason] ?? 1));
        $health[$id]['strikes'] = $strikes;
        $health[$id]['reason'] = $reason;
        $health[$id]['last_failure'] = time();
        if ($strikes >= $limit) {
            $health[$id]['until'] = time() + max(1, (int) $this->setting('cooldown_seconds'));
            $health[$id]['strikes'] = 0;
            $this->saveHealth($health);

            return true;
        }
        $this->saveHealth($health);

        return false;
    }

    /** Seconds until the first candidate leaves its cooldown (0 when none is cooling). */
    public function secondsUntilAvailable(): int
    {
        $now = time();
        $soonest = 0;

        foreach ($this->health() as $entry) {
            $until = (int) ($entry['until'] ?? 0);
            if ($until > $now && ($soonest === 0 || $until - $now < $soonest)) {
                $soonest = $until - $now;
            }
        }

        return $soonest;
    }

    /** @return array<string,array{strikes:int,reason:?string,cooled_until:?int,last_ok:?int,last_failure:?int}> */
    public function snapshot(): array
    {
        $out = [];
        $now = time();

        foreach ($this->health() as $id => $entry) {
            $until = (int) ($entry['until'] ?? 0);
            $out[$id] = [
                'strikes' => (int) ($entry['strikes'] ?? 0),
                'reason' => isset($entry['reason']) ? (string) $entry['reason'] : null,
                'cooled_until' => $until > $now ? $until : null,
                'last_ok' => isset($entry['last_ok']) ? (int) $entry['last_ok'] : null,
                'last_failure' => isset($entry['last_failure']) ? (int) $entry['last_failure'] : null,
            ];
        }

        return $out;
    }

    /** Contract pinned ids: the primary model, then request_options.models. */
    private function pinned(): array
    {
        $ids = array_merge(
            [(string) AudioOrchestrationContract::phrasePipeline('extraction.model')],
            array_map('strval', (array) ($this->options()['models'] ?? []))
        );

        return array_values(array_unique(array_filter(
            array_map(static fn (string $id): string => trim($id), $ids),
            static fn (string $id): bool => $id !== '' && OpenRouterFreeOnly::isFree($id)
        )));
    }

    private function options(): array
    {
        return (array) AudioOrchestrationContract::phrasePipeline('extraction.request_options');
    }

    /**
     * Live free catalog keyed by id; empty when only the offline fallback is
     * cached (its entries carry no supported_parameters), so pinned ids are trusted then.
     *
     * @return array<string,array>
     */
    private function liveCatalog(): array
    {
        $live = [];

        foreach (OpenRouterFreeOnly::cachedFreeCatalog() as $entry) {
            if (is_array($entry) && isset($entry['id']) && array_key_exists(self::CATALOG_PARAMETERS_FIELD, $entry)) {
                $live[(string) $entry['id']] = $entry;
            }
        }

        return $live;
    }

    /**
     * Catalog ids that suit extraction, best first.
     *
     * @param array<string,array> $catalog
     * @return array<int,string>
     */
    private function catalogCandidates(array $catalog): array
    {
        $minContext = (int) $this->setting('min_context_length');
        $required = array_map('strval', (array) $this->setting('required_parameters'));
        $exclude = array_map('strtolower', array_map('strval', (array) $this->setting('exclude_id_patterns')));
        $prefer = array_map('strtolower', array_map('strval', (array) $this->setting('prefer_id_patterns')));
        $scored = [];

        foreach ($catalog as $id => $entry) {
            $lower = strtolower((string) $id);
            $modalities = (array) ($entry[self::CATALOG_MODALITIES_FIELD] ?? []);

            if ($id === OpenRouterFreeOnly::FREE_ROUTER
                || (int) ($entry['context_length'] ?? 0) < $minContext
                || array_diff($required, (array) ($entry[self::CATALOG_PARAMETERS_FIELD] ?? [])) !== []
                || ($modalities !== [] && !in_array(self::TEXT_MODALITY, $modalities, true))
                || $this->matchesAny($lower, $exclude)) {
                continue;
            }
            $scored[$id] = [$this->matchesAny($lower, $prefer) ? 1 : 0, (int) ($entry['context_length'] ?? 0)];
        }
        uksort($scored, static function (string $a, string $b) use ($scored): int {
            return [$scored[$b][0], $scored[$b][1], $a] <=> [$scored[$a][0], $scored[$a][1], $b];
        });

        return array_keys($scored);
    }

    private function matchesAny(string $haystack, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($haystack, $needle)) {
                return true;
            }
        }

        return false;
    }

    private function isCooled(array $health, string $id, int $now): bool
    {
        return (int) ($health[$id]['until'] ?? 0) > $now;
    }

    private function id(?string $model): string
    {
        return $model === null ? '' : trim($model);
    }

    private function health(): array
    {
        $health = Cache::store(self::CACHE_STORE)->get(self::HEALTH_KEY, []);

        return is_array($health) ? $health : [];
    }

    private function saveHealth(array $health): void
    {
        Cache::store(self::CACHE_STORE)->put(self::HEALTH_KEY, $health, self::HEALTH_KEEP_SECONDS);
    }

    private function setting(string $name): mixed
    {
        return AudioOrchestrationContract::phrasePipeline('extraction.model_selection.' . $name);
    }
}
