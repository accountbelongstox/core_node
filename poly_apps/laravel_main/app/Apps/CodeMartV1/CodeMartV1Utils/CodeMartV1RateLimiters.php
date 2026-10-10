<?php

namespace App\Apps\CodeMartV1\CodeMartV1Utils;

use App\Apps\CodeMartV1\CodeMartV1Gvar\CodeMartV1Constants;
use App\Apps\CodeMartV1\CodeMartV1Services\CodeMartV1PolicyService;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Named rate limiters for the CodeMart routes. The attempts per window are
 * operator policy values, read on every request.
 */
class CodeMartV1RateLimiters
{
    public static function register(): void
    {
        foreach (CodeMartV1Constants::THROTTLE_LIMITERS as $name => [$policyKey, $_default, $decayMinutes, $perUser]) {
            RateLimiter::for($name, static function (Request $request) use ($policyKey, $decayMinutes, $perUser): Limit {
                $identity = $perUser ? ($request->user()?->getAuthIdentifier() ?? $request->ip()) : $request->ip();

                return Limit::perMinutes($decayMinutes, CodeMartV1PolicyService::int($policyKey))->by((string) $identity);
            });
        }
    }
}
