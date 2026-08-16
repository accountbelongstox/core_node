<?php

namespace App\Apps\AppQyV1\AppQyV1Models;

/**
 * DB-driven TTS engine priority config (app_qy_v1_tts_engine_config).
 *
 * Canonical engine priority order for the TTS orchestrator + the Queue Center
 * drawer. Seeded idempotently at sys:init and required by the runtime.
 */
class AppQyV1TtsEngineConfigModel extends AppQyV1Model
{
    protected ?string $appTableSuffix = 'tts_engine_config';

    protected $fillable = [
        'engine',
        'priority_order',
        'enabled',
    ];

    protected function casts(): array
    {
        return [
            'priority_order' => 'integer',
            'enabled' => 'boolean',
        ];
    }

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
        $engines = array_column(self::DEFAULT_ENGINES, 'engine');
        $existing = self::query()
            ->whereIn('engine', $engines)
            ->get(['engine', 'priority_order'])
            ->keyBy('engine');

        foreach (self::DEFAULT_ENGINES as $definition) {
            $row = $existing->get($definition['engine']);
            if ($row === null) {
                $seeded++;
            } elseif ((int) $row->priority_order !== $definition['priority_order']) {
                $updated++;
            }
        }

        self::query()->upsert(
            self::DEFAULT_ENGINES,
            ['engine'],
            ['priority_order']
        );

        return ['seeded' => $seeded, 'updated' => $updated];
    }

    /**
     * Enabled engines ordered by priority_order ASC.
     *
     * @return array<int,string>
     */
    public static function orderedPriority(): array
    {
        return self::query()
            ->where('enabled', true)
            ->orderBy('priority_order')
            ->orderBy('engine')
            ->pluck('engine')
            ->all();
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
     * Sentence-profile engine chain: the enabled engines ordered by priority with
     * the sentence primary (qwen3tts) hoisted to the front (sentence audio is
     * qwen3tts-first per SENTENCE_AUDIO_GENERATION_PIPELINE.md).
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
            throw new \RuntimeException('No enabled TTS engines are configured.');
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
     * (qwen3tts when enabled, else the first enabled engine).
     * A PREFERENCE only: pycore GPU-gates and falls back when it is unavailable.
     */
    public static function sentencePrimaryEngine(): string
    {
        return self::sentenceEngineChain()[0];
    }
}
