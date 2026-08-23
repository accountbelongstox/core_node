<?php

namespace App\Apps\RelayV2\RelayV2Services;

use App\Apps\RelayV2\RelayV2Models\RelayV2PairingModel;

final class RelayV2PairingEventService
{
    public function __construct(
        private readonly RelayV2OutboxRepository $outbox,
        private readonly RelayV2TopicService $topics
    ) {
    }

    public function changed(RelayV2PairingModel $pairing): void
    {
        $this->outbox->append(
            'pairing',
            (string) $pairing->pairing_id,
            (int) $pairing->revision,
            RelayV2Contract::event('pairing_changed'),
            'owner',
            $this->topics->owner((int) $pairing->user_id),
            [
                'pairing_id' => (string) $pairing->pairing_id,
                'revision' => (int) $pairing->revision,
                'state' => (string) $pairing->state,
            ]
        );
    }
}
