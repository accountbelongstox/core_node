<?php

// AI editing rules for this file:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, migrate, or start
//    the server. Delivering the written code is the entire task.

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Models\AppQyV1AiPrompt;

/**
 * AppQyV1AiPromptDefaults
 * -------------------------------------------------------------------------
 * Code-owned prompt library defaults, re-synced idempotently at every sys:init
 * (AppQyV1Initializer's `seed_ai_prompts` step). Mirrors the
 * _NAMED_DEFAULTS-style pattern used for Laravel endpoint defaults: code is the
 * single source of truth for these rows (source='code'; template/response_schema
 * always overwritten from CODE_PROMPTS on every run), so editing a prompt here
 * is the supported way to change it. Operator-created rows (source='database')
 * are a completely separate set of prompt_key values and are never touched.
 *
 * Both preset prompts fan out through the `ai_prompt_requests` inbox
 * (AppQyV1AiPromptFanoutTask): insert one row with the source content, matching
 * prompt_keys resolve here, and each becomes one global_tasks row on the
 * declared task_type's lane.
 */
class AppQyV1AiPromptDefaults
{
    /**
     * Structured bilingual passage analysis: translates the passage to Chinese
     * AND English with sentence-by-sentence alignment, plus an English grammar
     * summary, liaison (connected-speech) notes, and a phrase list. Rides the
     * gemini_chat lane (pure text completion, no image/notebook semantics).
     *
     * The response_schema below is enforced ONLY by instruction (the prompt
     * text repeats it verbatim as the required output shape) — GeminiTextTaskProcessor
     * stores the model's raw text answer as-is; parsing/validating the JSON is
     * the reader's responsibility.
     */
    private const TRANSLATE_BILINGUAL_ANALYSIS_SCHEMA = [
        'type' => 'object',
        'properties' => [
            'sentence_pairs' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'source' => ['type' => 'string'],
                        'zh' => ['type' => 'string'],
                        'en' => ['type' => 'string'],
                    ],
                ],
            ],
            'grammar_summary' => ['type' => 'string'],
            'liaison_notes' => ['type' => 'array', 'items' => ['type' => 'string']],
            'phrases' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'phrase' => ['type' => 'string'],
                        'meaning' => ['type' => 'string'],
                    ],
                ],
            ],
        ],
        'required' => ['sentence_pairs', 'grammar_summary', 'liaison_notes', 'phrases'],
    ];

    /** The ONE canonical list of code-owned prompt defaults. */
    private const CODE_PROMPTS = [
        [
            'prompt_key' => 'translate_bilingual_analysis',
            'task_type' => 'gemini_chat',
            'title' => 'Bilingual translation + grammar analysis',
            'prompt_template' => <<<'PROMPT'
You are a bilingual (Chinese/English) language-learning assistant. Given the passage below, produce a structured analysis.

Passage:
{source_text}

Respond with ONLY a single valid JSON object -- no markdown code fences, no commentary before or after -- matching EXACTLY this shape:
{
  "sentence_pairs": [
    {"source": "<original sentence>", "zh": "<Chinese translation>", "en": "<English translation>"}
  ],
  "grammar_summary": "<a concise summary of the key English grammar points found in the English sentences above>",
  "liaison_notes": ["<an English phrase where connected speech/liaison occurs, with a short note on how the sounds link>"],
  "phrases": [
    {"phrase": "<a notable phrase or idiom from the passage>", "meaning": "<its meaning, in Chinese>"}
  ]
}

Rules:
- One entry in "sentence_pairs" per sentence of the passage, in original order.
- If the passage is already in English, "source" and "en" may be identical; still provide "zh".
- If the passage is already in Chinese, "source" and "zh" may be identical; still provide "en".
- "liaison_notes" and "phrases" may be empty arrays if none apply, but the key must always be present.
- Output valid JSON only -- no prose before or after the JSON object.
PROMPT,
            'response_schema' => self::TRANSLATE_BILINGUAL_ANALYSIS_SCHEMA,
        ],
        [
            'prompt_key' => 'notebooklm_dialogue',
            'task_type' => 'notebooklm',
            'title' => 'Generate a dialogue from words/sentences',
            'prompt_template' => <<<'PROMPT'
Given the following words or sentences, write a short, natural dialogue between two speakers that uses them in context. The dialogue should sound like everyday spoken conversation.

Words/sentences:
{source_text}

Respond with the dialogue only, formatted as alternating speaker lines (e.g. "A: ..." / "B: ...").
PROMPT,
            'response_schema' => null,
        ],
    ];

    /**
     * Idempotently upsert every code-owned prompt (source='code'). Never
     * touches source='database' rows -- upserts are keyed by prompt_key, and
     * these prompt_key values belong exclusively to this class.
     *
     * @return array{seeded:int,prompt_keys:array<int,string>}
     */
    public static function seed(): array
    {
        $keys = [];

        foreach (self::CODE_PROMPTS as $prompt) {
            AppQyV1AiPrompt::updateOrCreate(
                ['prompt_key' => $prompt['prompt_key']],
                [
                    'task_type' => $prompt['task_type'],
                    'source' => AppQyV1AiPrompt::SOURCE_CODE,
                    'title' => $prompt['title'],
                    'prompt_template' => $prompt['prompt_template'],
                    'response_schema' => $prompt['response_schema'],
                    'enabled' => true,
                ]
            );
            $keys[] = $prompt['prompt_key'];
        }

        return ['seeded' => count($keys), 'prompt_keys' => $keys];
    }

    /** True when every code-owned prompt_key already exists in the database. */
    public static function isSeeded(): bool
    {
        $expected = array_map(fn ($p) => $p['prompt_key'], self::CODE_PROMPTS);
        $found = AppQyV1AiPrompt::whereIn('prompt_key', $expected)
            ->where('source', AppQyV1AiPrompt::SOURCE_CODE)
            ->pluck('prompt_key')
            ->all();

        return count(array_intersect($expected, $found)) === count($expected);
    }
}
