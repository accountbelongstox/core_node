<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayBlobChunkModel;
use App\Apps\Relay\RelayModels\RelayBlobModel;
use App\Apps\Relay\RelayModels\RelayEnrollmentModel;
use App\Apps\Relay\RelayModels\RelayOperationModel;
use App\Apps\Relay\RelayModels\RelayPairingModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;

final class RelayMaintenanceService
{
    public function __construct(
        private readonly RelayNonceRepository $nonces,
        private readonly RelayOperationEventService $operationEvents,
        private readonly RelayPairingEventService $pairingEvents,
        private readonly RelayOutboxRepository $outbox
    ) {
    }

    public function runSlice(): array
    {
        $result = [
            'operations' => 0,
            'pairings' => 0,
            'enrollments' => 0,
            'nonces' => 0,
            'blobs' => 0,
            'outbox' => 0,
        ];

        $result['operations'] = $this->expireOperations();
        $result['pairings'] = $this->expirePairings();
        $result['enrollments'] = $this->expireEnrollments();
        $result['nonces'] = $this->nonces->pruneExpired(RelayContract::limit('maintenance_row_batch'));
        $result['blobs'] = $this->pruneBlobs();
        $result['outbox'] = $this->outbox->pruneRetained(RelayContract::limit('maintenance_row_batch'));

        return $result;
    }

    private function expireOperations(): int
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function (): int {
            $rows = RelayOperationModel::query()
                ->where('expires_at', '<=', now())
                ->whereNotIn('state', $this->terminalStates())
                ->orderBy('id')
                ->limit(RelayContract::limit('maintenance_row_batch'))
                ->lock('for update skip locked')
                ->get();
            $count = 0;
            $target = '';

            foreach ($rows as $operation) {
                $target = (string) $operation->state === RelayConstants::STATE_EXECUTING
                    ? RelayConstants::STATE_EXECUTION_UNKNOWN
                    : ((string) $operation->state === RelayConstants::STATE_CANCEL_REQUESTED
                        ? RelayConstants::STATE_CANCELED
                        : RelayConstants::STATE_EXPIRED);
                $operation->forceFill([
                    'state' => $target,
                    'revision' => (int) $operation->revision + 1,
                    'error_code' => 'operation_retention_expired',
                    'completed_at' => now(),
                    'lease_expires_at' => null,
                    'updated_at' => now(),
                ])->save();
                $this->operationEvents->status($operation);
                $count++;
            }

            return $count;
        }, 3);
    }

    private function expirePairings(): int
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function (): int {
            $rows = RelayPairingModel::query()
                ->where('state', RelayConstants::PAIRING_ACTIVE)
                ->where('expires_at', '<=', now())
                ->orderBy('id')
                ->limit(RelayContract::limit('maintenance_row_batch'))
                ->lock('for update skip locked')
                ->get();
            $count = 0;

            foreach ($rows as $pairing) {
                $pairing->forceFill([
                    'state' => RelayConstants::PAIRING_EXPIRED,
                    'revision' => (int) $pairing->revision + 1,
                    'updated_at' => now(),
                ])->save();
                $this->pairingEvents->changed($pairing);
                $count++;
            }

            return $count;
        }, 3);
    }

    private function expireEnrollments(): int
    {
        $connection = DB::connection(RelayTablesMaps::connection());

        return $connection->transaction(function (): int {
            $rows = RelayEnrollmentModel::query()
                ->where('state', RelayConstants::ENROLLMENT_PENDING)
                ->where('expires_at', '<=', now())
                ->orderBy('id')
                ->limit(RelayContract::limit('maintenance_row_batch'))
                ->lock('for update skip locked')
                ->get();
            $count = 0;

            foreach ($rows as $enrollment) {
                $enrollment->forceFill([
                    'state' => RelayConstants::ENROLLMENT_EXPIRED,
                    'revision' => (int) $enrollment->revision + 1,
                    'updated_at' => now(),
                ])->save();
                $count++;
            }

            return $count;
        }, 3);
    }

    private function pruneBlobs(): int
    {
        $connection = DB::connection(RelayTablesMaps::connection());
        $blobIds = RelayBlobModel::query()
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->limit(RelayContract::limit('maintenance_blob_batch'))
            ->pluck('blob_id')
            ->map(static fn (mixed $value): string => (string) $value)
            ->all();
        $deleted = 0;
        $directory = '';
        $legacyDirectory = '';

        foreach ($blobIds as $blobId) {
            $directory = PathMapper::getLaravelDataDir(
                'relay'.DIRECTORY_SEPARATOR.'private_blobs'.DIRECTORY_SEPARATOR.$blobId
            );
            $legacyDirectory = PathMapper::getLaravelDataDir(
                'relay_v2'.DIRECTORY_SEPARATOR.'private_blobs'.DIRECTORY_SEPARATOR.$blobId
            );
            $deletedCanonical = FileSystemManager::delete($directory);
            $deletedLegacy = FileSystemManager::delete($legacyDirectory);
            if (!$deletedCanonical && !$deletedLegacy) {
                continue;
            }
            $deleted += $connection->transaction(function () use ($blobId): int {
                RelayBlobChunkModel::query()->where('blob_id', $blobId)->delete();

                return RelayBlobModel::query()
                    ->where('blob_id', $blobId)
                    ->where('expires_at', '<=', now())
                    ->delete();
            }, 3);
        }

        return $deleted;
    }

    private function terminalStates(): array
    {
        return [
            RelayConstants::STATE_RESPONDED,
            RelayConstants::STATE_FAILED,
            RelayConstants::STATE_EXECUTION_UNKNOWN,
            RelayConstants::STATE_EXPIRED,
            RelayConstants::STATE_CANCELED,
        ];
    }
}
