<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Symfony\Component\HttpFoundation\Response;

/**
 * Selects the response language from Accept-Language for every request
 * (FrankenPHP/Octane workers are long-lived, so the locale is always set
 * explicitly and never carries over from a previous request).
 */
class ApplyRequestLocale
{
    /** Accept-Language primary tag => lang/ directory. */
    private const LOCALES = [
        'zh' => 'zh_CN',
        'en' => 'en',
    ];

    public function handle(Request $request, Closure $next): Response
    {
        $locale = (string) config('app.fallback_locale');
        $tag = '';

        foreach ($request->getLanguages() as $language) {
            $tag = strtolower(explode('_', str_replace('-', '_', (string) $language), 2)[0]);
            if (isset(self::LOCALES[$tag])) {
                $locale = self::LOCALES[$tag];
                break;
            }
        }
        App::setLocale($locale);

        return $next($request);
    }
}
