<?php

namespace App\Http\Controllers\Dashboard;

use App\Http\Controllers\Controller;
use App\Http\Requests\DataSync\PrepareDataSyncExporterRequest;
use App\Http\Requests\DataSync\PrepareDataSyncReceiverRequest;
use App\Http\Requests\DataSync\SetDataSyncTargetRequest;
use App\Http\Requests\DataSync\StartDataSyncRequest;
use App\Services\DataSync\DataSyncAbortException;
use App\Services\DataSync\DataSyncBusyException;
use App\Services\DataSync\DataSyncPassiveService;
use App\Services\DataSync\DataSyncProtocol;
use App\Services\DataSync\DataSyncService;
use App\Traits\ApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

final class DataSyncController extends Controller
{
    use ApiResponse;

    public function __construct(
        private readonly DataSyncService $service,
        private readonly DataSyncPassiveService $passive
    ) {}

    public function index(): JsonResponse
    {
        return $this->respond(fn (): array => [
            'sessions' => $this->service->list(),
            'machine_code' => $this->service->machineCode(),
            'protocol_version' => DataSyncProtocol::VERSION,
        ]);
    }

    public function show(string $id): JsonResponse
    {
        return $this->respond(fn (): array => [
            'session' => $this->service->get($id) ?? throw new \InvalidArgumentException('Data synchronization session was not found.'),
        ]);
    }

    public function start(StartDataSyncRequest $request): JsonResponse
    {
        $validated = $request->validated();
        return $this->respond(fn (): array => ['session' => $this->service->start(
            (string) ($validated['target'] ?? ''),
            (bool) $validated['databases'],
            (bool) $validated['resources'],
            (bool) $validated['compression']
        )], 201);
    }

    public function startFetch(StartDataSyncRequest $request): JsonResponse
    {
        $validated = $request->validated();
        return $this->respond(fn (): array => ['session' => $this->service->startFetch(
            (string) ($validated['target'] ?? ''),
            (bool) $validated['databases'],
            (bool) $validated['resources'],
            (bool) $validated['compression']
        )], 201);
    }

    public function probe(Request $request): JsonResponse
    {
        $validated = $request->validate(['target' => ['required', 'string', 'max:512']]);
        return $this->respond(fn (): array => ['probe' => $this->service->probeTarget((string) $validated['target'])]);
    }

    public function setTarget(SetDataSyncTargetRequest $request, string $id): JsonResponse
    {
        $validated = $request->validated();
        return $this->respond(fn (): array => ['session' => $this->service->setTarget($id, (string) $validated['target'])]);
    }

    public function pause(string $id): JsonResponse
    {
        return $this->respond(fn (): array => ['session' => $this->service->pause($id)]);
    }

    public function resume(string $id): JsonResponse
    {
        return $this->respond(fn (): array => ['session' => $this->service->resume($id)]);
    }

    public function cancel(string $id): JsonResponse
    {
        return $this->respond(fn (): array => ['session' => $this->service->cancel($id)]);
    }

    public function peerHealth(): JsonResponse
    {
        return $this->respond(fn (): array => $this->service->health());
    }

    public function peerPrepare(PrepareDataSyncReceiverRequest $request): JsonResponse
    {
        $validated = $request->validated();
        return $this->respond(fn (): array => $this->passive->prepare(
            'receiver',
            (string) $validated['source_job_id'],
            (string) $validated['prepare_token'],
            $validated['options'],
            $request->ip()
        ), 201);
    }

    public function peerExportPrepare(PrepareDataSyncExporterRequest $request): JsonResponse
    {
        $validated = $request->validated();
        return $this->respond(fn (): array => $this->passive->prepare(
            'exporter',
            (string) $validated['fetcher_job_id'],
            (string) $validated['prepare_token'],
            $validated['options'],
            $request->ip()
        ), 201);
    }

    public function peerStatus(Request $request, string $id): JsonResponse
    {
        return $this->respond(fn (): array => $this->passive->status($id, $this->token($request)));
    }

    public function peerCancel(Request $request, string $id): JsonResponse
    {
        return $this->respond(fn (): array => $this->passive->cancel($id, $this->token($request)));
    }

    public function peerFinalize(Request $request, string $id): JsonResponse
    {
        return $this->respond(fn (): array => $this->passive->finalize($id, $this->token($request)));
    }

    public function peerDatabaseInventory(Request $request, string $id): JsonResponse
    {
        return $this->respond(fn (): array => $this->passive->databaseInventory($id, $this->token($request)));
    }

    public function peerDatabaseCounts(Request $request, string $id): JsonResponse
    {
        return $this->respond(fn (): array => $this->passive->databaseCounts($id, $this->token($request)));
    }

