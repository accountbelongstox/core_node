<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Models\RelayV2OperationModel;

final class RelayV2OperationEventService
{
    public function __construct(
        private readonly RelayV2OutboxRepository $outbox,
        private readonly RelayV2TopicService $topics
    ) {
    }

    public function wake(RelayV2OperationModel $operation): void
    {
        $this->outbox->append(
            'operation',
            (string) $operation->operation_id,
            (int) $operation->revision,
            RelayV2Contract::event('operation_available'),
            'device',
            $this->topics->device((string) $operation->device_id),
            $this->payload($operation)
        );
    }

    public function status(RelayV2OperationModel $operation): void
    {
        $this->outbox->append(
            'operation',
            (string) $operation->operation_id,
            (int) $operation->revision,
            RelayV2Contract::event('operation_status'),
            'pairing',
            $this->topics->pairing((int) $operation->user_id, (string) $operation->pairing_id),
            $this->payload($operation)
        );
    }

    private function payload(RelayV2OperationModel $operation): array
    {
        return [
            'operation_id' => (string) $operation->operation_id,
            'revision' => (int) $operation->revision,
            'state' => (string) $operation->state,
        ];
    }
}
