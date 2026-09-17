<?php

namespace App\Http\Middleware;

use App\Traits\ApiResponse;
use App\Utils\CloudClipboardService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class CloudClipboardReady
{
    use ApiResponse;

    public function __construct(private CloudClipboardService $clipboard)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $missing = $this->clipboard->missingTables();

        if ($missing !== []) {
            return $this->codedError('CLOUD_CLIPBOARD_NOT_INITIALIZED',
                __('cloud_clipboard.not_initialized'), ['missing_tables' => $missing], 503)
                ->header('Cache-Control', 'no-store, private')
                ->header('Retry-After', '30');
        }

        return $next($request);
    }
}
