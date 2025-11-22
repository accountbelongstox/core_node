<?php

namespace App\CallPycoreUtils;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class PycoreHttpClient
{
    private const BASE_URL = 'http://127.0.0.1:59000';
    private const DEFAULT_TIMEOUT = 60;
    private const POLL_INTERVAL = 1;
    private const MAX_POLL_ATTEMPTS = 120;
    
    public static function callDirect(
        string $endpoint,
        array $params = [],
        int $timeout = self::DEFAULT_TIMEOUT
    ): array {
        try {
            $response = Http::timeout($timeout)
                ->post(self::BASE_URL . $endpoint, $params);
            
            if (!$response->successful()) {
                Log::error('[PycoreHttpClient] Direct call failed', [
                    'endpoint' => $endpoint,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                
                return [
                    'error' => 'Direct call failed',
                    'status' => $response->status(),
                    'message' => $response->body(),
                ];
            }
            
            return $response->json();
            
        } catch (\Exception $e) {
            Log::error('[PycoreHttpClient] Direct call exception', [
                'endpoint' => $endpoint,
                'error' => $e->getMessage(),
            ]);
            
            return [
                'error' => 'HTTP request failed',
                'message' => $e->getMessage(),
            ];
        }
    }
    
    public static function call(
        string $route,
        array $params = [],
        int $timeout = self::DEFAULT_TIMEOUT,
        bool $async = false
    ): array {
        try {
            $response = Http::timeout($timeout + 5)
                ->post(self::BASE_URL . '/rpc/' . $route, $params);
            
            if (!$response->successful()) {
                Log::error('[PycoreHttpClient] RPC call failed', [
                    'route' => $route,
                    'status' => $response->status(),
                    'body' => $response->body(),
                ]);
                
                return [
                    'error' => 'RPC call failed',
                    'status' => $response->status(),
                    'message' => $response->body(),
                ];
            }
            
            $result = $response->json();
            
            if (!isset($result['id'])) {
                return [
                    'error' => 'Invalid RPC response',
                    'response' => $result,
                ];
            }
            
            if (isset($result['sync_response']) && $result['sync_response'] === true) {
                if (isset($result['error']) && $result['error'] !== null) {
                    return [
                        'error' => $result['error'],
                        'details' => $result,
                    ];
                }
                
                return [
                    'success' => true,
                    'result' => $result['result'] ?? null,
                    'request_id' => $result['id'],
                ];
            }
            
            $requestId = $result['id'];
            
            if ($async) {
                return [
                    'success' => true,
                    'request_id' => $requestId,
                    'status' => $result['status'] ?? 'accepted',
                ];
            }
            
            return self::pollResult($requestId, $route, $timeout);
            
        } catch (\Exception $e) {
            Log::error('[PycoreHttpClient] Exception', [
                'route' => $route,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
            
            return [
                'error' => 'HTTP request failed',
                'message' => $e->getMessage(),
            ];
        }
    }
    
    private static function pollResult(string $requestId, string $route, int $timeout): array
    {
        $maxAttempts = min(self::MAX_POLL_ATTEMPTS, $timeout);
        $startTime = time();
        
        for ($attempt = 0; $attempt < $maxAttempts; $attempt++) {
            if ($attempt > 0) {
                sleep(self::POLL_INTERVAL);
            }
            
            if (time() - $startTime > $timeout) {
                return [
                    'error' => 'Timeout waiting for result',
                    'request_id' => $requestId,
                    'elapsed' => time() - $startTime,
                ];
            }
            
            try {
                $queryResponse = Http::timeout(5)
                    ->get(self::BASE_URL . '/rpc/query/' . $requestId);
                
                if (!$queryResponse->successful()) {
                    continue;
                }
                
                $queryResult = $queryResponse->json();
                $status = $queryResult['status'] ?? 'unknown';
                
                if ($status === 'completed') {
                    return [
                        'success' => true,
                        'result' => $queryResult['result'] ?? null,
                        'request_id' => $requestId,
                        'elapsed' => time() - $startTime,
                    ];
                } elseif ($status === 'failed') {
                    return [
                        'error' => 'RPC execution failed',
                        'message' => $queryResult['error'] ?? 'Unknown error',
                        'request_id' => $requestId,
                        'details' => $queryResult,
                        'elapsed' => time() - $startTime,
                    ];
                }
                
            } catch (\Exception $e) {
                Log::warning('[PycoreHttpClient] Poll attempt failed', [
                    'request_id' => $requestId,
                    'attempt' => $attempt,
                    'error' => $e->getMessage(),
                ]);
                continue;
            }
        }
        
        return [
            'error' => 'Timeout: result not ready after maximum attempts',
            'request_id' => $requestId,
            'attempts' => $maxAttempts,
            'elapsed' => time() - $startTime,
        ];
    }
    
    public static function queryResult(string $requestId): array
    {
        try {
            $response = Http::timeout(5)
                ->get(self::BASE_URL . '/rpc/query/' . $requestId);
            
            if (!$response->successful()) {
                return [
                    'error' => 'Query failed',
                    'status' => $response->status(),
                ];
            }
            
            return $response->json();
            
        } catch (\Exception $e) {
            return [
                'error' => 'Query request failed',
                'message' => $e->getMessage(),
            ];
        }
    }
}
