<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayModels\RelayOperationModel;

final class RelayOperationEventService
{
    public function __construct(
        private readonly RelayOutboxRepository $outbox,
        private readonly RelayTopicService $topics
    ) {
    }

    public function wake(RelayOperationModel $operation): void
    {
        $this->outbox->append(
            'operation',
            (string) $operation->operation_id,
            (int) $operation->revision,
            RelayContract::event('operation_available'),
            'device',
            $this->topics->device((string) $operation->device_id),
            $this->payload($operation)
        );
    }

    public function status(RelayOperationModel $operation): void
    {
        $payload = $this->payload($operation);
        $descriptor = $operation->ownerDescriptor();
        if (strlen(RelayContract::canonicalJson($descriptor)) < 32768) {
            $payload['operation'] = $descriptor;
        }
        $this->outbox->append(
            'operation',
            (string) $operation->operation_id,
            (int) $operation->revision,
            RelayContract::event('operation_status'),
            'pairing',
            $this->topics->owner((int) $operation->user_id),
            $payload
        );
    }

    private function payload(RelayOperationModel $operation): array
    {
        return [
            'operation_id' => (string) $operation->operation_id,
            'revision' => (int) $operation->revision,
            'state' => (string) $operation->state,
        ];
    }
}
