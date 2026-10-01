<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayGvar\RelayConstants;
use App\Apps\Relay\RelayModels\RelayBlobChunkModel;
use App\Apps\Relay\RelayModels\RelayBlobModel;
use App\Apps\Relay\RelayModels\RelayEnrollmentModel;
use App\Apps\Relay\RelayModels\RelayPairingModel;
use App\Apps\Relay\RelayTablesMaps\RelayTablesMaps;
use App\Providers\PathMapper;
use App\Utils\FileSystemManager;
use Illuminate\Support\Facades\DB;

final class RelayMaintenanceService
{
    public function __construct(
        private readonly RelayNonceRepository $nonces,
        private readonly RelayPairingEventService $pairingEvents,
        private readonly RelayOutboxRepository $outbox,
        private readonly RelayFrameService $frames
    ) {
    }

    public function runSlice(): array
    {
        $result = [
            'pairings' => 0,
            'enrollments' => 0,
            'nonces' => 0,
            'blobs' => 0,
            'outbox' => 0,
            'ledger' => 0,
        ];

        $result['pairings'] = $this->expirePairings();
        $result['enrollments'] = $this->expireEnrollments();
        $result['nonces'] = $this->nonces->pruneExpired(RelayContract::limit('maintenance_row_batch'));
        $result['blobs'] = $this->pruneBlobs();
        $result['outbox'] = $this->outbox->pruneRetained(RelayContract::limit('maintenance_row_batch'));
        $result['ledger'] = $this->frames->drainLedger()['drained'];

        return $result;
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

        foreach ($blobIds as $blobId) {
            $directory = PathMapper::getLaravelDataDir(
                'relay'.DIRECTORY_SEPARATOR.'private_blobs'.DIRECTORY_SEPARATOR.$blobId
            );
            if (!FileSystemManager::delete($directory)) {
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
}
