<?php

return [
    'messages' => [
        'guide_retrieved' => 'Mesh login guide retrieved',
        'preauth_created' => 'Single-use pre-auth key created',
        'registered' => 'Device approved and joined the mesh',
    ],
    'errors' => [
        'unavailable' => 'This server does not run the Headscale control server.',
        'preauth_failed' => 'Could not create a pre-auth key on the Headscale server.',
        'register_failed' => 'Could not approve the device; check the auth ID and that the request has not expired.',
    ],
];
