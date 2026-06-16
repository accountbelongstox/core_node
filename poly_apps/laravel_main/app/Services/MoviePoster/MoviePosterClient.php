<?php

namespace App\Services\MoviePoster;

use App\Services\AiGateway\AiSecretLoader;
use App\Apps\AppQyV1\Utils\AppQyV1AITools\AppQyV1TranslationService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Movie/TV Poster Client (PHP, secondary fetcher).
 *
 * Canonical contract: development-guides/MOVIE_POSTER_PIPELINE.md.
 *
 * pycore is the primary fetcher (runs at ingest/extract time and ships poster
 * bytes to laravel). This PHP client is the on-demand backfill: given a media
 * title (+ optional year), it queries TMDB then OMDB, downloads the poster
 * bytes, and returns a normalized poster result. When the title is Chinese (or
 * any non-Latin script) it is translated to English first, because the movie
 * databases index by English / original titles.
 *
 * NEVER throws — every failure path returns null and logs. The caller (the
 * on-demand fetch controller) decides the lifecycle (ready / none).
 */
class MoviePosterClient
{
    private const TMDB_SEARCH_URL = 'https://api.themoviedb.org/3/search/multi';
    private const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w780';
    private const OMDB_URL = 'https://www.omdbapi.com/';

    private const HTTP_TIMEOUT = 12;
    private const DOWNLOAD_TIMEOUT = 20;

    private ?AppQyV1TranslationService $translator;

    public function __construct(?AppQyV1TranslationService $translator = null)
    {
        $this->translator = $translator;
    }

    /**
     * Fetch a poster for a media title.
     *
     * @return array{provider:string,source_id:string,binary:string,mime:string,meta:array}|null
     */
    public function fetchForTitle(string $title, ?int $year = null, string $lang = 'en'): ?array
    {
        $title = trim($title);
        if ($title === '') {
            return null;
        }

        // Movie DBs index by English / original titles. Translate a non-Latin
        // (e.g. CJK) title to English first; keep the original around for OMDB
        // exact-title fallback.
        $queryTitle = $title;
        if ($this->isNonLatin($title)) {
            $translated = $this->translateToEnglish($title);
            if ($translated !== null && $translated !== '') {
                $queryTitle = $translated;
            }
        }

        $tmdb = $this->fetchFromTmdb($queryTitle, $year, $lang);
        if ($tmdb !== null) {
            return $tmdb;
        }

        $omdb = $this->fetchFromOmdb($queryTitle, $year);
        if ($omdb !== null) {
            return $omdb;
        }

        return null;
    }

    /**
     * TMDB search/multi -> first result with a non-null poster_path
     * (preferring movie/tv media types) -> download w780 poster bytes.
     */
    private function fetchFromTmdb(string $title, ?int $year, string $lang): ?array
    {
        $bearer = trim(AiSecretLoader::getIndexed('TMDB_API_READ_ACCESS_TOKEN'));
        $apiKey = trim(AiSecretLoader::getIndexed('TMDB_API_KEY'));

        if ($bearer === '' && $apiKey === '') {
            return null;
        }

        $query = [
            'query' => $title,
            'language' => $lang !== '' ? $lang : 'en',
        ];
        if ($year !== null && $year > 0) {
            $query['year'] = $year;
        }
        if ($bearer === '') {
            $query['api_key'] = $apiKey;
        }

        try {
            $request = Http::timeout(self::HTTP_TIMEOUT)->acceptJson();
            if ($bearer !== '') {
                $request = $request->withToken($bearer);
            }
            $response = $request->get(self::TMDB_SEARCH_URL, $query);
        } catch (\Throwable $e) {
            Log::warning('[MoviePoster] TMDB search failed', ['title' => $title, 'error' => $e->getMessage()]);
            return null;
        }

        if (!$response->successful()) {
            Log::info('[MoviePoster] TMDB search non-200', ['title' => $title, 'status' => $response->status()]);
            return null;
        }

        $results = (array) ($response->json('results') ?? []);
        $chosen = $this->pickTmdbResult($results);
        if ($chosen === null) {
            return null;
        }

        $posterPath = (string) ($chosen['poster_path'] ?? '');
        if ($posterPath === '') {
            return null;
        }

        $imageUrl = self::TMDB_IMAGE_BASE . $posterPath;
        $binary = $this->downloadBytes($imageUrl);
        if ($binary === null) {
            return null;
        }

        $mediaType = (string) ($chosen['media_type'] ?? 'movie');
        $tmdbId = (string) ($chosen['id'] ?? '');
        $resolvedTitle = (string) ($chosen['title'] ?? $chosen['name'] ?? $title);
        $originalTitle = (string) ($chosen['original_title'] ?? $chosen['original_name'] ?? '');
        $releaseDate = (string) ($chosen['release_date'] ?? $chosen['first_air_date'] ?? '');
        $resolvedYear = $this->yearFromDate($releaseDate);

        return [
            'provider' => 'tmdb',
            'source_id' => 'tmdb:' . $mediaType . ':' . $tmdbId,
            'binary' => $binary,
            'mime' => $this->mimeFromBytes($binary, 'image/jpeg'),
            'meta' => [
                'title' => $resolvedTitle,
                'original_title' => $originalTitle,
                'year' => $resolvedYear !== null ? $resolvedYear : $year,
                'overview' => (string) ($chosen['overview'] ?? ''),
                'poster_url' => $imageUrl,
            ],
        ];
    }

