<?php

return [
    'api_description' => 'MeshSync: last-writer-wins record replication between every Laravel server (public domain and mesh routes). Machines push records; servers pull each other\'s change feeds and pass peers on.',
    'initialization_failed' => 'MeshSync initialization failed for :resource.',
    'not_initialized' => 'MeshSync tables are missing. Run php artisan sys:init on the server.',
    'records_invalid' => 'records must be a list of at most :max records.',
    'query_invalid' => 'q must be 1 to :max characters.',
    'peer_http_status' => 'The peer answered HTTP :status: :message',
    'route_info' => 'Library description, this server id, latest change seq, record and peer counts.',
    'route_records' => 'Ingest records [{stream, key, version, deleted, payload, search_text}] (machines, peer servers); optional peers [{base_url, server_id}] announces other servers.',
    'route_changes' => 'Change feed for peer servers: records after the seq cursor `after`, next cursor, and the peers this server reaches.',
    'route_search' => 'Live records whose search text contains q, optionally limited to comma-separated streams, newest first.',
    'route_peers' => 'Peer servers this server replicates from, with cursor and health.',
];
