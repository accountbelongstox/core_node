<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Gvar\RelayV2Constants;
use App\Apps\RelayV2\RelayV2Models\RelayV2BlobChunkModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2BlobModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2EnrollmentModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2OperationModel;
use App\Apps\RelayV2\RelayV2Models\RelayV2PairingModel;
use App\Apps\RelayV2\RelayV2TablesMaps\RelayV2TablesMaps;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;

final class RelayV2MaintenanceService
{
    private const SLICE_LIMIT = 100;
    private const BLOB_SLICE_LIMIT = 20;

    public function __construct(private readonly RelayV2NonceRepository $nonces)
    {
    }

    public function runSlice(): array
    {
        $result = [
            'operations' => 0,
            'pairings' => 0,
            'enrollments' => 0,
            'nonces' => 0,
            'blobs' => 0,
        ];

        $result['operations'] = $this->expireOperations();
        $result['pairings'] = $this->expirePairings();
        $result['enrollments'] = $this->expireEnrollments();
        $result['nonces'] = $this->nonces->pruneExpired(self::SLICE_LIMIT);
        $result['blobs'] = $this->pruneBlobs();

        return $result;
    }

    private function expireOperations(): int
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function (): int {
            $rows = RelayV2OperationModel::query()
                ->where('expires_at', '<=', now())
                ->whereNotIn('state', $this->terminalStates())
                ->orderBy('id')
                ->limit(self::SLICE_LIMIT)
                ->lock('for update skip locked')
                ->get();
            $count = 0;
            $target = '';

            foreach ($rows as $operation) {
                $target = (string) $operation->state === RelayV2Constants::STATE_EXECUTING
                    ? RelayV2Constants::STATE_EXECUTION_UNKNOWN
                    : ((string) $operation->state === RelayV2Constants::STATE_CANCEL_REQUESTED
                        ? RelayV2Constants::STATE_CANCELED
                        : RelayV2Constants::STATE_EXPIRED);
                $operation->forceFill([
                    'state' => $target,
                    'revision' => (int) $operation->revision + 1,
                    'error_code' => 'operation_retention_expired',
                    'completed_at' => now(),
                    'lease_expires_at' => null,
                    'updated_at' => now(),
                ])->save();
                $count++;
            }

            return $count;
        }, 3);
    }

    private function expirePairings(): int
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function (): int {
            $rows = RelayV2PairingModel::query()
                ->where('state', RelayV2Constants::PAIRING_ACTIVE)
                ->where('expires_at', '<=', now())
                ->orderBy('id')
                ->limit(self::SLICE_LIMIT)
                ->lock('for update skip locked')
                ->get();
            $count = 0;

            foreach ($rows as $pairing) {
                $pairing->forceFill([
                    'state' => RelayV2Constants::PAIRING_EXPIRED,
                    'revision' => (int) $pairing->revision + 1,
                    'updated_at' => now(),
                ])->save();
                $count++;
            }

            return $count;
        }, 3);
    }

    private function expireEnrollments(): int
    {
        $connection = DB::connection(RelayV2TablesMaps::connection());

        return $connection->transaction(function (): int {
            $rows = RelayV2EnrollmentModel::query()
                ->where('state', RelayV2Constants::ENROLLMENT_PENDING)
                ->where('expires_at', '<=', now())
                ->orderBy('id')
                ->limit(self::SLICE_LIMIT)
                ->lock('for update skip locked')
                ->get();
            $count = 0;

            foreach ($rows as $enrollment) {
                $enrollment->forceFill([
                    'state' => RelayV2Constants::ENROLLMENT_EXPIRED,
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
        $connection = DB::connection(RelayV2TablesMaps::connection());
        $blobIds = RelayV2BlobModel::query()
            ->where('expires_at', '<=', now())
            ->orderBy('id')
            ->limit(self::BLOB_SLICE_LIMIT)
            ->pluck('blob_id')
            ->map(static fn (mixed $value): string => (string) $value)
            ->all();
        $deleted = 0;
        $directory = '';

        foreach ($blobIds as $blobId) {
            $directory = PathMapper::getLaravelDataDir(
                'relay_v2'.DIRECTORY_SEPARATOR.'private_blobs'.DIRECTORY_SEPARATOR.$blobId
            );
            if (!FileSystemManager::delete($directory)) {
                continue;
            }
            $deleted += $connection->transaction(function () use ($blobId): int {
                RelayV2BlobChunkModel::query()->where('blob_id', $blobId)->delete();

                return RelayV2BlobModel::query()
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
            RelayV2Constants::STATE_RESPONDED,
            RelayV2Constants::STATE_FAILED,
            RelayV2Constants::STATE_EXECUTION_UNKNOWN,
            RelayV2Constants::STATE_EXPIRED,
            RelayV2Constants::STATE_CANCELED,
        ];
    }
}
