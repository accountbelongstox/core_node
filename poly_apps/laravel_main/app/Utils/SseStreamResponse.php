<?php

namespace App\Utils;

use Closure;
use Symfony\Component\HttpFoundation\StreamedResponse;

final class SseStreamResponse
{
    private const HEADERS = [
        'X-Accel-Buffering' => 'no',
        'Cache-Control' => 'no-cache, no-transform',
        'Connection' => 'keep-alive',
    ];

    private function __construct()
    {
    }

    public static function make(Closure $callback): StreamedResponse
    {
        return response()->eventStream($callback, self::HEADERS, null);
    }
}
