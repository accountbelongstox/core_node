<?php

namespace App\Http\Middleware;

use App\Support\ServiceContract;
use Closure;
use Illuminate\Http\Middleware\HandleCors as FrameworkHandleCors;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Framework CORS plus per-request private origins and Private Network Access:
 * a loopback/LAN/mesh-address Origin on any port (ServiceContract::isPrivateCorsOrigin)
 * is echoed exactly like a configured origin, and a preflight carrying
 * Access-Control-Request-Private-Network from an allowed origin is answered
 * with Access-Control-Allow-Private-Network: true.
 */
class HandleCors extends FrameworkHandleCors
{
    public function handle($request, Closure $next)
    {
        $options = [];
        $response = null;

        foreach (static::$skipCallbacks as $callback) {
            if ($callback($request)) {
                return $next($request);
            }
        }

        if (! $this->hasMatchingPath($request)) {
            return $next($request);
        }

        $options = $this->container['config']->get('cors', []);
        $origin = (string) $request->headers->get('Origin', '');
        if ($origin !== '' && ServiceContract::isPrivateCorsOrigin($origin)) {
            $options['allowed_origins'] = array_values(array_unique(array_merge(
                $options['allowed_origins'] ?? [],
                [$origin],
            )));
        }
        $this->cors->setOptions($options);

        if ($this->cors->isPreflightRequest($request)) {
            $response = $this->cors->handlePreflightRequest($request);
            $this->cors->varyHeader($response, 'Access-Control-Request-Method');

            return $this->allowPrivateNetwork($response, $request);
        }

        $response = $next($request);

        if ($request->getMethod() === 'OPTIONS') {
            $this->cors->varyHeader($response, 'Access-Control-Request-Method');
        }

        return $this->cors->addActualRequestHeaders($response, $request);
    }

    private function allowPrivateNetwork(Response $response, Request $request): Response
    {
        $requestHeader = ServiceContract::string('access.cors.private_network_request_header');

        if (strtolower((string) $request->headers->get($requestHeader, '')) === 'true'
            && $this->cors->isOriginAllowed($request)) {
            $response->headers->set(ServiceContract::string('access.cors.private_network_allow_header'), 'true');
            $this->cors->varyHeader($response, $requestHeader);
        }

        return $response;
    }
}
