<?php
// ### AI SPECIAL ATTENTION RULES START ###
// When AI/ALL DEVELOPERS sees this prompt, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Declare all variables at the beginning of the file.
// 6. For PowerShell (*.ps1) scripts: Do not append strings directly to variables, Do not use relative paths such as "..\.."; instead resolve absolute paths using parent path parsing (Split-Path, Join-Path, or Resolve-Path).
// 7. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED
// ### AI SPECIAL ATTENTION RULES END ###

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

/**
 * Broadcast: a single word's translation was persisted (KEY coordination signal).
 *
 * Phase-C broadcast contract event `word.translated` on the public
 * `translation-queue` channel. Fired once per word as the write-back commits it.
 * This is the multi-worker coordination signal: when one worker (or the Laravel
 * self-filler) finishes a word, every other pycore worker hears it and can SKIP
 * that word instead of re-translating it ("one finished -> others skip"). The
 * dictionary row remains the source of truth; this just spreads the news fast.
 *
 * Payload: { word, language, target_language, translation, provider }
 */
class WordTranslatedEvent implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets, SerializesModels;

    public string $word;
    public string $language;
    public string $targetLanguage;
    public string $translation;
    public string $provider;

    public function __construct(
        string $word,
        string $language,
        string $targetLanguage,
        string $translation,
        string $provider
    ) {
        $this->word = $word;
        $this->language = $language;
        $this->targetLanguage = $targetLanguage;
        $this->translation = $translation;
        $this->provider = $provider;
    }

    public function broadcastOn(): Channel
    {
        return new Channel('translation-queue');
    }

    public function broadcastAs(): string
    {
        return 'word.translated';
    }

    public function broadcastWith(): array
    {
        return [
            'word' => $this->word,
            'language' => $this->language,
            'target_language' => $this->targetLanguage,
            'translation' => $this->translation,
            'provider' => $this->provider,
        ];
    }
}
