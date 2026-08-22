<?php

namespace App\Http\Middleware;

use App\Support\ServiceContract;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

final class SendFrankenPhpEarlyHints
{
    public function handle(Request $request, Closure $next): Response
    {
        $link = ServiceContract::string('http.ui_early_hints_link');

        if ($this->shouldSend($request, $link)) {
            header("Link: {$link}", false);
            headers_send(103);
        }

        return $next($request);
    }

    private function shouldSend(Request $request, string $link): bool
    {
        return $link !== ''
            && $request->isMethod('GET')
            && $request->accepts('text/html')
            && function_exists('headers_send');
    }
}
