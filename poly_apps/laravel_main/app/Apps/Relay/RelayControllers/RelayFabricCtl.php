<?php

namespace App\Apps\Relay\RelayControllers;

use App\Apps\Relay\RelayExceptions\RelayDomainException;
use App\Apps\Relay\RelayServices\RelayFabricService;
use App\Apps\Relay\RelayServices\RelayOwnerResolver;
use App\Http\Controllers\Controller;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class RelayFabricCtl extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly RelayFabricService $fabric,
        private readonly RelayOwnerResolver $owners
    ) {
    }

    public function grant(Request $request): JsonResponse
    {
        $validated = $request->validate(['contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/']]);
        $startedAt = microtime(true);

        return $this->timed($this->success(
            $this->fabric->ownerGrant($this->owners->resolve($request), (string) $validated['contract_digest']),
            __('relay.success')
        ), $startedAt);
    }

    public function frames(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'operation_id' => ['required', 'uuid'],
            'pairing_id' => ['required', 'uuid'],
            'method' => ['required', 'string', 'max:16'],
            'path' => ['required', 'string', 'max:4096'],
            'query' => ['present', 'array'],
            'headers' => ['present', 'array'],
            'body' => ['required', 'array'],
            'body.present' => ['required', 'boolean'],
            'body.length' => ['required', 'integer', 'min:0'],
            'body.sha256' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'body.base64' => ['nullable', 'string'],
        ]);
        $startedAt = microtime(true);
        $result = $this->fabric->admitFrame($this->owners->resolve($request), $validated);

        return $this->timed($this->success($result['body'], __('relay.accepted'), (int) $result['status']), $startedAt);
    }

    public function telemetry(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'items' => ['required', 'array', 'max:200'],
            'items.*.operation_id' => ['required', 'uuid'],
            'items.*.route_policy' => ['nullable', 'string', 'max:64'],
            'items.*.lane' => ['nullable', 'string', 'max:16'],
            'items.*.http_status' => ['nullable', 'integer', 'between:0,999'],
            'items.*.outcome' => ['nullable', 'string', 'max:32'],
            'items.*.t_ui_send' => ['nullable', 'integer', 'min:0'],
            'items.*.t_ui_recv' => ['nullable', 'integer', 'min:0'],
            'items.*.dev_recv' => ['nullable', 'integer', 'min:0'],
            'items.*.dev_send' => ['nullable', 'integer', 'min:0'],
            'items.*.exec_ms' => ['nullable', 'integer', 'min:0'],
            'items.*.bytes_in' => ['nullable', 'integer', 'min:0'],
            'items.*.bytes_out' => ['nullable', 'integer', 'min:0'],
        ]);
        $userId = (int) $this->owners->resolve($request)->getAuthIdentifier();
        $items = array_map(static function (array $item): array {
            $item['t_dev_recv'] = $item['dev_recv'] ?? null;
            $item['t_dev_send'] = $item['dev_send'] ?? null;
            unset($item['dev_recv'], $item['dev_send']);

            return $item;
        }, $validated['items']);

        return $this->success(['accepted' => $this->fabric->recordTelemetry($userId, $items)], __('relay.accepted'), 202);
    }

    public function stats(Request $request): JsonResponse
    {
        $minutes = (int) $request->query('minutes', 15);
        $userId = (int) $this->owners->resolve($request)->getAuthIdentifier();

        return $this->success(['routes' => $this->fabric->stats($userId, $minutes)], __('relay.success'));
    }

    public function deviceHeartbeat(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'uuid'],
            'contract_digest' => ['required', 'regex:/^[a-f0-9]{64}$/'],
            'stream_connected' => ['required', 'boolean'],
            'active_requests' => ['sometimes', 'integer', 'min:0'],
            'grant_version' => ['nullable', 'string', 'max:32'],
        ]);
        $deviceId = (string) $request->attributes->get('relay_device_id', '');

        if ($deviceId === '' || !hash_equals($deviceId, (string) $validated['device_id'])) {
            throw new RelayDomainException('signature_device_invalid', 403);
        }

        return $this->success($this->fabric->deviceHeartbeat($deviceId, $validated), __('relay.success'));
    }

    private function timed(JsonResponse $response, float $startedAt): JsonResponse
    {
        $response->headers->set('Server-Timing', sprintf('fabric;dur=%.1f', (microtime(true) - $startedAt) * 1000));

        return $response;
    }
}
