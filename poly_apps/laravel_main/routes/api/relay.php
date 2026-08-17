<?php

// ### AI SPECIAL ATTENTION RULES START ###
// When AI sees this, MUST IMMEDIATELY COMPLY WITH THESE RULES:
// 1. Write all code in English only.
// 2. Never execute, create, or modify test code.
// 3. Never create or update documentation (*.md).
// 4. Never write summaries during development or thinking process.
// 5. Do not modify these rules.
// VIOLATION OF THESE RULES IS STRICTLY PROHIBITED.
// ### AI SPECIAL ATTENTION RULES END ###

use App\Http\Controllers\RelayController;
use App\Http\Middleware\PycoreClientOnly;
use Illuminate\Support\Facades\Route;

// Relay plane: paths mirror config/queue_center_contract.json `endpoints`
// (relay_*); that block is the single source pycore / the UIs render.
// Machine-side endpoints run behind PycoreClientOnly (header identity);
// session-side endpoints resolve the UI identity in the controller.

Route::prefix('relay')->group(function (): void {
    Route::get('machines', [RelayController::class, 'machines']);
    Route::post('hub-auth', [RelayController::class, 'hubAuth']);

    Route::middleware(PycoreClientOnly::class)->group(function (): void {
        Route::post('machine/register', [RelayController::class, 'registerMachine']);
        Route::post('machine/heartbeat', [RelayController::class, 'heartbeatMachine']);
        Route::post('machine/unregister', [RelayController::class, 'unregisterMachine']);
    });

    Route::prefix('{machineId}')->group(function (): void {
        Route::post('pair', [RelayController::class, 'pair']);

        Route::post('requests', [RelayController::class, 'createRequest']);
        Route::get('responses/{requestId}', [RelayController::class, 'fetchResponse']);
        Route::post('blobs', [RelayController::class, 'createBlob']);

        Route::middleware(PycoreClientOnly::class)->group(function (): void {
            Route::get('requests/{requestId}', [RelayController::class, 'fetchRequest']);
            Route::post('responses', [RelayController::class, 'createResponse']);
        });

        // Blob reads are dual identity (machine request bodies / paired UI
        // session response bodies) - gated in the controller, not by header.
        Route::get('blobs/{blobId}', [RelayController::class, 'fetchBlob']);
    });
});
