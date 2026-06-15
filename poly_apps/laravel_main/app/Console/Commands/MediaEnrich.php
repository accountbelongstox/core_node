<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Services\SentenceEnrichmentService;

/**
 * media:enrich
 *
 * On-demand, idempotent AI + TTS enrichment pass over the shared sentence
 * library (app_qy_v1_sentences). Fills empty AI fields (explanation, grammar,
 * ai_commentary, special_usage) via the LLM fallback chain and generates
 * per-sentence TTS audio. Fill-missing only; a fully-enriched row is skipped.
 *
 * Usage:
 *   php artisan media:enrich --limit=50 --lang=english
 */
class MediaEnrich extends Command
{
    protected $signature = 'media:enrich {--limit=50 : Max rows to process this batch} {--lang= : Optional language filter (e.g. english)}';

    protected $description = 'Idempotently enrich shared sentences with AI fields + TTS audio (fill-missing only)';

    public function handle(SentenceEnrichmentService $service): int
    {
        $limit = (int) $this->option('limit');
        if ($limit < 1) {
            $limit = 50;
        }

        $lang = $this->option('lang');
        $language = ($lang !== null && $lang !== '') ? (string) $lang : null;

        $this->info('Sentence enrichment pass starting...');
        $this->line('  Limit: ' . $limit);
        $this->line('  Language: ' . ($language ?? 'all'));
        $this->newLine();

        $result = $service->enrich($limit, $language);

        $this->info('Enrichment complete:');
        $this->line('  Processed: ' . ($result['processed'] ?? 0));
        $this->line('  Enriched:  ' . ($result['enriched'] ?? 0));
        $this->line('  Remaining: ' . ($result['remaining'] ?? 0));

        $errors = $result['errors'] ?? [];
        if (!empty($errors)) {
            $this->newLine();
            $this->warn('Errors (' . count($errors) . '):');
            foreach ($errors as $error) {
                $this->line('  - ' . ($error['sentence_id'] ?? '?') . ': ' . ($error['error'] ?? 'unknown'));
            }
        }

        return self::SUCCESS;
    }
}
