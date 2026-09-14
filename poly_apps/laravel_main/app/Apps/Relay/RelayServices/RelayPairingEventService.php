<?php

namespace App\Apps\Relay\RelayServices;

use App\Apps\Relay\RelayModels\RelayPairingModel;

final class RelayPairingEventService
{
    public function __construct(
        private readonly RelayOutboxRepository $outbox,
        private readonly RelayTopicService $topics
    ) {
    }

    public function changed(RelayPairingModel $pairing): void
    {
        $this->outbox->append(
            'pairing',
            (string) $pairing->pairing_id,
            (int) $pairing->revision,
            RelayContract::event('pairing_changed'),
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