    /**
     * OMDB ?apikey=&t=&y= -> Poster URL (skip "N/A") -> download bytes.
     */
    private function fetchFromOmdb(string $title, ?int $year): ?array
    {
        $apiKey = trim(AiSecretLoader::getIndexed('OMDB_API_KEY'));
        if ($apiKey === '') {
            return null;
        }

        $query = [
            'apikey' => $apiKey,
            't' => $title,
        ];
        if ($year !== null && $year > 0) {
            $query['y'] = $year;
        }

        try {
            $response = Http::timeout(self::HTTP_TIMEOUT)->acceptJson()->get(self::OMDB_URL, $query);
        } catch (\Throwable $e) {
            Log::warning('[MoviePoster] OMDB lookup failed', ['title' => $title, 'error' => $e->getMessage()]);
            return null;
        }

        if (!$response->successful()) {
            return null;
        }

        $data = (array) ($response->json() ?? []);
        if (($data['Response'] ?? 'False') !== 'True') {
            return null;
        }

        $posterUrl = (string) ($data['Poster'] ?? '');
        if ($posterUrl === '' || strtoupper($posterUrl) === 'N/A') {
            return null;
        }

        $binary = $this->downloadBytes($posterUrl);
        if ($binary === null) {
            return null;
        }

        $imdbId = (string) ($data['imdbID'] ?? '');

        return [
            'provider' => 'omdb',
            'source_id' => $imdbId !== '' ? ('imdb:' . $imdbId) : 'imdb:unknown',
            'binary' => $binary,
            'mime' => $this->mimeFromBytes($binary, 'image/jpeg'),
            'meta' => [
                'title' => (string) ($data['Title'] ?? $title),
                'original_title' => (string) ($data['Title'] ?? ''),
                'year' => $this->yearFromDate((string) ($data['Year'] ?? '')) ?? $year,
                'overview' => (string) ($data['Plot'] ?? ''),
                'poster_url' => $posterUrl,
            ],
        ];
    }

    /**
     * Pick the first result carrying a non-null poster_path, preferring
     * media_type movie/tv over person/other.
     */
    private function pickTmdbResult(array $results): ?array
    {
        $fallback = null;
        foreach ($results as $result) {
            if (!is_array($result)) {
                continue;
            }
            $posterPath = $result['poster_path'] ?? null;
            if ($posterPath === null || $posterPath === '') {
                continue;
            }
            $mediaType = (string) ($result['media_type'] ?? '');
            if ($mediaType === 'movie' || $mediaType === 'tv') {
                return $result;
            }
            if ($fallback === null) {
                $fallback = $result;
            }
        }
        return $fallback;
    }

    /**
     * Download image bytes. Returns null on any failure / empty body.
     */
    private function downloadBytes(string $url): ?string
    {
        try {
            $response = Http::timeout(self::DOWNLOAD_TIMEOUT)->get($url);
        } catch (\Throwable $e) {
            Log::warning('[MoviePoster] Poster download failed', ['url' => $url, 'error' => $e->getMessage()]);
            return null;
        }

        if (!$response->successful()) {
            return null;
        }

        $body = $response->body();
        if ($body === '' || strlen($body) < 12) {
            return null;
        }

        return $body;
    }

    /**
     * Translate a non-Latin title to English. Prefers the translation service's
     * robust multi-provider fallback (ends in the free pycore Google path), so a
     * translation completes even when direct LLM keys are down. Returns null on
     * any failure.
     */
    private function translateToEnglish(string $title): ?string
    {
        try {
            $translator = $this->translator ?? app(AppQyV1TranslationService::class);
            $result = $translator->translateWithFallback($title, 'en', 'general');
        } catch (\Throwable $e) {
            Log::info('[MoviePoster] Title translation failed', ['title' => $title, 'error' => $e->getMessage()]);
            return null;
        }

        if (is_array($result) && ($result['success'] ?? false) === true) {
            $translation = trim((string) ($result['translation'] ?? ''));
            if ($translation !== '') {
                return $translation;
            }
        }

        return null;
    }

    /**
     * Detect whether a string contains non-Latin (e.g. CJK) letters — a signal
     * to translate before querying the movie DBs. Any Han / Hiragana / Katakana
     * / Hangul codepoint triggers translation.
     */
    private function isNonLatin(string $text): bool
    {
        return (bool) preg_match('/[\x{3040}-\x{30FF}\x{3400}-\x{4DBF}\x{4E00}-\x{9FFF}\x{AC00}-\x{D7AF}\x{F900}-\x{FAFF}]/u', $text);
    }

    /**
     * Extract a 4-digit year from a date / year string (e.g. "1999-03-31",
     * "1999", "1999–2003"). Returns null when none found.
     */
    private function yearFromDate(string $value): ?int
    {
        if ($value === '') {
            return null;
        }
        if (preg_match('/(\d{4})/', $value, $m)) {
            return (int) $m[1];
        }
        return null;
    }

    /**
     * Resolve a MIME type from image magic bytes. Falls back to $default.
     */
    private function mimeFromBytes(string $bytes, string $default): string
    {
        if (str_starts_with($bytes, "\x89PNG\r\n\x1a\n")) {
            return 'image/png';
        }
        if (str_starts_with($bytes, "\xFF\xD8\xFF")) {
            return 'image/jpeg';
        }
        if (str_starts_with($bytes, 'RIFF') && substr($bytes, 8, 4) === 'WEBP') {
            return 'image/webp';
        }
        if (str_starts_with($bytes, 'GIF87a') || str_starts_with($bytes, 'GIF89a')) {
            return 'image/gif';
        }
        return $default;
    }
}
