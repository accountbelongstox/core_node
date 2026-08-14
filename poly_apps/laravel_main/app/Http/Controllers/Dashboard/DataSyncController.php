<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Services\DataSync\DataSyncService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

final class DataSyncController extends Controller
{
    use ApiResponse;

    public function __construct(private readonly DataSyncService $service) {}

    public function index(): JsonResponse
    {
        return $this->success(['sessions' => $this->service->list()]);
    }

    public function show(string $id): JsonResponse
    {
        $job = $this->service->get($id);
        return $job === null
            ? $this->notFound('Data synchronization session was not found.')
            : $this->success(['session' => $job]);
    }

    public function start(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'target' => 'nullable|string|max:512',
            'databases' => 'required|boolean',
            'resources' => 'required|boolean',
            'compression' => 'required|boolean',
        ]);
        $job = $this->service->start(
            (string) ($validated['target'] ?? ''),
            (bool) $validated['databases'],
            (bool) $validated['resources'],
            (bool) $validated['compression']
        );

        return $this->created(['session' => $job], 'Data synchronization session created.');
    }

    public function setTarget(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'target' => 'required|string|max:512',
        ]);

        return $this->success(
            ['session' => $this->service->setTarget($id, (string) $validated['target'])],
            'Synchronization target accepted.'
        );
    }

    public function pause(string $id): JsonResponse
    {
        return $this->success(['session' => $this->service->pause($id)], 'Data synchronization paused.');
    }

    public function resume(string $id): JsonResponse
    {
        return $this->success(['session' => $this->service->resume($id)], 'Data synchronization resumed.');
    }

    public function peerHealth(): JsonResponse
    {
        return $this->success($this->service->health());
    }

    public function peerPrepare(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'source_job_id' => 'required|string|size:32|regex:/^[a-f0-9]{32}$/',
            'prepare_token' => 'required|string|size:64|regex:/^[a-f0-9]{64}$/',
            'options' => 'required|array',
            'options.databases' => 'required|boolean',
            'options.resources' => 'required|boolean',
            'options.compression' => 'required|boolean',
        ]);

        return $this->created(
            $this->service->prepareReceiver(
                (string) $validated['source_job_id'],
                (string) $validated['prepare_token'],
                $validated['options'],
                $request->ip()
            ),
            'Receiver synchronization session created.'
        );
    }

    public function peerStatus(Request $request, string $id): JsonResponse
    {
        return $this->success($this->service->receiverStatus($id, $this->token($request)));
    }

    public function peerResourceManifest(Request $request, string $id, string $key): JsonResponse
    {
        return $this->success($this->service->receiverResourceManifest($id, $this->token($request), $key));
    }

    public function peerDatabaseInventory(Request $request, string $id): JsonResponse
    {
        return $this->success($this->service->receiverDatabaseInventory($id, $this->token($request)));
    }

    public function peerDatabaseChunk(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'connection' => 'required|string|max:128',
            'table' => 'required|string|max:128',
            'rows' => 'required|array',
        ]);

        return $this->success($this->service->receiveDatabaseChunk(
            $id,
            $this->token($request),
            (string) $validated['connection'],
            (string) $validated['table'],
            $validated['rows']
        ));
    }

    public function peerDatabaseSequence(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'connection' => 'required|string|max:128',
            'table' => 'required|string|max:128',
        ]);

        return $this->success($this->service->advanceReceiverSequence(
            $id,
            $this->token($request),
            (string) $validated['connection'],
            (string) $validated['table']
        ));
    }

    public function peerDatabaseComplete(Request $request, string $id): JsonResponse
    {
        return $this->success($this->service->completeReceiverDatabaseTransfer(
            $id,
            $this->token($request)
        ));
    }

    public function peerResourceChunk(Request $request, string $id): JsonResponse
    {
        $validated = $this->validateResourceChunk($request, false);
        return $this->success($this->service->receiveResourceChunk(
            $id,
            $this->token($request),
            (string) $validated['key'],
            (int) $validated['offset'],
            $this->decodeContent((string) $validated['content']),
            (string) $validated['sha256'],
            (bool) $validated['final']
        ));
    }

    public function peerResourceFileChunk(Request $request, string $id): JsonResponse
    {
        $validated = $this->validateResourceChunk($request, true);
        return $this->success($this->service->receiveResourceFileChunk(
            $id,
            $this->token($request),
            (string) $validated['key'],
            (string) $validated['relative_path'],
            (int) $validated['offset'],
            $this->decodeContent((string) $validated['content']),
            (string) $validated['sha256'],
            (bool) $validated['final']
        ));
    }

    public function peerFinalize(Request $request, string $id): JsonResponse
    {
        return $this->success($this->service->finalizeReceiver($id, $this->token($request)));
    }

    private function validateResourceChunk(Request $request, bool $withRelativePath): array
    {
        $rules = [
            'key' => 'required|string|max:128',
            'offset' => 'required|integer|min:0',
            'content' => 'present|string',
            'sha256' => 'required|string|size:64|regex:/^[a-f0-9]{64}$/',
            'final' => 'required|boolean',
        ];
        if ($withRelativePath) {
            $rules['relative_path'] = 'required|string|max:4096';
        }
        return $request->validate($rules);
    }

    private function token(Request $request): string
    {
        return (string) $request->header('X-Data-Sync-Token', '');
    }

    private function decodeContent(string $content): string
    {
        $decoded = base64_decode($content, true);
        if ($decoded === false) {
            throw new \InvalidArgumentException('Resource chunk content is not valid base64.');
        }
        return $decoded;
    }
}
