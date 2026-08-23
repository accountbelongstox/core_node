<?php

use App\Apps\RelayV2\RelayV2Controllers\RelayV2DeviceCtl;
use App\Apps\RelayV2\RelayV2Controllers\RelayV2OwnerCtl;
use App\Apps\RelayV2\RelayV2Middleware\RelayV2DeviceSignatureMiddleware;
use App\Apps\RelayV2\RelayV2Services\RelayV2Contract;
use Illuminate\Support\Facades\Route;

$relayV2Uri = static function (string $role): string {
    $endpoint = RelayV2Contract::endpoint($role);
    $prefix = '/api/';

    if (!str_starts_with($endpoint, $prefix)) {
        throw new LogicException(__('relay_v2.contract_endpoint_prefix_invalid', ['name' => $role]));
    }

    return substr($endpoint, strlen($prefix));
};

Route::middleware([RelayV2DeviceSignatureMiddleware::class, 'throttle:relay-device'])->group(function () use ($relayV2Uri): void {
    Route::post($relayV2Uri('enrollment_create'), [RelayV2DeviceCtl::class, 'createEnrollment'])
        ->name('relay.v2.enrollment.create');
    Route::get($relayV2Uri('enrollment_status'), [RelayV2DeviceCtl::class, 'enrollmentStatus'])
        ->name('relay.v2.enrollment.status');
    Route::post($relayV2Uri('device_heartbeat'), [RelayV2DeviceCtl::class, 'heartbeat']);
    Route::post($relayV2Uri('device_event'), [RelayV2DeviceCtl::class, 'event']);
    Route::post($relayV2Uri('device_hub_authorization'), [RelayV2DeviceCtl::class, 'hubAuthorization']);
    Route::post($relayV2Uri('operation_claim'), [RelayV2DeviceCtl::class, 'claim']);
    Route::post($relayV2Uri('operation_execution_start'), [RelayV2DeviceCtl::class, 'executionStart']);
    Route::post($relayV2Uri('operation_lease_renew'), [RelayV2DeviceCtl::class, 'renewLease']);
    Route::post($relayV2Uri('operation_result'), [RelayV2DeviceCtl::class, 'result']);
    Route::get($relayV2Uri('device_request_blob_download'), [RelayV2DeviceCtl::class, 'requestBlob']);
    Route::post($relayV2Uri('device_response_blob_allocate'), [RelayV2DeviceCtl::class, 'allocateResponseBlob']);
    Route::put($relayV2Uri('device_response_blob_chunk'), [RelayV2DeviceCtl::class, 'responseBlobChunk']);
    Route::post($relayV2Uri('device_response_blob_finalize'), [RelayV2DeviceCtl::class, 'finalizeResponseBlob']);
});

Route::middleware(['auth:sanctum', 'throttle:relay-owner'])->group(function () use ($relayV2Uri): void {
    Route::post($relayV2Uri('owner_enrollment_claim'), [RelayV2OwnerCtl::class, 'claimEnrollment'])
        ->middleware('throttle:relay-enrollment-claim');
    Route::get($relayV2Uri('owner_device_roster'), [RelayV2OwnerCtl::class, 'roster']);
    Route::post($relayV2Uri('owner_pairing_create'), [RelayV2OwnerCtl::class, 'createPairing']);
    Route::post($relayV2Uri('owner_pairing_renew'), [RelayV2OwnerCtl::class, 'renewPairing'])->whereUuid('pairingId');
    Route::delete($relayV2Uri('owner_pairing_revoke'), [RelayV2OwnerCtl::class, 'revokePairing'])->whereUuid('pairingId');
    Route::post($relayV2Uri('owner_hub_authorization'), [RelayV2OwnerCtl::class, 'hubAuthorization']);
    Route::post($relayV2Uri('owner_operation_admit'), [RelayV2OwnerCtl::class, 'admitOperation']);
    Route::get($relayV2Uri('owner_operation_status'), [RelayV2OwnerCtl::class, 'operation'])
        ->whereUuid('operationId')
        ->name('relay.v2.operation.show');
    Route::post($relayV2Uri('owner_operation_cancel'), [RelayV2OwnerCtl::class, 'cancelOperation'])->whereUuid('operationId');
    Route::post($relayV2Uri('owner_request_blob_allocate'), [RelayV2OwnerCtl::class, 'allocateRequestBlob']);
    Route::put($relayV2Uri('owner_request_blob_chunk'), [RelayV2OwnerCtl::class, 'requestBlobChunk'])
        ->whereUuid('blobId')
        ->whereNumber('chunkIndex');
    Route::post($relayV2Uri('owner_request_blob_finalize'), [RelayV2OwnerCtl::class, 'finalizeRequestBlob'])->whereUuid('blobId');
    Route::get($relayV2Uri('owner_response_blob_download'), [RelayV2OwnerCtl::class, 'responseBlob'])->whereUuid('blobId');
});
