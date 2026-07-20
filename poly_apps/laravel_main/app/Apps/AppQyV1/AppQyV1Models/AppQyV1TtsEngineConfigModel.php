<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

use Illuminate\Database\Eloquent\Model;
use App\Constants\AppKeys;
use App\Providers\AppTablePrefixServiceProvider;
use Illuminate\Support\Facades\Log;

/**
 * DB-driven TTS engine priority config (app_qy_v1_tts_engine_config).
 *
 * Canonical engine priority order for the TTS orchestrator + the Queue Center
 * drawer. Seeded idempotently at sys:init. Reads fall back gracefully when the
 * table is missing (pre-migration) so the priority proxy + variant resolution
 * stay usable before the first migration runs.
 */
class AppQyV1TtsEngineConfigModel extends Model
{
    protected $appKey = AppKeys::APPQYV1;

    public function __construct(array $attributes = [])
    {
        parent::__construct($attributes);
        $this->connection = AppTablePrefixServiceProvider::getConnection($this->appKey);
        $this->table = AppTablePrefixServiceProvider::buildTableName($this->appKey, 'tts_engine_config');
    }

    public function getConnectionName()
    {
        return AppTablePrefixServiceProvider::getConnection($this->appKey);
    }

    protected $fillable = [
        'engine',
        'priority_order',
        'enabled',
    ];

    protected $casts = [
        'priority_order' => 'integer',
        'enabled' => 'boolean',
    ];

    /**
     * Canonical default engine priority (lower priority_order = sooner).
     * 16-engine local-AI-first chain mirroring pycore tts_orchestrator
     * _DEFAULT_PRIORITY (chattts-first, azure-last). All seeded enabled=true.
     */
    public const DEFAULT_ENGINES = [
        ['engine' => 'chattts', 'priority_order' => 1],
        ['engine' => 'cosyvoice', 'priority_order' => 2],
        ['engine' => 'fishspeech', 'priority_order' => 3],
        ['engine' => 'qwen3tts', 'priority_order' => 4],
        ['engine' => 'bark', 'priority_order' => 5],
        ['engine' => 'parler', 'priority_order' => 6],
        ['engine' => 'voxcpm2', 'priority_order' => 7],
        ['engine' => 'kokoro', 'priority_order' => 8],
        ['engine' => 'gptsovits', 'priority_order' => 9],
        ['engine' => 'f5tts', 'priority_order' => 10],
        ['engine' => 'melotts', 'priority_order' => 11],
        ['engine' => 'sherpa', 'priority_order' => 12],
        ['engine' => 'edge', 'priority_order' => 13],
        ['engine' => 'streamelements', 'priority_order' => 14],
        ['engine' => 'gtts_web', 'priority_order' => 15],
        ['engine' => 'azure', 'priority_order' => 16],
    ];

    /**
     * Idempotent upsert of the canonical default engine rows via updateOrCreate.
     * Safe to re-run; never deletes operator-added engines, only inserts/updates
     * the defaults. priority_order is reconciled on every re-seed (so an existing
     * 7-row seed upgrades to the 16-engine order on next sys:init); enabled is
     * left untouched on existing rows (DB default true on insert), so an
     * operator-disabled engine is NOT re-enabled.
     *
     * @return array{seeded:int, updated:int}
     */
    public static function seedDefaults(): array
    {
        $seeded = 0;
        $updated = 0;
        try {
            foreach (self::DEFAULT_ENGINES as $def) {
                $row = self::updateOrCreate(
                    ['engine' => $def['engine']],
                    ['priority_order' => $def['priority_order']]
                );
                if ($row->wasRecentlyCreated) {
                    $seeded++;
                } elseif ($row->wasChanged('priority_order')) {
                    $updated++;
                }
            }
        } catch (\Throwable $e) {
            Log::warning('[AppQyV1TtsEngineConfig] seedDefaults failed: ' . $e->getMessage());
        }
        return ['seeded' => $seeded, 'updated' => $updated];
    }

    /**
     * Enabled engines ordered by priority_order ASC. Returns [] when the table
     * is missing/unreadable (caller falls back to pycore's live order).
     *
     * @return array<int,string>
     */
    public static function orderedPriority(): array
    {
        try {
            $rows = self::query()
                ->where('enabled', true)
                ->orderBy('priority_order')
                ->orderBy('engine')
                ->pluck('engine');
            $list = is_array($rows) ? $rows : $rows->all();
            return $list;
        } catch (\Throwable $e) {
            return [];
        }
    }

    // ------------------------------------------------------------------
    // Sentence-audio engine profile (qwen3tts-first, GPU)
    // ------------------------------------------------------------------

    /** Engine-profile name carried on sentence-audio claim tasks / assist requests. */
    public const SENTENCE_PROFILE = 'sentence';

    /**
     * Preferred sentence primary engine (GPU neural). This is a PREFERENCE label
     * only: pycore's orchestrator resolves the actual engine at synth time and is
     * GPU-gated — it falls back down the chain when qwen3tts is unavailable.
     * laravel never runs models and never forces this choice.
     */
    public const SENTENCE_PRIMARY_DEFAULT = 'qwen3tts';

    /**
     * Fallback sentence chain used when the engine-config table is missing/empty
     * (pre-migration). qwen3tts-first, cloud (azure) last — mirrors the
     * "sentence" priority_profile pycore's tts_orchestrator resolves.
     *
     * @var array<int,string>
     */
    public const SENTENCE_FALLBACK_CHAIN = ['qwen3tts', 'melotts', 'sherpa', 'edge', 'azure'];

    /**
     * Sentence-profile engine chain: the enabled engines ordered by priority with
     * the sentence primary (qwen3tts) hoisted to the front (sentence audio is
     * qwen3tts-first per SENTENCE_AUDIO_GENERATION_PIPELINE.md). Returns the
     * hardcoded SENTENCE_FALLBACK_CHAIN when the table is missing/empty.
     *
     * PREFERENCE ONLY — pycore makes the final, GPU-gated choice and falls back
     * when the primary is unavailable. qwen3tts is hoisted only when it is an
     * enabled engine here, so an operator who disables it is honored.
     *
     * @return array<int,string>
     */
    public static function sentenceEngineChain(): array
    {
        $ordered = self::orderedPriority();
        if ($ordered === []) {
            return self::SENTENCE_FALLBACK_CHAIN;
        }
        if (in_array(self::SENTENCE_PRIMARY_DEFAULT, $ordered, true)) {
            $ordered = array_values(array_filter(
                $ordered,
                static fn ($engine) => $engine !== self::SENTENCE_PRIMARY_DEFAULT
            ));
            array_unshift($ordered, self::SENTENCE_PRIMARY_DEFAULT);
        }
        return $ordered;
    }

    /**
     * Preferred sentence primary engine — the first entry of sentenceEngineChain()
     * (qwen3tts when enabled, else the first enabled engine, else the default).
     * A PREFERENCE only: pycore GPU-gates and falls back when it is unavailable.
     */
    public static function sentencePrimaryEngine(): string
    {
        $chain = self::sentenceEngineChain();
        return $chain[0] ?? self::SENTENCE_PRIMARY_DEFAULT;
    }
}
