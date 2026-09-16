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
    Route::post($relayUri('device_hub_authorization'), [RelayDeviceCtl::class, 'hubAuthorization']);
    Route::post($relayUri('operation_claim'), [RelayDeviceCtl::class, 'claim']);
    Route::post($relayUri('operation_execution_start'), [RelayDeviceCtl::class, 'executionStart']);
    Route::post($relayUri('operation_lease_renew'), [RelayDeviceCtl::class, 'renewLease']);
    Route::post($relayUri('operation_result'), [RelayDeviceCtl::class, 'result']);
    Route::get($relayUri('device_request_blob_download'), [RelayDeviceCtl::class, 'requestBlob']);
    Route::post($relayUri('device_response_blob_allocate'), [RelayDeviceCtl::class, 'allocateResponseBlob']);
    Route::put($relayUri('device_response_blob_chunk'), [RelayDeviceCtl::class, 'responseBlobChunk']);
    Route::post($relayUri('device_response_blob_finalize'), [RelayDeviceCtl::class, 'finalizeResponseBlob']);
});

Route::withoutMiddleware([EnsureFrontendRequestsAreStateful::class])->middleware('throttle:relay-owner')->group(function () use ($relayUri): void {
    Route::post($relayUri('owner_enrollment_claim'), [RelayOwnerCtl::class, 'claimEnrollment'])
        ->middleware('throttle:relay-enrollment-claim');
    Route::get($relayUri('owner_device_roster'), [RelayOwnerCtl::class, 'roster']);
    Route::post($relayUri('owner_pairing_create'), [RelayOwnerCtl::class, 'createPairing']);
    Route::post($relayUri('owner_pairing_renew'), [RelayOwnerCtl::class, 'renewPairing'])->whereUuid('pairingId');
    Route::delete($relayUri('owner_pairing_revoke'), [RelayOwnerCtl::class, 'revokePairing'])->whereUuid('pairingId');
    Route::post($relayUri('owner_hub_authorization'), [RelayOwnerCtl::class, 'hubAuthorization']);
    Route::post($relayUri('owner_operation_admit'), [RelayOwnerCtl::class, 'admitOperation']);
    Route::get($relayUri('owner_operation_status'), [RelayOwnerCtl::class, 'operation'])
        ->whereUuid('operationId')
        ->name('relay.operation.show');
    Route::post($relayUri('owner_operation_cancel'), [RelayOwnerCtl::class, 'cancelOperation'])->whereUuid('operationId');
    Route::post($relayUri('owner_request_blob_allocate'), [RelayOwnerCtl::class, 'allocateRequestBlob']);
    Route::put($relayUri('owner_request_blob_chunk'), [RelayOwnerCtl::class, 'requestBlobChunk'])
        ->whereUuid('blobId')
        ->whereNumber('chunkIndex');
    Route::post($relayUri('owner_request_blob_finalize'), [RelayOwnerCtl::class, 'finalizeRequestBlob'])->whereUuid('blobId');
    Route::get($relayUri('owner_response_blob_download'), [RelayOwnerCtl::class, 'responseBlob'])->whereUuid('blobId');
});