    public function peerResourceManifest(Request $request, string $id, string $key): JsonResponse
    {
        return $this->respond(fn (): array => $this->passive->resourceManifest(
            $id,
            $this->token($request),
            $key,
            $request->boolean('fresh')
        ));
    }

    public function peerDatabaseChunk(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'connection' => 'required|string|max:128',
            'table' => 'required|string|max:128',
            'rows' => 'present|array',
        ]);

        return $this->respond(fn (): array => $this->passive->receiveDatabaseChunk(
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

        return $this->respond(fn (): array => $this->passive->advanceSequence(
            $id,
            $this->token($request),
            (string) $validated['connection'],
            (string) $validated['table']
        ));
    }

    public function peerDatabaseComplete(Request $request, string $id): JsonResponse
    {
        return $this->respond(fn (): array => $this->passive->completeDatabaseTransfer($id, $this->token($request)));
    }

    public function peerResourceFileBatch(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'files' => 'required|array|max:' . \App\Services\DataSync\ResourceSyncService::BATCH_MAX_FILES,
            'files.*.key' => 'required|string|max:128',
            'files.*.relative_path' => 'required|string|max:4096',
            'files.*.sha256' => 'required|string|size:64|regex:/^[a-f0-9]{64}$/',
            'files.*.content' => 'present|string',
        ]);

        return $this->respond(fn (): array => $this->passive->receiveFileBatch($id, $this->token($request), $validated['files']));
    }

    public function peerResourceFileChunk(Request $request, string $id): JsonResponse
    {
        $validated = $this->validateResourceChunk($request, true);
        return $this->respond(fn (): array => $this->passive->receiveFileChunk(
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

    public function peerResourceChunk(Request $request, string $id): JsonResponse
    {
        $validated = $this->validateResourceChunk($request, false);
        return $this->respond(fn (): array => $this->passive->receiveArchiveChunk(
            $id,
            $this->token($request),
            (string) $validated['key'],
            (int) $validated['offset'],
            $this->decodeContent((string) $validated['content']),
            (string) $validated['sha256'],
            (bool) $validated['final']
        ));
    }

    public function peerExportDatabaseChunk(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'connection' => 'required|string|max:128',
            'table' => 'required|string|max:128',
            'offset' => 'required|integer|min:0',
        ]);

        return $this->respond(fn (): array => $this->passive->exportDatabaseChunk(
            $id,
            $this->token($request),
            (string) $validated['connection'],
            (string) $validated['table'],
            (int) $validated['offset']
        ));
    }

    public function peerExportResourceFileChunk(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:128',
            'path' => 'required|string|max:4096',
            'offset' => 'required|integer|min:0',
        ]);

        return $this->respond(fn (): array => $this->passive->exportFileChunk(
            $id,
            $this->token($request),
            (string) $validated['key'],
            (string) $validated['path'],
            (int) $validated['offset']
        ));
    }

    public function peerExportResourceFileBatch(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'items' => 'required|array|max:' . \App\Services\DataSync\ResourceSyncService::BATCH_MAX_FILES,
            'items.*.key' => 'required|string|max:128',
            'items.*.relative_path' => 'required|string|max:4096',
        ]);

        return $this->respond(fn (): array => $this->passive->exportFileBatch($id, $this->token($request), $validated['items']));
    }

    public function peerExportResourceArchive(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'key' => 'required|string|max:128',
            'paths' => 'required|array|max:100000',
            'paths.*' => 'string|max:4096',
        ]);

        return $this->respond(fn (): array => $this->passive->exportArchive(
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

        return $this->respond(fn (): array => $this->passive->exportArchiveChunk(
            $id,
            $this->token($request),
            (string) $validated['key'],
            (int) $validated['offset']
        ));
    }

    /**
     * Busy sessions answer 503 (retryable by the peer client), cancelled
     * sessions 409, unknown sessions or inputs 404/422, other definitive
     * failures 409 with the reason.
     */
    private function respond(callable $callback, int $status = 200): JsonResponse
    {
        try {
            return $this->success($callback(), 'Success', $status);
        } catch (ValidationException $exception) {
            throw $exception;
        } catch (DataSyncBusyException $exception) {
            return $this->error($exception->getMessage(), 503);
        } catch (DataSyncAbortException $exception) {
            return $this->error($exception->getMessage(), 409);
        } catch (\InvalidArgumentException $exception) {
            return str_contains($exception->getMessage(), 'not found')
                ? $this->notFound($exception->getMessage())
                : $this->error($exception->getMessage(), 422);
        } catch (\RuntimeException $exception) {
            return $this->error($exception->getMessage(), 409);
        }
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
