<?php

// AI editing rules for this file:
// 1. Write all code in English only.
// 2. After writing code, STOP - do NOT compile, run, test, migrate, or start
//    the server. Delivering the written code is the entire task.

namespace App\Apps\AppQyV1\Utils\AppQyV1SystemInit;

use App\Apps\AppQyV1\AppQyV1Models\AppQyV1AiPromptModel as AppQyV1AiPrompt;

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
 * Preset prompts fan out through the `ai_prompt_requests` inbox
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

    /** Prompt key of the phrase pipeline extraction (audio_orchestration_contract phrase_pipeline.extraction.prompt_key). */
    public const SENTENCE_PHRASE_EXTRACTION = 'sentence_phrase_extraction';

    /** Prompts run only by their own pipeline; never part of a request's default fan-out set. */
    public const PIPELINE_PROMPT_KEYS = [self::SENTENCE_PHRASE_EXTRACTION];

    /**
     * Phrase extraction answer (docs_fix/DESIGN_PHRASE_PIPELINE.md §4): one item
     * per input line number, each with its multi-word phrases (may be empty).
     */
    private const SENTENCE_PHRASE_EXTRACTION_SCHEMA = [
        'type' => 'object',
        'properties' => [
            'items' => [
                'type' => 'array',
                'items' => [
                    'type' => 'object',
                    'properties' => [
                        'n' => ['type' => 'integer'],
                        'phrases' => [
                            'type' => 'array',
                            'items' => [
                                'type' => 'object',
                                'properties' => [
                                    'text' => ['type' => 'string'],
                                    'meaning' => ['type' => 'string'],
                                ],
                                'required' => ['text', 'meaning'],
                            ],
                        ],
                    ],
                    'required' => ['n', 'phrases'],
                ],
            ],
        ],
        'required' => ['items'],
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
            'prompt_key' => 'short_article_generation',
            'task_type' => 'gemini_chat',
            'title' => 'Generate a short article',
            'prompt_template' => <<<'PROMPT'
Write a coherent short article that naturally uses the source words, sentences, or topic below.

Source:
{source_text}

Target language: {target_language}

Rules:
- Use the target language when provided; otherwise use the source language.
- Keep the article between 120 and 220 words unless the source explicitly requests another length.
- Include a concise title followed by the article body.
- Preserve the intended meanings of supplied words or sentences.
- Return the title and article only, without analysis or markdown code fences.
PROMPT,
            'response_schema' => null,
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
        [
            'prompt_key' => self::SENTENCE_PHRASE_EXTRACTION,
            'task_type' => 'phrase_extract',
            'title' => 'Extract multi-word phrases from sentences',
            'prompt_template' => <<<'PROMPT'
You are a language-learning assistant. Extract the useful multi-word expressions from each {language} sentence below so a learner can study them as units.

Sentences (one per line, "<n><TAB><sentence>"):
{sentences}

Respond with ONLY a single valid JSON object -- no markdown code fences, no commentary before or after -- matching EXACTLY this shape:
{"items":[{"n":1,"phrases":[{"text":"<phrase copied from sentence n>","meaning":"<short meaning in {meaning_language}>"}]}]}

Rules:
- One entry in "items" per input line, using the same "n"; keep input order.
- Each "text" is a multi-word expression: phrasal verb, collocation, idiom or fixed chunk (e.g. "give up", "make a decision", "in front of", "by the way").
- Copy "text" verbatim from the sentence (same words and word order, same inflection as written); never paraphrase, translate or add words.
- At least 2 words and at most {max_words} words per phrase; never return a single word.
- At most {max_phrases} phrases per sentence, the most useful first; no duplicates within a sentence.
- Skip proper names, numbers and plain word sequences that are not a fixed expression.
- "meaning" is a short gloss of the phrase as used in the sentence, written in {meaning_language}.
- When a sentence has no such expression, return "phrases": [] for it.
- Output valid JSON only -- no prose before or after the JSON object.
PROMPT,
            'response_schema' => self::SENTENCE_PHRASE_EXTRACTION_SCHEMA,
        ],
    ];

    /**
     * One code-owned prompt default by key (template + response_schema), or
     * null; lets a caller run a code prompt before its row is seeded.
     *
     * @return array{prompt_key:string,task_type:string,title:string,prompt_template:string,response_schema:?array}|null
     */
    public static function codePrompt(string $promptKey): ?array
    {
        foreach (self::CODE_PROMPTS as $prompt) {
            if ($prompt['prompt_key'] === $promptKey) {
                return $prompt;
            }
        }

        return null;
    }

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
            AppQyV1AiPrompt::storeDefault(
                $prompt['prompt_key'],
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

    /** True when every code-owned row exists and still matches its code default. */
    public static function isSeeded(): bool
    {
        $expected = array_map(fn ($p) => $p['prompt_key'], self::CODE_PROMPTS);
        $rows = AppQyV1AiPrompt::rowsByKeys($expected)
            ->keyBy('prompt_key');

        foreach (self::CODE_PROMPTS as $prompt) {
            $row = $rows->get($prompt['prompt_key']);
            if (!$row
                || $row->source !== AppQyV1AiPrompt::SOURCE_CODE
                || $row->task_type !== $prompt['task_type']
                || $row->title !== $prompt['title']
                || $row->prompt_template !== $prompt['prompt_template']
                || (bool) $row->enabled !== true
                || json_encode($row->response_schema) !== json_encode($prompt['response_schema'])) {
                return false;
            }
        }

        return true;
    }
}
