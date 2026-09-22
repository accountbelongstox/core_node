<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\DataSync\PrepareDataSyncExporterRequest;
use App\Http\Requests\DataSync\PrepareDataSyncReceiverRequest;
use App\Http\Requests\DataSync\SetDataSyncTargetRequest;
use App\Http\Requests\DataSync\StartDataSyncRequest;
use App\Services\DataSync\DataSyncProtocol;
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

    public function start(StartDataSyncRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $job = $this->service->start(
            (string) ($validated['target'] ?? ''),
            (bool) $validated['databases'],
            (bool) $validated['resources'],
            (bool) $validated['compression']
        );

        return $this->created(['session' => $job], 'Data synchronization session created.');
    }

    public function startFetch(StartDataSyncRequest $request): JsonResponse
    {
        $validated = $request->validated();
        $job = $this->service->startFetch(
            (string) ($validated['target'] ?? ''),
            (bool) $validated['databases'],
            (bool) $validated['resources'],
            (bool) $validated['compression']
        );

        return $this->created(['session' => $job], 'Fetch synchronization session created.');
    }

    public function probe(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'target' => ['required', 'string', 'max:512'],
        ]);

        return $this->success(['probe' => $this->service->probeTarget((string) $validated['target'])]);
    }

    public function setTarget(SetDataSyncTargetRequest $request, string $id): JsonResponse
    {
        $validated = $request->validated();

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

    public function cancel(string $id): JsonResponse
    {
        return $this->success(['session' => $this->service->cancel($id)], 'Data synchronization cancelled.');
    }

    public function peerHealth(): JsonResponse
    {
        return $this->success($this->service->health());
    }

    public function peerPrepare(PrepareDataSyncReceiverRequest $request): JsonResponse
    {
        $validated = $request->validated();

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

    public function peerExportPrepare(PrepareDataSyncExporterRequest $request): JsonResponse
    {
        $validated = $request->validated();

        return $this->created(
            $this->service->prepareExporter(
                (string) $validated['fetcher_job_id'],
                (string) $validated['prepare_token'],
                $validated['options'],
                $request->ip()
            ),
            'Exporter synchronization session created.'
        );
    }

    public function peerExportStatus(Request $request, string $id): JsonResponse
    {
        return $this->success($this->service->exporterStatus($id, $this->token($request)));
    }

    public function peerExportDatabaseInventory(Request $request, string $id): JsonResponse
    {
        return $this->success($this->service->exporterDatabaseInventory($id, $this->token($request)));
    }

    public function peerExportDatabaseChunk(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'connection' => 'required|string|max:128',
            'table' => 'required|string|max:128',
            'offset' => 'required|integer|min:0',
        ]);

        return $this->success($this->service->exporterDatabaseChunk(
            $id,
            $this->token($request),
            (string) $validated['connection'],
            (string) $validated['table'],
            (int) $validated['offset']
        ));
    }

    public function peerExportResourceManifest(Request $request, string $id, string $key): JsonResponse
    {
        return $this->success($this->service->exporterResourceManifest($id, $this->token($request), $key));
    }

    public function peerExportResourceFileChunk(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:128',
            'path' => 'required|string|max:4096',
            'offset' => 'required|integer|min:0',
        ]);

        return $this->success($this->service->exporterResourceFileChunk(
            $id,
            $this->token($request),
            (string) $validated['key'],
            (string) $validated['path'],
            (int) $validated['offset']
        ));
    }

    public function peerExportResourceArchive(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:128',
            'paths' => 'required|array|max:100000',
            'paths.*' => 'string|max:4096',
        ]);

        return $this->success($this->service->exporterResourceArchive(
            $id,
            $this->token($request),
            (string) $validated['key'],
            array_map('strval', array_values($validated['paths']))
        ));
    }

    public function peerExportResourceArchiveChunk(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:128',
            'offset' => 'required|integer|min:0',
        ]);

        return $this->success($this->service->exporterResourceArchiveChunk(
            $id,
            $this->token($request),
            (string) $validated['key'],
            (int) $validated['offset']
        ));
    }

    public function peerExportFinalize(Request $request, string $id): JsonResponse
    {
        return $this->success($this->service->finalizeExporter($id, $this->token($request)));
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
        return (string) $request->header(DataSyncProtocol::TOKEN_HEADER, '');
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
