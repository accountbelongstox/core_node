<?php

use App\Apps\Relay\RelayControllers\RelayDeviceCtl;
use App\Apps\Relay\RelayControllers\RelayOwnerCtl;
use App\Apps\Relay\RelayMiddleware\RelayDeviceSignatureMiddleware;
use App\Apps\Relay\RelayServices\RelayContract;
use Illuminate\Support\Facades\Route;
use Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful;

$relayUri = static function (string $role): string {
    $endpoint = RelayContract::endpoint($role);
    $prefix = '/api/';

    if (!str_starts_with($endpoint, $prefix)) {
        throw new LogicException(__('relay.contract_endpoint_prefix_invalid', ['name' => $role]));
    }

    return substr($endpoint, strlen($prefix));
};

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->middleware([RelayDeviceSignatureMiddleware::class, 'throttle:relay-device'])->group(function () use ($relayUri): void {
    Route::post($relayUri('enrollment_create'), [RelayDeviceCtl::class, 'createEnrollment'])
        ->name('relay.enrollment.create');
    Route::get($relayUri('enrollment_status'), [RelayDeviceCtl::class, 'enrollmentStatus'])
        ->name('relay.enrollment.status');
    Route::post($relayUri('device_heartbeat'), [RelayDeviceCtl::class, 'heartbeat']);
    Route::post($relayUri('device_event'), [RelayDeviceCtl::class, 'event']);
    Route::get($relayUri('device_request_blob_download'), [RelayDeviceCtl::class, 'requestBlob']);
    Route::post($relayUri('device_response_blob_allocate'), [RelayDeviceCtl::class, 'allocateResponseBlob']);
    Route::put($relayUri('device_response_blob_chunk'), [RelayDeviceCtl::class, 'responseBlobChunk']);
    Route::post($relayUri('device_response_blob_finalize'), [RelayDeviceCtl::class, 'finalizeResponseBlob']);
});

// Grant, frame and telemetry routes carry their own Redis window limiter
// (contract rate_limits.owner_frames_per_minute): the per-action limiter
// would cap a live UI far below its frame rate. Owner routes authenticate the
// Sanctum Bearer user or a client-key (K3) caller acting as the shared fleet
// owner; never an anonymous fallback.
Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->middleware('client.key_or_dashboard:user')->group(function () use ($relayUri): void {
    Route::post($relayUri('owner_grant'), [RelayOwnerCtl::class, 'grant']);
    Route::post($relayUri('owner_frames'), [RelayOwnerCtl::class, 'frames']);
    Route::post($relayUri('owner_telemetry'), [RelayOwnerCtl::class, 'telemetry']);
    Route::get($relayUri('owner_stats'), [RelayOwnerCtl::class, 'stats']);
});

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->middleware(['client.key_or_dashboard:user', 'throttle:relay-owner'])->group(function () use ($relayUri): void {
    Route::post($relayUri('owner_enrollment_claim'), [RelayOwnerCtl::class, 'claimEnrollment'])
        ->middleware('throttle:relay-enrollment-claim');
    Route::get($relayUri('owner_device_roster'), [RelayOwnerCtl::class, 'roster']);
    Route::post($relayUri('owner_pairing_create'), [RelayOwnerCtl::class, 'createPairing']);
    Route::post($relayUri('owner_pairing_renew'), [RelayOwnerCtl::class, 'renewPairing'])->whereUuid('pairingId');
    Route::delete($relayUri('owner_pairing_revoke'), [RelayOwnerCtl::class, 'revokePairing'])->whereUuid('pairingId');
    Route::post($relayUri('owner_request_blob_allocate'), [RelayOwnerCtl::class, 'allocateRequestBlob']);
    Route::put($relayUri('owner_request_blob_chunk'), [RelayOwnerCtl::class, 'requestBlobChunk'])
        ->whereUuid('blobId')
        ->whereNumber('chunkIndex');
    Route::post($relayUri('owner_request_blob_finalize'), [RelayOwnerCtl::class, 'finalizeRequestBlob'])->whereUuid('blobId');
    Route::get($relayUri('owner_response_blob_download'), [RelayOwnerCtl::class, 'responseBlob'])->whereUuid('blobId');
});
