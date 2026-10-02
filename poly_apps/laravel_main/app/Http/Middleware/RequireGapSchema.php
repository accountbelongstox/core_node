<?php

namespace App\Http\Middleware;

use App\Support\SchemaGate;
use App\Traits\ApiResponse;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Alias `schema.gate`: routes that read or write the gap tables (work leases,
 * work nodes, word/sentence reports, delivery diff/batch, gap listings) answer
 * the contract schema_gate pause before touching them while the recorded
 * gap-schema revision differs from the one this code requires.
 */
class RequireGapSchema
{
    use ApiResponse;

    public function handle(Request $request, Closure $next): Response
    {
        $payload = [];
        $revision = [];

        if (SchemaGate::isReady()) {
            return $next($request);
        }
        $payload = SchemaGate::payload();
        $revision = $payload[SchemaGate::healthField() . '_revision'];

        return $this->retryLater(
            SchemaGate::errorCode(),
            __('api.messages.server_schema_pending', [
                'expected' => $revision['expected'],
                'actual' => $revision['actual'] ?? '-',
                'seconds' => SchemaGate::retryAfterSeconds(),
            ]),
            SchemaGate::httpStatus(),
            SchemaGate::retryAfterSeconds(),
            $payload
        );
    }
}
