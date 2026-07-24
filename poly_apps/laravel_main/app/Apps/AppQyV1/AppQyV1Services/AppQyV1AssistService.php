<?php

namespace App\Apps\AppQyV1\AppQyV1Services;

use App\Apps\AppQyV1\Services\AppQyV1VocabularyCoverService;
use App\Models\Book;
use App\Models\Subtitle;
use App\Services\MoviePoster\MoviePosterStore;

/**
 * Shared Queue Center read model and mcp-chrome media lease facade.
 *
 * mcp-chrome claims and submits covers and posters through this service.
 * Pycore translation, word-audio, and sentence-audio workers use their
 * dedicated queue endpoints so each resource has exactly one consumer path.
 */
class AppQyV1AssistService
{
    use AppQyV1AssistMediaOperations;
    use AppQyV1AssistQueueMetrics;
    use AppQyV1AssistOverview;
    use AppQyV1AssistQueueItems;

    public const LEASE_MINUTES = AppQyV1DictionaryTTSCoordinator::ASSIST_LEASE_MINUTES;

    private AppQyV1DictionaryTTSCoordinator $coordinator;
    private AppQyV1VocabularyCoverService $coverService;
    private MoviePosterStore $posterStore;

    public function __construct(
        ?AppQyV1DictionaryTTSCoordinator $coordinator = null,
        ?AppQyV1VocabularyCoverService $coverService = null,
        ?MoviePosterStore $posterStore = null
    ) {
        $this->coordinator = $coordinator ?: new AppQyV1DictionaryTTSCoordinator();
        $this->coverService = $coverService ?: new AppQyV1VocabularyCoverService();
        $this->posterStore = $posterStore ?: new MoviePosterStore();
    }

    private static function posterModelClass(string $mediaType): ?string
    {
        if ($mediaType === 'book') {
            return Book::class;
        }
        if ($mediaType === 'subtitle') {
            return Subtitle::class;
        }
        return null;
    }

    public static function isAssistEnabled(): bool
    {
        return (bool) env('APPQYV1_ASSIST_ENABLED', true);
    }
}
